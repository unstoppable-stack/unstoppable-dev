const RESOURCE_KINDS = new Set(['hypercore', 'hyperbee', 'hyperdrive'])
const PROTECTION_MODES = new Set(['mirror', 'metadata-only'])
const MAX_RESOURCES = 10_000
const MAX_METADATA_ENTRIES = 32

export function validateResourceManifest (value) {
  if (!isPlainObject(value)) throw new Error('Resource manifest must be an object')
  if (value.schemaVersion !== 1) throw new Error(`Unsupported resource manifest schema: ${value.schemaVersion}`)
  if (!Array.isArray(value.resources) || value.resources.length > MAX_RESOURCES) {
    throw new Error(`Resource manifest resources must be an array of at most ${MAX_RESOURCES} entries`)
  }

  const ids = new Set()
  const keys = new Set()
  const resources = value.resources.map((resource) => {
    if (!isPlainObject(resource)) throw new Error('Resource descriptors must be objects')
    if (typeof resource.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(resource.id)) {
      throw new Error('Resource id must be 1-200 safe characters')
    }
    if (ids.has(resource.id)) throw new Error(`Duplicate resource id: ${resource.id}`)
    ids.add(resource.id)
    if (!RESOURCE_KINDS.has(resource.kind)) throw new Error(`Unsupported resource kind: ${resource.kind}`)
    if (typeof resource.key !== 'string' || !/^[a-fA-F0-9]{64}$/.test(resource.key)) {
      throw new Error(`Resource ${resource.id} must have a 32-byte hex key`)
    }
    const key = resource.key.toLowerCase()
    if (keys.has(key)) throw new Error(`Duplicate resource key: ${key}`)
    keys.add(key)
    if (typeof resource.name !== 'string' || resource.name.length < 1 || resource.name.length > 200) {
      throw new Error(`Resource ${resource.id} name must be 1-200 characters`)
    }

    const metadata = resource.metadata === undefined ? {} : resource.metadata
    if (!isPlainObject(metadata) || Object.keys(metadata).length > MAX_METADATA_ENTRIES) {
      throw new Error(`Resource ${resource.id} metadata must contain at most ${MAX_METADATA_ENTRIES} string entries`)
    }
    for (const [metadataKey, metadataValue] of Object.entries(metadata)) {
      if (metadataKey.length < 1 || metadataKey.length > 64 || typeof metadataValue !== 'string' || metadataValue.length > 500) {
        throw new Error(`Resource ${resource.id} metadata keys/values exceed their limits`)
      }
    }

    const protection = resource.protection === undefined
      ? { mode: 'metadata-only' }
      : resource.protection
    if (!isPlainObject(protection) || !PROTECTION_MODES.has(protection.mode)) {
      throw new Error(`Resource ${resource.id} has an invalid protection mode`)
    }

    return {
      id: resource.id,
      kind: resource.kind,
      key,
      name: resource.name,
      metadata: { ...metadata },
      protection: { mode: protection.mode }
    }
  })

  return { schemaVersion: 1, resources }
}

export function manifestToLegacyResources (manifest) {
  return {
    cores: manifest.resources
      .filter((resource) => resource.kind !== 'hyperdrive')
      .map((resource) => descriptorToLegacy(resource)),
    drives: manifest.resources
      .filter((resource) => resource.kind === 'hyperdrive')
      .map((resource) => descriptorToLegacy(resource))
  }
}

function descriptorToLegacy (resource) {
  return {
    key: resource.key,
    type: resource.kind,
    name: resource.name,
    resourceId: resource.id,
    metadata: resource.metadata,
    protection: resource.protection
  }
}

function isPlainObject (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
