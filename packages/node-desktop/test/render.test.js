import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  capabilityPills,
  commands,
  escape,
  formatBytes,
  formatCapabilitySummary,
  formatLastActivity,
  inviteRows,
  parseByteAmount,
  peerLabel,
  peerRows,
  short,
  storageRows,
  summaryCounts
} from '../app/render.js'

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

function status (overrides = {}) {
  return {
    peers: [],
    cores: [],
    drives: [],
    connectedPeers: 0,
    capabilities: { sync: { version: 1, methods: [] } },
    ai: { ready: false },
    storage: { total: 0, perOwner: {}, quotas: { perPeer: {} } },
    trust: { approved: {} },
    invites: [],
    ...overrides
  }
}

describe('formatting', () => {
  it('formats byte sizes', () => {
    assert.equal(formatBytes(0), '0 B')
    assert.equal(formatBytes(-1), '0 B')
    assert.equal(formatBytes(512), '512 B')
    assert.equal(formatBytes(1536), '1.5 KB')
    assert.equal(formatBytes(1024 ** 3), '1.0 GB')
  })

  it('parses human byte amounts and rejects nonsense', () => {
    assert.equal(parseByteAmount('500 MB'), 500 * 1024 ** 2)
    assert.equal(parseByteAmount('5gb'), 5 * 1024 ** 3)
    assert.equal(parseByteAmount('1024'), 1024)
    assert.equal(parseByteAmount('lots'), null)
    assert.equal(parseByteAmount('-5 MB'), null)
  })

  it('shortens keys without mangling short strings', () => {
    assert.equal(short(KEY_A), 'aaaaaaaa…aaaa')
    assert.equal(short('short'), 'short')
    assert.equal(short(undefined), '')
  })

  it('escapes HTML in peer-controlled strings', () => {
    assert.equal(escape('<script>&"\''), '&lt;script&gt;&amp;&quot;&#39;')
  })

  it('describes grants in plain language, falling back to wire names', () => {
    assert.equal(
      formatCapabilitySummary({ sync: ['status'], ai: ['completion.stream'] }),
      'view its own protection status, use AI on this computer'
    )
    assert.equal(formatCapabilitySummary({ custom: ['thing'] }), 'custom: thing')
    assert.equal(formatCapabilitySummary(null), '')
  })

  it('reports last activity relative to now', () => {
    const now = Date.parse('2026-08-18T12:00:00Z')
    assert.equal(formatLastActivity([], now), 'waiting for first sync')
    assert.equal(formatLastActivity([{ lastSync: now - 30_000 }], now), 'active just now')
    assert.equal(formatLastActivity([{ lastSync: now - 300_000 }], now), 'active 5m ago')
    assert.equal(formatLastActivity([{ lastSync: now - 7_200_000 }], now), 'active 2h ago')
  })
})

