# Personal Node local management API

> Deferred, unpublished `0.6.0-alpha.1` composition. Reviewed 16 October 2026.
> Published `unstoppable-node@0.4.0` has a different API.

`PersonalNode` composes the [P2P runtime](../../p2p/docs/api.md),
its [sync pack](../../p2p/docs/sync.md), an [internal AI adapter](ai.md),
configuration and operator policy. The [desktop shell](../../node-desktop/README.md)
and daemon CLI drive this local object. These methods are not remote capability
methods and must not be exposed to arbitrary paired apps.

```js
import { PersonalNode } from 'unstoppable-node/personal-node'

const host = new PersonalNode('./.personal-node', {
  approvePairing: async (request) => 'deny' // replace with an operator decision
})
await host.start()
try {
  const invite = await host.createInvite({
    grants: { sync: ['manifest.replace', 'status', 'usage'] }, uses: 1
  })
  console.log(invite.code) // share only with the intended peer
  const status = await host.getStatus()
} finally {
  await host.close()
}
```

## Operator methods

| Methods | Scope |
| --- | --- |
| `start()`, `close()`, `publicKey` | Process lifecycle and host identity |
| `getStatus()` | Node-wide peers, resources, quotas, invitations and AI readiness |
| `getConfig()`, `updateConfig(patch)` | Persisted settings; AI changes apply live |
| `enableAI(options)`, `disableAI()` | Host model lifecycle; data-only hosts need no QVAC |
| `setPeerQuota(key, bytesOrNull)` | Per-peer storage policy |
| `setPeerGrant(key, capability, methods)` | Methods a peer may call; removes active access when revoked |
| `pausePeer(key)`, `resumePeer(key)` | Operator replication control; resume checks quota admission |
| `unpairPeer(key)` | Persistent denial and removal from active replication |
| `getDiskUsage()` | Physical host storage usage and path; remote peers receive logical own-resource usage instead |
| `createInvite(options)`, `listInvites()`, `revokeInvite(id)` | Scoped device invitation administration |
| `peekCore(key, options)`, `peekDrive(key, options)` | Node-wide bounded diagnostics |
| `exportState(path)`, `importState(path)` | Settings, peer metadata, identity seed and revocation records; no replicated payload backup |

Quotas pause replication and gate registration/resume. They do not stop an app
writing locally, erase existing bytes or impose a hard filesystem allocation
limit. Unpairing revokes access and removes active resource registrations;
downloaded blocks can remain on disk. There is no per-peer purge workflow.

## Remote surface

Paired peers see only granted `sync` methods and, when enabled and granted,
`ai.completion.stream`. Sync methods infer ownership from the authenticated
peer key. `getStatus()`, config updates, all-peer disk usage and state export
are operator calls, not members of `peer.api`.

For new shared services, use the existing P2P capability bus and consult the
[capability inventory](../../p2p/docs/roadmap.md). Keep native providers and
host policy with the application unless a reusable, validated contract justifies
extraction. The [validation guide](../../../docs/validation.md) separates
protocol/mock checks from native inference and packaged desktop acceptance.
