# Public plugin preparation — 13 October 2026

Plugin 0.1.1 preview is prepared on current main after merged PR #12. No package, GitHub release/tag or official-directory listing has been published by this work.

The public packages contain 19 workflows/routers, the version-aware CLI installation resource, project SVG branding, MIT license, publisher metadata and deterministic content inventories. Root catalogs resolve tracked plugin packages under packages/agent-pack/plugins. Public and development catalogs have separate names. ZIP archives and checksums are produced by archive-plugin.mjs and included in CI artifacts; CI checks that committed packages remain in sync.

Registry inspection found @unstoppable-stack/cli latest 0.3.0, while current source candidate is 0.4.0-beta.1. Accordingly, the generated instructions do not recommend latest. They point to immutable public commit e34f61dce6d9b1d3f823ae38d58b1856f8c2c896, build its minimal CLI and install a tarball.

## Evidence

- Seven plugin assembly/catalog tests passed.
- CLI suite: 277 passed, 14 skipped; TypeScript and minimal build passed.
- Source/runtime/CLI-bundle parity passed: 107 maintained files.
- Pinned source npm ci with optional dev scripts skipped, minimal build, npm pack and isolated consumer prefix installation passed. Version and compatibility/platform/feature command inspection passed. See [source-install report](cli-source-install.json).
- Native host parsing and manifests passed on installed Codex/Claude versions; see [public catalog report](public-host-parsing.json). No global plugin installation or model turn occurs in this smoke.
- The user reported the original development plugin working in Claude Desktop after registration/install. This establishes visibility/loading in the user's Code-tab setup; it does not establish a completed app build, native inference or Cowork support.

Source installation, artifact/parser tests, hosted catalog install and native app acceptance are separate gates. Hosted installation from main becomes available only after this preparation PR is merged. Public-directory submission still needs publisher identity, dashboard validation/review and release authorization. Matching CLI npm publication follows the existing CLI release gates; the pinned source route remains available until then.

Reproduce with sync-stack-assets.mjs, build-plugin.mjs --public, build-plugin.mjs --public --check, the plugin tests and archive-plugin.mjs. Use smoke-plugin-hosts.mjs --public for the repository catalog parser checks. See [publication runbook](../../../../packages/agent-pack/PUBLICATION.md).
