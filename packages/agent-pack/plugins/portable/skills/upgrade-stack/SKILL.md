---
name: upgrade-stack
description: Review and migrate an existing Unstoppable app compatibility profile while preserving application changes.
---

# Upgrade an app profile

Discover the app with `us compatibility list -o <workspace>` and read its metadata, package.json and lockfile. Run `us compatibility check -o <app>`; this command is read-only and reports profile, dependency, lockfile and vendored-runtime differences.

Separate intentional app edits from upstream compatibility changes. Compare installed types and version-matched release notes. Migrate the adapter and native dependency graph together, preserving prompts, UI, domain schemas and local data. Old apps without metadata need explicit identification of their current graph before adopting a profile.

Never use `us scaffold app --force` to upgrade an edited app. Do not silently replace a modified vendored runtime. Apply reviewed differences in a branch and run actual install/runtime gates, including missing-addon failure, Stop/reuse, shutdown and cached offline startup for AI. Expo needs its own physical-device gates.

Update the recorded profile/runtime/model metadata only after validating the migration. A matching declaration range does not certify every resolved graph or native platform. Report any acceptance gate that remains unverified.

## Upgrade each distribution layer

An agent-pack update changes guidance; a CLI update changes future scaffolds. Neither upgrades an existing app or packaged desktop/mobile worker. Inspect the app manifest, lockfile, actual installed dependency and bundled artifact separately. Replace temporary local-package overrides with the intended published version and a reproducible lockfile before claiming the migration is durable. Do not treat a source hash alone as validation of the entire native graph.

For P2P changes, retain the saved identity and data, rebuild affected worker/native packages, and verify fresh content after disconnect/reconnect with [device sync diagnosis](../diagnose-stack-runtime/resources/device-sync.md). A new npm library release does not change an already-installed desktop binary or OTA channel until its app release is rebuilt and distributed. Keep CLI, plugin, library and app publication status separate.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
