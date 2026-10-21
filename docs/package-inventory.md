# Package inventory

This inventory records the October 21, 2026 source cleanup. A package does not
need its own npm release to belong on main: build inputs, generated-app runtime
helpers, documentation and the retained Personal Node application are needed too.

| Directory on main | Why it stays |
| --- | --- |
| `packages/cli` | Published CLI; assistant setup, scaffolding and checks |
| `packages/p2p` | Published P2P library; used by generated apps and examples |
| `packages/agent-pack` | Canonical assistant guidance, CLI bundle inputs and Claude/Codex plugin builds |
| `packages/runtime-ai` | Maintained private runtime vendored into generated apps by asset synchronization |
| `packages/website` | Public documentation, website and plugin downloads |
| `packages/node` | Personal Node application; current alpha remains deferred, retained for ongoing development |
| `packages/node-desktop` | Personal Node desktop shell and platform packaging; retained with its CI and release gates |

## Deferred development branch

The branch [`codex/deferred-package-development`](https://github.com/unstoppable-stack/unstoppable-dev/tree/codex/deferred-package-development)
preserves the complete pre-cleanup tracked source at commit
`28adb47efd97dd33c9929ac9ac1409766e9216bd`, including:

| Removed directory | Reason |
| --- | --- |
| `packages/memory` | Private experimental engine, excluded from the canonical release |
| `packages/memory-client` | Private Memory integration, used only by the deferred Memory stack |
| `packages/memory-mcp` | Private experimental MCP service for Memory |
| `packages/memory-desktop` | Private desktop experiment depending on the other Memory packages |
| `packages/node-caps-ai` | License-only remnant; implementation already consolidated into Personal Node |
| `packages/node-caps-sync` | License-only remnant; implementation already consolidated into P2P |

The branch is a development starting point, not a maintained release or a claim
that native inference or desktop acceptance passed. Work on it in a separate
checkout:

```sh
git fetch origin
git worktree add ../unstoppable-deferred codex/deferred-package-development
```

Restore selected source through a reviewed change when its contracts, consumers,
dependencies and validation are ready. Do not merge the entire historical
snapshot back into main. The internal full CLI profile retains its experimental
Memory command for separately installed Memory source; the published minimal CLI
does not expose it. Personal Node's release gate no longer requires archived
Memory manifests. The public release exclusion list remains in place.

## Local-only folders

`packages/agent`, `packages/search` and `packages/remote-app` were already ignored
and had no tracked files in the pre-cleanup snapshot. `packages/templates` was
an empty local directory; the CLI's real templates remain in `packages/cli/templates`.
These local folders were preserved outside `packages/` on the maintainer's machine.
They are not included in the development branch, and their presence must not be
assumed by public builds or documentation.
