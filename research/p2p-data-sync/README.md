# P2P Data Sync Deep Dive

Research into building P2P applications with data synchronization across devices — storage primitives, sync strategies, when P2P works vs when you need centralized solutions, and how to architect the Unstoppable Vault.

## Documents

| Document | Covers |
|----------|--------|
| [01-holepunch-data-stack.md](./01-holepunch-data-stack.md) | Hypercore, Hyperbee, HyperDB, Autobase, Corestore, Hyperdrive — what each does, when to use it |
| [02-sync-strategies.md](./02-sync-strategies.md) | Single-writer vs multi-writer, availability patterns, conflict resolution |
| [03-data-vs-files.md](./03-data-vs-files.md) | Structured data (Hyperbee/HyperDB) vs files (Hyperdrive), choosing the right tool |
| [04-when-centralized.md](./04-when-centralized.md) | Cases where P2P alone isn't enough — registry servers, always-on seeding, the QVAC model registry pattern |
| [05-keet-architecture.md](./05-keet-architecture.md) | How Keet handles fully P2P chat, multi-device sync, and availability |
| [06-vault-architecture.md](./06-vault-architecture.md) | Recommended architecture for the Unstoppable Vault based on all findings |
| [07-hyperblobs-and-storage-comparison.md](./07-hyperblobs-and-storage-comparison.md) | Hyperblobs explained, Hyperbee vs HyperDB decision guide, the QVAC registry storage pattern |
| [PRESENTATION.md](./PRESENTATION.md) | Markdown summary of key findings |

## Sources

- Holepunch GitHub repos: hypercore, hyperbee, hyperdb, autobase, hyperdrive, hyperswarm, corestore
- `planning/features/vault.md` + `vault-technical.md` — Vault specs
- `research/qvac-examples/` — QVAC SDK registry and delegated inference patterns
- `reference-apps/qvac-workbench-desktop/` — Autobase usage in production
- Keet.io — Fully P2P chat app by Holepunch
