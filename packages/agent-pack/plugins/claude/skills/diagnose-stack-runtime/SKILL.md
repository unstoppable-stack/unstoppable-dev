---
name: diagnose-stack-runtime
description: Diagnose worker, native dependency, model lifecycle or IPC failures in an existing Unstoppable app.
---

# Diagnose the runtime

Read the app manifest and `us compatibility check -o <app>`. Identify the host, selected features, installed SDK/addon versions and maturity. Locate the generated entrypoints and session contract before changing dependencies.

Trace the failure boundary: renderer/preload/IPC, Bare worker, networking/storage, native import/addon, model download/load, inference, or shutdown. Preserve request IDs and session error codes. Networking/storage must remain useful when lazy AI initialization fails.

Use the smallest reproducer at the failing boundary. Keep mock output labeled. Verify native cancellation by stopping a real operation and successfully reusing the same model; token suppression is insufficient. Retry loads explicitly and avoid automatic replay after partial output. Test cached startup in a network-isolated run for offline claims.

Use installed types and version-matched upstream docs for engine-specific issues. Change the compatibility graph only through a deliberate migration; report evidence and unverified gates.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