describe('peer rows', () => {
  // The core of the re-keying: resources belong to a public key, so two
  // devices running one app must not pool their data.
  it('attaches resources by owner key, not appId', () => {
    const rows = peerRows(status({
      peers: [
        { publicKey: KEY_A, appId: 'notes', appName: 'Notes', deviceName: 'laptop' },
        { publicKey: KEY_B, appId: 'notes', appName: 'Notes', deviceName: 'phone' }
      ],
      cores: [
        { owner: KEY_A, key: 'c1', length: 5, peers: 2 },
        { owner: KEY_B, key: 'c2', length: 9, peers: 1 }
      ],
      storage: { total: 0, perOwner: { [KEY_A]: 100, [KEY_B]: 700 }, quotas: { perPeer: {} } }
    }))

    assert.equal(rows.length, 2)
    assert.deepEqual(rows.map((r) => r.cores.length), [1, 1])
    assert.equal(rows[0].entries, 5)
    assert.equal(rows[1].entries, 9)
    assert.equal(rows[0].bytes, 100)
    assert.equal(rows[1].bytes, 700)
    assert.deepEqual(rows.map((r) => r.deviceName), ['laptop', 'phone'])
  })

  it('labels a peer by name, then appId, then key', () => {
    assert.equal(peerLabel({ publicKey: KEY_A, appName: 'Notes', appId: 'notes' }), 'Notes')
    assert.equal(peerLabel({ publicKey: KEY_A, appId: 'notes' }), 'notes')
    assert.equal(peerLabel({ publicKey: KEY_A }), short(KEY_A))
  })

  it('reports protection state from the peer\'s own resources', () => {
    const [connected, paused, isProtected] = peerRows(status({
      peers: [{ publicKey: KEY_A }, { publicKey: KEY_B }, { publicKey: 'c'.repeat(64) }],
      cores: [
        { owner: KEY_B, key: 'c1', paused: true },
        {
          owner: 'c'.repeat(64),
          key: 'c2',
          paused: false,
          protection: { mode: 'mirror', state: 'protected' }
        }
      ]
    }))
    assert.equal(connected.state, 'connected')
    assert.equal(paused.state, 'paused')
    assert.equal(paused.allPaused, true)
    assert.equal(isProtected.state, 'protected')
  })

  it('does not call pending, copying, metadata-only, or failed resources protected', () => {
    const peers = [
      { publicKey: KEY_A },
      { publicKey: KEY_B },
      { publicKey: 'c'.repeat(64) },
      { publicKey: 'd'.repeat(64) }
    ]
    const rows = peerRows(status({
      peers,
      cores: [
        { owner: KEY_A, key: 'pending', protection: { mode: 'mirror', state: 'pending' } },
        { owner: KEY_B, key: 'copying', protection: { mode: 'mirror', state: 'syncing' } },
        { owner: 'c'.repeat(64), key: 'metadata', protection: { mode: 'metadata-only', state: 'metadata-only' } },
        { owner: 'd'.repeat(64), key: 'failed', protection: { mode: 'mirror', state: 'error' } }
      ]
    }))

    assert.deepEqual(rows.map((row) => row.state), ['pending', 'copying', 'pending', 'error'])
  })

  it('surfaces the per-peer quota and its default', () => {
    const [explicit, fallback] = peerRows(status({
      peers: [
        { publicKey: KEY_A, quotaBytes: 2048 },
        { publicKey: KEY_B }
      ],
      storage: {
        total: 0,
        perOwner: {},
        quotas: { perPeer: { [KEY_B]: { limit: 4096, exceeded: true } } }
      }
    }))
    assert.equal(explicit.quotaLabel, '2.0 KB')
    assert.equal(fallback.quotaLabel, '4.0 KB default')
    assert.equal(fallback.quotaExceeded, true)
  })

  it('reads AI permission from the grants the node gave the peer', () => {
    const [granted, blocked, unknown] = peerRows(status({
      peers: [
        { publicKey: KEY_A, grantsGiven: { ai: ['completion.stream'] } },
        { publicKey: KEY_B, grantsGiven: { sync: ['status'] } },
        { publicKey: 'c'.repeat(64) }
      ]
    }))
    assert.equal(granted.aiGranted, true)
    assert.equal(blocked.aiGranted, false)
    assert.equal(unknown.grants, null, 'no grants means no toggle is rendered')
  })

  it('marks trust from the approval registry', () => {
    const [trusted, untrusted] = peerRows(status({
      peers: [{ publicKey: KEY_A }, { publicKey: KEY_B }],
      trust: { approved: { [KEY_A]: {} } }
    }))
    assert.equal(trusted.trusted, true)
    assert.equal(untrusted.trusted, false)
  })

  it('builds peek targets from cores and drives', () => {
    const [row] = peerRows(status({
      peers: [{ publicKey: KEY_A }],
      cores: [{ owner: KEY_A, key: 'c1', name: 'Data', type: 'hyperbee' }],
      drives: [{ owner: KEY_A, key: 'd1', name: 'Files' }]
    }))
    assert.deepEqual(row.peekTargets, [
      { kind: 'core', key: 'c1', name: 'Data', type: 'hyperbee' },
      { kind: 'drive', key: 'd1', name: 'Files' }
    ])
  })
})

