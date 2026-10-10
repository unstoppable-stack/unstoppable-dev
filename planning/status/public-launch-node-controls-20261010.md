# Personal Node trust and resource controls — 10 October 2026

Baseline: merged mobile PR #9, `a85172ba11288e7ad70433a58f5d6d3b8a317f6e`. Implementation is isolated on `codex/node-trust-resource-controls`; original checkout edits are preserved.

## Result

Unknown peers cannot acquire capabilities merely by reaching a public key or shared discovery topic. Core and headless hosts require explicit approval or scoped invitations. Desktop approval requests expire after 30 seconds and are bounded to 32 pending requests. Automatic acceptance requires an explicit development option; local discovery does not identify a trusted caller.

Persisted grants remain a ceiling across reconnect/restart. Grant removal aborts affected active requests, including real native inference. Unpairing persistently denies the key, including attempts using a new invitation; an operator must explicitly forget the denial. Revocations are retained in settings exports and revoked resource manifests are not restored.

## Resource boundaries

| Boundary | Default |
| --- | --- |
| Control peers / JSON frame | 128 / 256 KiB |
| Concurrent requests per peer / node | 8 / 64 |
| Capability request deadline | 120 seconds |
| Consumer queue / stream output | 64 chunks and 1 MiB / 1 MiB |
| AI concurrency / messages / prompt | 1 / 64 / 64 KiB UTF-8 JSON |
| AI output / deadline | 256 KiB / 60 seconds |
| Manifest resources per peer / node | 128 / 512 |
| New Personal Node storage quotas | 1 GiB per peer / 10 GiB global |

Stream producers respect transport drain; slow consumers fail and cancel rather than accumulating an unbounded queue. Overload is refused with RESOURCE_LIMIT. Request slots remain occupied until handlers actually stop: cancellation cannot forcibly preempt an uncooperative plugin.

Storage admission checks apply before registration/resume and each download pass; a background check pauses exceeded quotas without dashboard polling. Download ranges can be canceled. Quotas are logical soft limits: metadata/in-flight data can exceed them, blocks are retained, and raw Corestore replication is not a capability-grant privacy boundary. Explicit existing unlimited settings remain compatible. Native CPU/RAM pressure and hard disk enforcement remain future work.

## Validation

[Retained evidence](evidence/20261010-node-controls/) identifies the tested working tree and packed artifacts.

- Full core, sync, AI, Personal Node and desktop regressions pass: 205 passed, 2 opt-in skips. Results are in `regression-tests.log`; both native inference and sidecar checks pass in separate runs.
- Real SDK 0.21 inference passes completion, cancellation/reuse and active grant revocation with an existing Qwen3.5 model.
- Two actual Bare headless demo runs pass with mocked AI and real transport/storage; real desktop Bare sidecar startup/shutdown also passes.
- Four tarballs install and compose a scoped-invitation P2P consumer outside the repository. No registry publication is claimed.
- Release metadata, workflow syntax and agent-pack source/bundled parity pass. A new Linux/macOS/Windows CI lane exercises trust/resource regressions; hosted results are linked on the PR.

The updated asset sync script and runtime/compatibility sources exist only in the original checkout's unmerged work, not this main baseline. They were preserved. This branch's canonical skill changes and bundled copies match using the existing parity checker.

## Release implications

This closes the focused PRJ-05 engineering gaps and makes unattended Node use safer and more predictable. Personal Node remains a deferred alpha: public registry installation, hard resource-pressure testing, retention/deletion, data recovery and upgrade/update strategy still need separate acceptance. Physical mobile inference and Android execution remain outside this task. Human-dependent launch gates remain set aside. The frozen desktop CLI candidate and checksum are unchanged.
