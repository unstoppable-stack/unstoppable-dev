---
name: add-p2p-sync
description: Extend replication in an existing generated app while preserving its storage and runtime boundaries.
---

# Extend P2P replication

Read the target app manifest and entrypoints. Node apps expose `src/swarm-manager.ts` and storage managers; desktop apps initialize networking/storage in `worker.js`; Expo uses `bare/index.js`. Do not assume old `SwarmManager` or `CorestoreManager` classes are included.

Reuse the existing swarm/store and replicate the appropriate store or Autobee on each connection. Keep peer errors/disconnections harmless to local reads. Await core/database readiness before using it; do not block app startup waiting for peers. Discovery announces availability and is not evidence that remote data has arrived.

For multi-writer data, use the app’s generated store, writer promotion and deterministic schema/apply policy. Replicated data and device-private state remain separate. For identity/pairing/grants, use node-core only when installed; it is not required for simple database replication.

Use installed APIs and https://docs.holepunch.to/ for detailed replication calls. Validate two real peers, reconnect, local reads offline, and convergence rather than merely matching generated code strings.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
