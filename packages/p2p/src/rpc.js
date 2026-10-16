import { InvalidOptionError, NodeError } from './errors.js'

// Metadata stays local: only kinds/versions are advertised, never handlers or schemas.
const procedures = new WeakMap()
const contracts = new WeakSet()

export function procedureMetadata (handler) { return procedures.get(handler) }

async function parse (schema, value, code) {
  if (!schema) return value
  try {
    if (typeof schema === 'function') return await schema(value)
    if (typeof schema['~standard']?.validate === 'function') {
      const result = await schema['~standard'].validate(value)
      if (result.issues) throw new Error('Validation failed')
      return result.value
    }
    return await schema.parse(value)
  } catch {
    throw new NodeError(code, code === 'INVALID_INPUT' ? 'Invalid procedure input' : 'Invalid procedure output')
  }
}

function assertJson (value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (!value || typeof value !== 'object' || seen.has(value) ||
      Object.getOwnPropertySymbols(value).length > 0 ||
      (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new NodeError('INVALID_OUTPUT', 'Procedure outputs must contain only JSON values')
  }
  seen.add(value)
  for (const item of Array.isArray(value) ? value : Object.values(value)) assertJson(item, seen)
  seen.delete(value)
}

// Output validators describe the JSON wire shape. Applying them at both
// boundaries protects against untrusted hosts and avoids sending stripped fields.
async function parseOutput (schema, value) {
  if (!schema) { assertJson(value); return value }
  const output = await parse(schema, value, 'INVALID_OUTPUT')
  try {
    assertJson(output)
    const encoded = JSON.stringify(output)
    const wire = JSON.parse(encoded)
    const verified = await parse(schema, wire, 'INVALID_OUTPUT')
    if (JSON.stringify(verified) !== encoded) throw new Error('Non-idempotent output')
    return wire
  } catch {
    throw new NodeError('INVALID_OUTPUT', 'Output validator must preserve its JSON wire shape')
  }
}

function validateParser (schema) {
  if (typeof schema !== 'function' && typeof schema?.parse !== 'function' &&
      typeof schema?.['~standard']?.validate !== 'function') {
    throw new InvalidOptionError('A validator must be a parser function, a parse() object or a Standard Schema')
  }
}

class ProcedureBuilder {
  constructor (input, output) {
    this._input = input
    this._output = output
    Object.freeze(this)
  }

  input (schema) { validateParser(schema); return new ProcedureBuilder(schema, this._output) }
  output (schema) { validateParser(schema); return new ProcedureBuilder(this._input, schema) }
  query (handler) { return this._build('unary', 'query', handler) }
  mutation (handler) { return this._build('unary', 'mutation', handler) }
  stream (handler) { return this._build('stream', 'stream', handler) }

  _build (kind, operation, handler) {
    if (typeof handler !== 'function') throw new InvalidOptionError('A procedure needs a handler')
    const input = this._input
    const output = this._output
    const invoke = kind === 'stream'
      ? async function * (params, ctx) {
        const value = await parse(input, params, 'INVALID_INPUT')
        for await (const chunk of handler({ input: value, ...ctx })) {
          yield await parseOutput(output, chunk)
        }
      }
      : async function (params, ctx) {
        const value = await parse(input, params, 'INVALID_INPUT')
        const result = await handler({ input: value, ...ctx })
        return parseOutput(output, result)
      }
    procedures.set(invoke, Object.freeze({ kind, operation, input, output }))
    return Object.freeze(invoke)
  }
}

export const procedure = new ProcedureBuilder()

export function defineCapability (options) {
  if (!options || options.name?.length > 128 || !/^[a-z][a-z0-9-]*$/.test(options.name || '')) {
    throw new InvalidOptionError('A capability needs a lowercase name')
  }
  if (!Number.isSafeInteger(options.version) || options.version < 1) {
    throw new InvalidOptionError('A capability version must be a positive safe integer')
  }
  if (!options.methods || typeof options.methods !== 'object' || Array.isArray(options.methods)) {
    throw new InvalidOptionError('A capability needs a methods object')
  }
  const methods = Object.freeze({ ...options.methods })
  const descriptors = Object.create(null)
  for (const [name, handler] of Object.entries(methods)) {
    if (name === 'then' || name.length > 128 || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) throw new InvalidOptionError(`Invalid procedure name: ${name}`)
    const metadata = procedureMetadata(handler)
    if (!metadata) throw new InvalidOptionError(`Use a procedure builder for ${name}`)
    descriptors[name] = metadata
  }
  const defaultGrants = Object.freeze([...(options.defaultGrants || [])])
  if (defaultGrants.some(name => !Object.hasOwn(methods, name))) {
    throw new InvalidOptionError('Default grants must name defined methods')
  }
  const contract = Object.freeze({ name: options.name, version: options.version, methods: Object.freeze(descriptors) })
  contracts.add(contract)
  return Object.freeze({ ...options, methods, defaultGrants, contract })
}

// Bind an actual shared runtime contract; a generic assertion cannot check an unknown peer.
export function createClient (peer, capability) {
  const contract = capability?.contract || capability
  if (!contracts.has(contract)) throw new InvalidOptionError('client() needs a defineCapability() contract')
  peer._assertOpen()
  const advertised = peer.capabilities?.[contract.name]
  if (!advertised || advertised.version !== contract.version) {
    throw new NodeError('INCOMPATIBLE_CAPABILITY', `Peer does not support ${contract.name} version ${contract.version}`)
  }
  if (advertised.methodKinds != null &&
      (typeof advertised.methodKinds !== 'object' || Array.isArray(advertised.methodKinds))) {
    throw new NodeError('INCOMPATIBLE_CAPABILITY', 'Peer advertises invalid method kinds')
  }
  const client = Object.create(null)
  for (const [name, descriptor] of Object.entries(contract.methods)) {
    if (!Array.isArray(advertised.methods) || !advertised.methods.includes(name) ||
        (advertised.methodKinds != null && advertised.methodKinds[name] !== descriptor.kind)) {
      throw new NodeError('INCOMPATIBLE_CAPABILITY', `Peer does not support ${contract.name}.${name}`)
    }
    client[name] = descriptor.kind === 'stream'
      ? async function * (params, opts = {}) {
        // Inputs are parsed once by the host. Parsing transformations twice
        // (client then host) would change their meaning.
        for await (const chunk of peer.stream(contract.name, name, params, { ...opts, version: contract.version })) {
          yield await parse(descriptor.output, chunk, 'INVALID_OUTPUT')
        }
      }
      : async (params, opts = {}) => parse(descriptor.output,
        await peer.call(contract.name, name, params, { ...opts, version: contract.version }), 'INVALID_OUTPUT')
  }
  return Object.freeze(client)
}
