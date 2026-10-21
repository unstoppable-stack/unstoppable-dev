---
name: add-database
description: Choose managed collaborative JSON or preserve an existing schema database without inventing HyperDB APIs.
---

# Add a shared database

For new shared JSON records use `@unstoppable-stack/p2p/data` (alpha.2 or later):
`openCollection` for one writer, `openCollaborativeDatabase` for approved writers.
Read `modules/p2p.mdc`, `modules/managed-data.mdc` and
[multi-writer sync](../add-multi-writer-sync/SKILL.md).
The managed API owns storage/discovery/cleanup. Do not install HyperDB,
Corestore and Hyperswarm just to share JSON records.

Collaborative data requires explicit `autobase@7.28.2` opt-in as documented by
the installed P2P package. The founder admits verified writer keys; joiners
wait for writable state. Deterministic JSON replacement is not text merging,
indexed queries, schema migration, lost-admin recovery or complete backup.
Collaboration remains experimental and the founder is the sole indexer.

For a custom deterministic reducer/view use the installed `/db` contract and
document its runtime acceptance. For an existing generated HyperDB/Autobee
store, preserve its actual engine, schema builder, apply policy and app-owned
queries. HyperDB does not itself supply collaborative writer membership.
Do not invent `new HyperDB(store, schema)`, `find({ field })` or conflict-head
APIs from generic examples. Inspect installed types and schema artifacts.
Autobee and Autobase have different APIs and are not interchangeable.

Keep device-private state separate and native storage in the worker/Node
boundary. Test offline local edits, persistence, writer admission/removal,
reconnect and convergence with the app's real data model. Contract tests do not
establish Bare/mobile database or backup acceptance.
