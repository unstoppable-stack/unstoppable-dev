---
name: build-with-unstoppable
description: Build or extend a local-first app with the Unstoppable Stack; select its runtime, discover existing app contracts, and route scaffolding, P2P, storage, local AI, diagnosis or upgrades.
---

# Build with the Unstoppable Stack

Use this workflow for an app idea or an existing stack project. Reuse the user's chosen product and prior decisions. Clarify only missing choices that change the implementation.

## Find the target and tooling

Inspect the workspace instructions, package.json and `.unstoppable/project.json` files. A workspace may contain several apps: select the target directory before interpreting its profile. Without metadata, inspect entrypoints, installed dependencies and runtime before recommending adoption or migration.

Check `us --version` and `us --help`. If available, run `us compatibility list -o <workspace>` and inspect `us scaffold list-platforms` / `us scaffold list-features` for the installed CLI's actual catalog. Missing commands indicate a different CLI release; do not assume the plugin's catalog is executable. For a missing or older CLI, read [CLI installation](resources/install-cli.md). It records the matching candidate and its pinned source-install route; do not install `latest` as a substitute. Plugin installation supplies guidance, not native dependencies or model weights.

If project-local skills/guidance already exist, identify overlap with this installed pack. Preserve local instructions and edited files; prefer the target's recorded contract and installed types over generic or newer guidance. Updating this plugin does not update an app's vendored runtime.

## Choose the relevant workflow

- New target: [scaffold-project](../scaffold-project/SKILL.md). Scaffold into a new directory with the installed CLI, then read the generated README, scripts and app manifest.
- Architecture: [foundations](../unstoppable-foundations/SKILL.md); runtime/API boundaries: [modules](../unstoppable-modules/SKILL.md); composition examples: [recipes](../unstoppable-recipes/SKILL.md). Load only the matching reference.
- Desktop or Node work: [setup-pear-desktop](../setup-pear-desktop/SKILL.md) or [setup-node-cli](../setup-node-cli/SKILL.md). Extend existing managers; desktop native work stays in the Bare worker behind IPC.
- P2P API selection: start with the bundled `modules/p2p.mdc` reference. New shared JSON uses `/data`; remote business calls use `/rpc` with `/service`; existing cores/drives use `/sync`. Do not rebuild these with raw Holepunch packages. Preserve existing app storage and profiles.
- Peer features: [networking](../add-p2p-networking/SKILL.md), [sync](../add-p2p-sync/SKILL.md), [RPC](../add-p2p-rpc/SKILL.md), or [multi-writer sync](../add-multi-writer-sync/SKILL.md).
- Storage: [KV](../add-kv-storage/SKILL.md), [database](../add-database/SKILL.md), or [files](../add-file-storage/SKILL.md).
- Local chat: load `add-ai-chat` when `local-ai` is selected. Extend the installed AI session contract; the app owns prompts, UI, history and business logic.
- Failure: [diagnose-stack-runtime](../diagnose-stack-runtime/SKILL.md). Upgrade: [upgrade-stack](../upgrade-stack/SKILL.md), using read-only compatibility inspection and an explicit migration that preserves edits.

Bundled links resolve relative to this skill file, wherever the harness installed it. App paths resolve relative to the selected app. Do not assume plugin resources live in the current working directory or that `.unstoppable/guidance` exists. In a CLI-generated project pack, the router skills lead to its generated local guidance instead.

## Implement and validate

Keep data locally readable while peers are absent; keep private state outside replicated stores. Use version-matched SDK types and upstream documentation for details beyond the installed contract. Offline, use bundled guidance and installed types and identify any unresolved API details.

Use the app's scripts and [local testing](../setup-local-testing/SKILL.md). Check the affected real behavior, including disconnection/reconnect for P2P and native Stop followed by reuse for local AI. Report mock, native and cached-offline evidence separately. Follow the installed profile's maturity: Expo and Node native AI require their own acceptance evidence; wallet scaffolds are stubs and Personal Node integration is deferred.