describe('storage rows', () => {
  it('reports each peer\'s own bytes and limit', () => {
    const rows = storageRows(status({
      peers: [{ publicKey: KEY_A, appName: 'Notes' }],
      storage: {
        total: 0,
        perOwner: { [KEY_A]: 4096 },
        quotas: { perPeer: { [KEY_A]: { limit: 8192, exceeded: false } } }
      }
    }))
    assert.deepEqual(rows, [{
      publicKey: KEY_A,
      label: 'Notes',
      deviceName: 'This app',
      bytes: 4096,
      limit: 8192,
      exceeded: false
    }])
  })
})

describe('capability pills', () => {
  // The 0.5 `services` flags conflated "capability exists" with "model
  // loaded", so a node whose AI failed looked like it had no AI at all.
  it('shows AI as off rather than absent when no model is loaded', () => {
    const pills = capabilityPills(status({
      capabilities: { sync: {}, ai: {} },
      ai: { ready: false }
    }))
    assert.deepEqual(pills, [
      { label: 'Data & files ready', on: true },
      { label: 'AI off', on: false }
    ])
  })

  it('shows AI ready once a model is loaded', () => {
    const pills = capabilityPills(status({ capabilities: { sync: {}, ai: {} }, ai: { ready: true } }))
    assert.equal(pills[1].label, 'AI ready')
    assert.equal(pills[1].on, true)
  })

  it('omits capabilities the node does not host', () => {
    assert.deepEqual(capabilityPills(status({ capabilities: { sync: {} } })), [
      { label: 'Data & files ready', on: true }
    ])
  })
})

describe('invite rows', () => {
  it('reports remaining uses and expiry', () => {
    const rows = inviteRows(status({
      invites: [
        { id: 'i1', label: 'phone', uses: 5, used: 2, expiresAt: '2026-08-18T12:00:00.000Z' },
        { id: 'i2', label: null, uses: null, used: 9, expiresAt: null }
      ]
    }))
    assert.equal(rows[0].uses, '3 of 5 left')
    assert.equal(rows[0].label, 'phone')
    assert.equal(rows[1].uses, 'unlimited')
    assert.equal(rows[1].label, 'Pairing code')
    assert.equal(rows[1].expiry, 'never expires')
  })
})

describe('summary counts', () => {
  it('counts peers, resources and connections', () => {
    assert.deepEqual(summaryCounts(status({
      peers: [{ publicKey: KEY_A }],
      cores: [{ owner: KEY_A }, { owner: KEY_A }],
      drives: [{ owner: KEY_A }],
      connectedPeers: 1,
      storage: { total: 2048, perOwner: {}, quotas: { perPeer: {} } }
    })), { peers: 1, cores: 2, drives: 1, connected: 1, bytes: 2048 })
  })

  it('survives an empty snapshot', () => {
    assert.deepEqual(summaryCounts({}), { peers: 0, cores: 0, drives: 0, connected: 0, bytes: 0 })
  })
})

// A typo in a command type is silently dropped by the main-process allowlist,
// so the wire names are worth asserting.
describe('command payloads', () => {
  it('addresses peers by public key', () => {
    assert.deepEqual(commands.unpair(KEY_A, 'Notes'), { type: 'unpair', publicKey: KEY_A, appName: 'Notes' })
    assert.deepEqual(commands.pausePeer(KEY_A), { type: 'pause-peer', publicKey: KEY_A })
    assert.deepEqual(commands.resumePeer(KEY_A), { type: 'resume-peer', publicKey: KEY_A })
    assert.deepEqual(commands.setPeerQuota(KEY_A, 1024), { type: 'set-peer-quota', publicKey: KEY_A, quotaBytes: 1024 })
    assert.deepEqual(commands.setPeerGrant(KEY_A, 'ai', []), {
      type: 'set-peer-grant', publicKey: KEY_A, capability: 'ai', methods: []
    })
    assert.deepEqual(commands.promoteTrust(KEY_A, 'Notes'), { type: 'promote-trust', publicKey: KEY_A, appName: 'Notes' })
  })

  it('builds invite commands', () => {
    assert.deepEqual(commands.createInvite({ expiresIn: 900000, uses: 1 }), {
      type: 'create-invite', expiresIn: 900000, uses: 1
    })
    assert.deepEqual(commands.revokeInvite('i1'), { type: 'revoke-invite', id: 'i1' })
  })
})
