import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import b4a from 'b4a'
import { createTestEnv, echoPack } from './helpers.js'
import {
  base32Decode,
  base32Encode,
  createSecret,
  decodeInvite,
  encodeInvite,
  inviteProof,
  inviteTopic,
  issueInvite
} from '../src/invite.js'

describe('invite codes', () => {
  it('round-trips a public key and secret', () => {
    const publicKey = b4a.alloc(32, 3)
    const secret = createSecret()
    const decoded = decodeInvite(encodeInvite({ publicKey, secret }))

    assert.equal(decoded.publicKey, b4a.toString(publicKey, 'hex'))
    assert.equal(b4a.compare(decoded.secret, secret), 0)
  })

  it('tolerates whitespace and dashes people add when copying', () => {
    const code = encodeInvite({ publicKey: b4a.alloc(32, 4), secret: createSecret() })
    const pretty = `${code.slice(0, 8)}-${code.slice(8, 16)} ${code.slice(16)}`
    assert.equal(decodeInvite(pretty).publicKey, decodeInvite(code).publicKey)
  })

  it('uses an alphabet without ambiguous characters', () => {
    const code = encodeInvite({ publicKey: b4a.alloc(32, 5), secret: createSecret() })
    assert.equal(/[0lv2]/.test(code), false)
  })

  it('rejects malformed codes', () => {
    assert.throws(() => decodeInvite(''), { code: 'INVALID_OPTION' })
    assert.throws(() => decodeInvite('not!valid'), { code: 'INVALID_OPTION' })
    assert.throws(() => decodeInvite('ybnd'), { code: 'INVALID_OPTION' })
  })

  it('round-trips arbitrary bytes through base32', () => {
    for (const length of [1, 5, 16, 32, 49]) {
      const bytes = b4a.from(Array.from({ length }, (_, i) => (i * 37) % 256))
      assert.equal(b4a.compare(base32Decode(base32Encode(bytes)).subarray(0, length), bytes), 0)
    }
  })

  // The topic is announced on the DHT. If the secret could be recovered from
  // it, anyone watching could forge the proof.
  it('derives topic, id and proof independently from the secret', () => {
    const secret = createSecret()
    const topic = inviteTopic(secret)
    const proof = inviteProof(secret, 'aa'.repeat(32), 'bb'.repeat(32))

    assert.equal(topic.length, 32)
    assert.notEqual(b4a.toString(topic, 'hex'), proof)
    assert.notEqual(b4a.toString(topic, 'hex'), b4a.toString(secret, 'hex'))
  })

  it('binds the proof to both identities', () => {
    const secret = createSecret()
    const base = inviteProof(secret, 'aa'.repeat(32), 'bb'.repeat(32))
    assert.notEqual(base, inviteProof(secret, 'cc'.repeat(32), 'bb'.repeat(32)))
    assert.notEqual(base, inviteProof(secret, 'aa'.repeat(32), 'cc'.repeat(32)))
    assert.notEqual(base, inviteProof(createSecret(), 'aa'.repeat(32), 'bb'.repeat(32)))
  })
})

