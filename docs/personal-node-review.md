# Personal Node desktop review

Reviewed against the working tree on 20 October 2026. This is a source and local
test review, not signed-release, native-model, or cross-platform acceptance.

## Product decision

Keep Personal Node Desktop as an optional first-party application and reference
composition. It gives users a persistent place for replication and permitted
compute, while independent apps retain their own UI, local data, and offline use.
It remains a deferred alpha outside the core preview.

Support two developer paths:

1. Integrate an app with the existing Personal Node through the shared P2P
   protocol, explicit grants, and declared resources.
2. Build an app-specific desktop product using the same library and the desktop
   shell as a reference. Keep domain UI, schemas, and handlers in that product.

Do not promise automatic compatibility for arbitrary apps. A supported runtime,
matching protocol/service versions, shared schemas, encryption access, writer
rules, and explicit user permission are necessary. Replication copies resources;
it does not make their meaning or functionality available to other apps.
The current desktop is not a supported white-label generator.

## What is already substantial

- [PersonalNode](../packages/node/src/personal-node.js) composes the shared P2P
  library, sync pack, optional AI adapter, and local operator policy. There is
  no need to invent another ecosystem transport.
- [Electron main](../packages/node-desktop/electron/main.js) owns windows, tray,
  single-instance handling, and the Bare sidecar. Renderer sandboxing and a
  restricted preload boundary keep inference and P2P out of the renderer.
- The dashboard provides pairing approvals, revocation, invitations, resource
  state, quotas, AI controls, and settings import/export.
- Mirror status distinguishes a locally verified checkpoint from registration.
  Quotas are logical admission budgets, not hard disk limits.
- Packaging configuration, native pruning, fuse inspection, packaged smoke
  scripts, and an approval-gated signing workflow exist. Their existence is not
  evidence that a candidate passed all release gates.

## Findings and proposed priorities

| Priority | Finding and evidence | Improvement and acceptance |
| --- | --- | --- |
| P1 | [Settings export](../packages/node/src/export.js) includes the identity seed in plaintext. The [dashboard](../packages/node-desktop/app/index.js) describes settings/trust/app records without making that identity sensitivity explicit in the export copy. | Make identity inclusion visible before export; design encrypted recovery separately. Verify the user understands what the file can restore and what authority it contains. |
| P1 | Settings export excludes payloads; unpairing retains downloaded blocks. There is no complete recovery or per-app purge contract. See [Node boundaries](../packages/node/README.md). | Define retention, shared-resource ownership, identity recovery, and restore before using “backup” as a product promise. Demonstrate recovery on a fresh profile from an offline source, including partial/stale data and failed restore. |
| P1 | Shared transport and typed RPC exist, but they do not establish ecosystem data compatibility. The [capability inventory](../packages/p2p/docs/roadmap.md) leaves schema migration and database hosting acceptance open. | Build two independent sample apps sharing one versioned contract, with an optional Personal Node. Test granted/denied access, incompatible schemas, offline edits, restart, reconnection, revocation, and cancellation. Do not claim multi-writer + Node sync support yet. |
| P2 | [Main process](../packages/node-desktop/electron/main.js) emits `fatal` on unexpected worker exit; the [renderer](../packages/node-desktop/app/index.js) always labels it “Node failed to start.” No restart flow is exposed there. | Distinguish startup failure from interrupted service, disable unavailable controls, and offer bounded explicit restart. Test a crash after ready and ensure no duplicate worker or storage owner. |
| P2 | [Sidecar host](../packages/node-desktop/electron/sidecar-host.js) accumulates newline-delimited output without a frame limit and decodes chunks separately. This is a local worker robustness issue, not demonstrated remote exploitability. | Bound buffered frames and use streaming UTF-8 decoding. Test an oversized unterminated frame and multibyte text split across chunks. |
| P2 | Invitation primitives exist, but complete QR/device-code linking and recovery UX are unfinished. | Deliver one end-to-end second-device journey with expiry, denial, reconnect, lost identity, and clear owner consent. Test on physical devices. |
| Release gate | Real-model and signed packaged platform acceptance remain separate from source tests. | Run the documented model loading, interruption/reuse, cached offline, packaged execution, and signing checks per target platform; attach results to the exact candidate. |

The Node README also contained a stale comment claiming omitted approval callbacks
auto-approved peers, a legacy Pear dashboard label, and an old QVAC test install
version. These were corrected in this review; no runtime behavior was changed.

## Delivery order

### Implemented follow-up: two-app example

The [Notebook + Briefing example](../examples/personal-node-ecosystem/README.md)
now proves scoped domain RPC and shared single-writer data through Personal Node.
Five integration tests passed locally, including a restarted desktop Bare daemon
serving a fresh reader while Notebook is stopped. The example also checks
permissions, versions, cancellation, offline edits/reopen, and reconnection.
CI is wired for the runtime and desktop platform matrices. A subsequent
[dashboard acceptance runner](../scripts/personal-node-dashboard-e2e.mjs) verified
actual Electron pairing, both apps connected with verified copies, source-offline
retrieval, pause/resume, and updated reports after offline edits on one macOS
machine. It also exposed and fixed misleading invitation/connection labels.
Cross-device, signed-release, encryption/key rotation, and general ecosystem
schema migration remain outside this evidence.

First clarify the product and expose the desktop on the website. Then build the
two-app compatibility example and improve identity-export and worker-failure UX.
Follow with linking and recovery/retention acceptance. Promote desktop releases
only after the signed artifact and native-model gates pass. Extract reusable
shell scaffolding after a second real desktop app proves which pieces should be
shared; avoid introducing another framework in advance.

## Validation in this review

- Desktop package tests: 68 passed, 1 skipped (optional daemon-sidecar E2E).
  The suite includes the pinned QVAC API import in Bare; it does not load a model.
- Personal Node package tests: 43 passed, 1 skipped (opt-in real QVAC).
  The initial sandbox run could not bind localhost sockets; rerunning with
  local networking permitted passed.
- No real-model, signed installer, packaged-app, physical-device, or full
  offline acceptance was performed. See [validation commands](validation.md).
