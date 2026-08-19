import { InvalidOptionError, UnknownCapabilityError, UnknownMethodError } from './errors.js'

// A capability pack is a plain object:
//
//   {
//     name: 'notes',
//     version: 1,
//     methods: {
//       search: async (params, ctx) => ({ hits: [] }),          // unary
//       watch:  async function * (params, ctx) { yield … }      // streaming
//     },
//     defaultGrants: ['search'],
//     async onAttach (node) {}, async onPeer (peer) {}, async onDetach () {}
//   }
//
// Unary vs streaming is inferred from the handler being an async generator,
// which is the whole of the distinction — there is no separate registration.
export function isAsyncGeneratorFunction (fn) {
  return typeof fn === 'function' &&
    (fn.constructor?.name === 'AsyncGeneratorFunction' ||
     Object.prototype.toString.call(fn) === '[object AsyncGeneratorFunction]')
}

export function validatePack (pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    throw new InvalidOptionError('A capability pack must be an object')
  }
  if (typeof pack.name !== 'string' || !pack.name.trim()) {
    throw new InvalidOptionError('A capability pack needs a non-empty string name')
  }
  if (!/^[a-z][a-z0-9-]*$/.test(pack.name)) {
    throw new InvalidOptionError(`Invalid capability name "${pack.name}": use lowercase letters, digits and dashes`)
  }
  if (!pack.methods || typeof pack.methods !== 'object') {
    throw new InvalidOptionError(`Capability "${pack.name}" needs a methods object`)
  }
  for (const [method, handler] of Object.entries(pack.methods)) {
    if (typeof handler !== 'function') {
      throw new InvalidOptionError(`Capability "${pack.name}" method "${method}" must be a function`)
    }
  }
  if (pack.defaultGrants != null && !Array.isArray(pack.defaultGrants)) {
    throw new InvalidOptionError(`Capability "${pack.name}" defaultGrants must be an array`)
  }
  for (const method of pack.defaultGrants || []) {
    if (!Object.hasOwn(pack.methods, method)) {
      throw new InvalidOptionError(`Capability "${pack.name}" grants unknown method "${method}" by default`)
    }
  }
  return pack
}

export class CapabilityRegistry {
  constructor (packs = []) {
    this.packs = new Map()
    for (const pack of packs) this.add(pack)
  }

  add (pack) {
    validatePack(pack)
    if (this.packs.has(pack.name)) {
      throw new InvalidOptionError(`Capability "${pack.name}" is already registered`)
    }
    this.packs.set(pack.name, pack)
    return this
  }

  get (name) {
    return this.packs.get(name) || null
  }

  has (name) {
    return this.packs.has(name)
  }

  // Advertised in the hello. This is the single answer to "what can you do" —
  // there is no separate service-flags map.
  describe () {
    const out = {}
    for (const [name, pack] of this.packs) {
      out[name] = {
        version: pack.version ?? 1,
        methods: Object.keys(pack.methods)
      }
    }
    return out
  }

  resolve (capability, method) {
    const pack = this.packs.get(capability)
    if (!pack) throw new UnknownCapabilityError(capability)
    const handler = Object.hasOwn(pack.methods, method) ? pack.methods[method] : undefined
    if (typeof handler !== 'function') throw new UnknownMethodError(capability, method)
    return { pack, handler, streaming: isAsyncGeneratorFunction(handler) }
  }

  defaultGrants () {
    const grants = {}
    for (const [name, pack] of this.packs) {
      grants[name] = [...(pack.defaultGrants || [])]
    }
    return grants
  }

  // Grants are least-privilege: a peer receives only methods it asked for and
  // that this node actually hosts. Omitting a request falls back to the packs'
  // own defaults, never to everything.
  grantsFor (requested) {
    if (!requested || typeof requested !== 'object' || Array.isArray(requested)) {
      return this.defaultGrants()
    }
    const grants = {}
    for (const [name, pack] of this.packs) {
      const wanted = Array.isArray(requested[name]) ? requested[name] : []
      const available = new Set(Object.keys(pack.methods))
      grants[name] = wanted.filter((method) => available.has(method))
    }
    return grants
  }

  isGranted (grants, capability, method) {
    if (!grants || typeof grants !== 'object') return false
    const methods = grants[capability]
    return Array.isArray(methods) && methods.includes(method)
  }

  async attach (node) {
    for (const pack of this.packs.values()) {
      if (typeof pack.onAttach === 'function') await pack.onAttach(node)
    }
  }

  async onPeer (peer) {
    for (const pack of this.packs.values()) {
      if (typeof pack.onPeer === 'function') await pack.onPeer(peer)
    }
  }

  async detach () {
    for (const pack of this.packs.values()) {
      if (typeof pack.onDetach === 'function') {
        try { await pack.onDetach() } catch {}
      }
    }
  }
}
