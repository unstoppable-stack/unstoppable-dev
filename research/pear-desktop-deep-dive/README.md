# Pear Desktop Deep Dive

Research into building Pear Desktop applications — architecture, worker pattern, runtime constraints, and production patterns extracted from the QVAC Workbench Desktop reference app and our own battle-tested builds.

## Documents

| Document | What it covers |
|----------|---------------|
| [01-architecture-overview.md](./01-architecture-overview.md) | Two-process model, entry points, build pipeline, `package.json` pear config |
| [02-worker-pattern.md](./02-worker-pattern.md) | Why workers exist, when you need one, communication protocol, lifecycle |
| [03-bare-runtime-constraints.md](./03-bare-runtime-constraints.md) | What APIs are/aren't available, `bare-*` modules, common pitfalls |
| [04-pear-modules-catalog.md](./04-pear-modules-catalog.md) | Every `pear-*` module, what it does, when to use it |
| [05-build-tooling.md](./05-build-tooling.md) | SWC config, dev workflow, live reload, staging, deployment |
| [06-ui-patterns.md](./06-ui-patterns.md) | React in Pear, state management, styled-components, `<pear-ctrl>` |
| [07-critical-gotchas.md](./07-critical-gotchas.md) | Hard-won lessons from battle-tested builds (the "fixes" log) |
| [08-production-patterns.md](./08-production-patterns.md) | Router, schemas, handler/service separation, error handling, cleanup |
| [PRESENTATION.md](./PRESENTATION.md) | Executive summary — the 10 things you need to know |

## Sources

- `reference-apps/qvac-workbench-desktop/` — Production Pear Desktop app by Tether/QVAC
- `sandbox/coffee-assistant-ui/fixes/` — 6 critical fixes from our own build
- https://docs.holepunch.to — Pear official documentation
- Pear module READMEs on GitHub (holepunchto org)
