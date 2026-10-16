import crypto from 'hypercore-crypto'
import b4a from 'b4a'
import { atomicWriteFile, runtimeFs, runtimePath, withStorageLock } from './runtime-files.js'

export const IDENTITY_FILE = 'identity.json'
export const IDENTITY_VERSION = 1

// A node's identity is its ed25519 key pair, and it must survive restarts:
// it is what an invite encodes, what the peer registry is keyed by, and what
// `joinPeer()` dials. Hyperswarm generates a random key pair when given no
// seed, which is why every 0.5 node changed public key on every boot.
export async function loadIdentity (storagePath) {
  const file = runtimePath.join(storagePath, IDENTITY_FILE)

  return withStorageLock(file, async () => {
    let seed = null
    try {
      const parsed = JSON.parse(await runtimeFs.readFile(file, 'utf8'))
      if (parsed?.version !== IDENTITY_VERSION) {
        throw new Error(`Unsupported identity version: ${parsed?.version}`)
      }
      if (typeof parsed.seed !== 'string' || !/^[0-9a-f]{64}$/i.test(parsed.seed)) {
        throw new Error('Identity file is corrupt: seed must be 32 bytes of hex')
      }
      seed = b4a.from(parsed.seed, 'hex')
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      seed = crypto.randomBytes(32)
      await atomicWriteFile(
        file,
        JSON.stringify({ version: IDENTITY_VERSION, seed: b4a.toString(seed, 'hex') }, null, 2)
      )
    }

    return fromSeed(seed)
  })
}

// Same primitive hyperdht uses (`crypto_sign_seed_keypair`), so a key pair
// derived here is interchangeable with `DHT.keyPair(seed)`.
export function fromSeed (seed) {
  const keyPair = crypto.keyPair(seed)
  return {
    seed,
    keyPair,
    publicKey: b4a.toString(keyPair.publicKey, 'hex')
  }
}

export function createIdentity () {
  return fromSeed(crypto.randomBytes(32))
}
