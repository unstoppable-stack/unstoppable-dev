---
name: add-encrypted-channels
description: Secure app messaging through P2P capability permissions and encrypted transport; custom channels are advanced.
---

# Secure P2P messaging

Use the installed `@unstoppable-stack/p2p` library for new messaging features.
Read `modules/p2p.mdc` and [RPC](../add-p2p-rpc/SKILL.md). Define app-owned send
mutations and event streams, validate their payloads, and grant methods through
scoped invitations. Persist messages locally if offline history is required.
Transport delivery alone does not provide offline queues or durable delivery.

The library already owns the encrypted Hyperswarm connection and Protomux.
Do not wrap it in another SecretStream or construct a second swarm for chat.
Encryption does not authorize every discovered peer: enforce pairing, explicit
grants and app policy. Topic names are public discovery, not secrets or ACLs.
Honor cancellation and bound message sizes and event production.

Reuse the existing node/session and worker IPC. Close owned resources on
shutdown. Test unauthorized calls, malformed payloads, stream cancellation,
disconnect/reconnect and persisted local history offline. Transport encryption
is not an at-rest encryption or identity-recovery claim.

Only for an existing custom wire protocol, inspect the actual connection/mux
contract and version-matched types before adding channels. The legacy resource
is not the library's pairing/grant protocol and must not replace it.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