describe('pairing by invite', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  it('pairs two app-nodes that have never met', async () => {
    env = await createTestEnv()

    const host = await env.makeNode({
      profile: { appId: 'notes', appName: 'Notes' },
      capabilities: [echoPack('notes')]
    })
    await host.listen()

    const invite = await host.createInvite({ grants: { notes: ['ping'] } })
    assert.ok(invite.code.length > 0)

    const joiner = await env.makeNode({ profile: { appId: 'photos' } })
    const peer = await joiner.pair(invite.code)

    assert.equal(peer.publicKey, host.publicKey)
    assert.deepEqual(await peer.call('notes', 'ping', { value: 'invited' }), { pong: 'invited' })
  })

  // The whole point of an invite: the grants come from the person issuing it,
  // not from whatever the packs happen to expose by default.
  it('applies the invite grants instead of the pack defaults', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite({ grants: { notes: ['ping'] } })
    const joiner = await env.makeNode({})
    const peer = await joiner.pair(invite.code)

    assert.deepEqual(peer.grantsReceived, { notes: ['ping'] })
    await assert.rejects(() => peer.call('notes', 'count'), { code: 'NOT_GRANTED' })
  })

  it('bypasses the approval prompt, because the invite is the approval', async () => {
    env = await createTestEnv()
    let prompted = false
    const host = await env.makeNode({
      capabilities: [echoPack('notes')],
      pairing: { approve: async () => { prompted = true; return 'deny' } }
    })
    await host.listen()

    const invite = await host.createInvite()
    const joiner = await env.makeNode({})
    await joiner.pair(invite.code)

    assert.equal(prompted, false)
  })

  it('spends a single-use invite', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite({ uses: 1 })
    const first = await env.makeNode({})
    await first.pair(invite.code)
    assert.deepEqual(host.listInvites(), [])

    const second = await env.makeNode({})
    await assert.rejects(() => second.pair(invite.code, { timeout: 12_000 }), DEAD_INVITE)
  })

  it('honours a multi-use invite', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite({ uses: 2 })
    const first = await env.makeNode({})
    await first.pair(invite.code)
    const second = await env.makeNode({})
    await second.pair(invite.code)

    assert.equal(host.peerRegistry.list().length, 2)
  })

  // A dead invite has two correct outcomes, and which one a joiner sees is a
  // race with the host's watcher: if it has already stopped announcing the
  // topic the joiner finds nobody, otherwise it connects and is denied.
  // Asserting one specific code here would be asserting DHT timing.
  const DEAD_INVITE = (err) => {
    assert.ok(
      err.code === 'PAIR_DENIED' || err.code === 'PEER_NOT_FOUND',
      `expected the invite to be unusable, got ${err.code}`
    )
    return true
  }

  it('refuses an expired invite', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite({ expiresIn: 1 })
    await new Promise((resolve) => setTimeout(resolve, 20))

    assert.equal(host.listInvites().length, 0, 'the node no longer offers it')

    const joiner = await env.makeNode({})
    await assert.rejects(() => joiner.pair(invite.code, { timeout: 12_000 }), DEAD_INVITE)
  })

  it('refuses a revoked invite', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite()
    assert.equal(await host.revokeInvite(invite.id), true)
    assert.equal(host.listInvites().length, 0)

    const joiner = await env.makeNode({})
    await assert.rejects(() => joiner.pair(invite.code, { timeout: 12_000 }), DEAD_INVITE)
  })

  it('refuses a forged proof from someone who only knows the topic', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite()
    const decoded = decodeInvite(invite.code)

    // Same public key, wrong secret: this is what an observer of the DHT
    // topic could construct.
    // A forged secret derives a different topic, so the joiner never even
    // finds the host — and if it somehow did, the proof would not verify.
    const forged = encodeInvite({ publicKey: decoded.publicKeyBuffer, secret: createSecret() })
    const joiner = await env.makeNode({})
    await assert.rejects(() => joiner.pair(forged, { timeout: 12_000 }), DEAD_INVITE)
  })

  it('records the pairing method and invite id', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const invite = await host.createInvite()
    const joiner = await env.makeNode({})
    await joiner.pair(invite.code)

    const record = host.peerRegistry.get(joiner.publicKey)
    assert.equal(record.pairingMethod, 'invite')
    assert.equal(record.inviteId, invite.id)
  })

  it('keeps serving an outstanding invite across a restart', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('host-')

    const host = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    await host.listen()
    const invite = await host.createInvite({ expiresIn: 60_000 })
    await host.close()

    const restarted = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    await restarted.listen()

    const joiner = await env.makeNode({})
    const peer = await joiner.pair(invite.code)
    assert.equal(peer.publicKey, restarted.publicKey)
  })

  it('lists invites without leaking their secrets', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({})
    await host.listen()
    await host.createInvite({ label: 'phone' })

    const [listed] = host.listInvites()
    assert.equal(listed.label, 'phone')
    assert.equal(listed.secret, undefined, 'the secret never leaves the node')
  })
})

describe('invites created by another process', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  // `us node invite` writes to the storage directory rather than talking to a
  // running daemon, so the daemon has to notice invites it did not create.
  // issueInvite() deliberately starts no swarm: doing so would derive the
  // daemon's own identity key and fight it for its DHT announcement.
  it('serves an invite written to its storage by someone else', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('host-')

    const host = await env.makeNode({ storage, capabilities: [echoPack('notes')], inviteWatchMs: 300 })
    await host.listen()

    const invite = await issueInvite({ storage, expiresIn: 60_000 })
    assert.equal(invite.publicKey, host.publicKey, 'the code carries the running node identity')

    const joiner = await env.makeNode({})
    const peer = await joiner.pair(invite.code, { timeout: 25_000 })
    assert.equal(peer.publicKey, host.publicKey)
  })

  it('stops announcing an invite once it is revoked', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')], inviteWatchMs: 300 })
    await host.listen()

    const invite = await host.createInvite()
    assert.equal(host._servedInvites.size, 1)

    await host.revokeInvite(invite.id)
    await host._serveOutstandingInvites()
    assert.equal(host._servedInvites.size, 0, 'the topic is no longer announced')
  })
})
