import b4a from 'b4a'
import crypto from 'hypercore-crypto'
import { PROTOCOL_VERSION } from './protocol.js'
import { InvalidOptionError } from './errors.js'
import { loadIdentity } from './identity.js'
import { InviteStore } from './invite-store.js'

export const INVITE_VERSION = 1
export const SECRET_BYTES = 16

// z-base-32: designed to be typed and read aloud by humans — no 0/l/v/2
// lookalikes. An invite is something a person copies between devices.
const ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769'

export function base32Encode (bytes) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode (text) {
  let bits = 0
  let value = 0
  const out = []
  for (const char of text.toLowerCase()) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) throw new InvalidOptionError(`Invalid character in invite code: ${char}`)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return b4a.from(out)
}

// The three values derived from an invite secret are domain-separated, so
// learning one never reveals another. In particular the topic is public — it
// is announced on the DHT — and must not leak the secret that authorises the
// pairing.
function derive (label, ...parts) {
  return crypto.hash(b4a.concat([
    b4a.from(`unstoppable:invite:${label}:v${PROTOCOL_VERSION}`),
    ...parts
  ]))
}

export function inviteTopic (secret) {
  return derive('topic', secret)
}

export function inviteId (secret) {
  return b4a.toString(derive('id', secret), 'hex').slice(0, 32)
}

// Binds the invite to this specific pair of authenticated identities, so a
// captured proof cannot be replayed by a third party who saw the topic.
export function inviteProof (secret, joinerPublicKey, hostPublicKey) {
  return b4a.toString(
    derive('proof', secret, toBuffer(joinerPublicKey), toBuffer(hostPublicKey)),
    'hex'
  )
}

export function createSecret () {
  return crypto.randomBytes(SECRET_BYTES)
}

export function encodeInvite ({ publicKey, secret }) {
  const key = toBuffer(publicKey)
  if (key.length !== 32) throw new InvalidOptionError('Invite public key must be 32 bytes')
  if (secret.length !== SECRET_BYTES) throw new InvalidOptionError(`Invite secret must be ${SECRET_BYTES} bytes`)
  return base32Encode(b4a.concat([b4a.from([INVITE_VERSION]), key, secret]))
}

export function decodeInvite (code) {
  if (typeof code !== 'string' || !code.trim()) {
    throw new InvalidOptionError('Invite code must be a non-empty string')
  }
  const bytes = base32Decode(code.trim().replace(/[\s-]/g, ''))
  if (bytes.length < 1 + 32 + SECRET_BYTES) {
    throw new InvalidOptionError('Invite code is truncated')
  }
  const version = bytes[0]
  if (version !== INVITE_VERSION) {
    throw new InvalidOptionError(`Unsupported invite version: ${version}`)
  }
  const publicKey = bytes.subarray(1, 33)
  const secret = bytes.subarray(33, 33 + SECRET_BYTES)
  return {
    version,
    publicKey: b4a.toString(publicKey, 'hex'),
    publicKeyBuffer: publicKey,
    secret,
    id: inviteId(secret),
    topic: inviteTopic(secret)
  }
}

function toBuffer (key) {
  if (typeof key === 'string') return b4a.from(key, 'hex')
  return b4a.isBuffer(key) ? key : b4a.from(key)
}


// Mint an invite against a storage directory without starting a node.
//
// This exists because `us node invite` runs in a separate, short-lived
// process while the daemon is running against the same directory. Building a
// full node there would derive the *same* identity key pair and stand up a
// second Hyperswarm server on it, fighting the daemon for its own DHT
// announcement. Writing the record and letting the daemon's watcher pick it
// up avoids that entirely.
export async function issueInvite ({
  storage,
  grants = null,
  uses = 1,
  expiresIn = 15 * 60_000,
  label = null
} = {}) {
  if (!storage) throw new InvalidOptionError('issueInvite() needs a storage directory')
  if (uses !== null && (!Number.isSafeInteger(uses) || uses < 1)) {
    throw new InvalidOptionError('Invite uses must be a positive integer or null for unlimited')
  }

  const identity = await loadIdentity(storage)
  const store = new InviteStore(storage)
  await store.ready()

  const secret = createSecret()
  const record = {
    id: inviteId(secret),
    label,
    grants,
    uses,
    used: 0,
    createdAt: new Date().toISOString(),
    expiresAt: expiresIn === null ? null : new Date(Date.now() + expiresIn).toISOString(),
    lastUsedAt: null,
    secret: b4a.toString(secret, 'hex')
  }
  await store.put(record)

  return {
    id: record.id,
    code: encodeInvite({ publicKey: identity.keyPair.publicKey, secret }),
    publicKey: identity.publicKey,
    expiresAt: record.expiresAt,
    uses,
    label
  }
}
