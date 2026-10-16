# Validation and release checks

This page describes reproducible checks, not certification of a release.
The core preview covers assistant setup and app scaffolding. See
[SUPPORT.md](../SUPPORT.md) for scope. Planning notes and historical local
reports are not required to build or test a public checkout.

## Maintained assets and CLI

From the repository root, after installing CLI dependencies:

```bash
node scripts/sync-stack-assets.mjs
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
node --test packages/runtime-ai/test/*.test.js
pnpm --dir packages/cli typecheck
pnpm --dir packages/cli test
pnpm --dir packages/cli build
```

Runtime tests exercise lifecycle contracts with test adapters. CLI tests cover
scaffolds, assistant output, and compatibility checks. These checks do not prove
that a fresh native SDK/model installation works on every platform.

See [CLI testing](../packages/cli/README.md#development) for platform-specific
E2E commands. Mock runs verify wiring and UI flows; they do not validate model
loading, native cancellation/reuse, or offline inference.

## Release artifacts and native acceptance

The [public preview workflow](../.github/workflows/public-preview.yml) builds
and tests the installed CLI artifact and generated desktop UI on macOS arm64.
Its optional `real_model` input enables real-model and offline checks.
[scripts/release-smoke.sh](../scripts/release-smoke.sh) implements the flow;
[scripts/release-artifacts.mjs](../scripts/release-artifacts.mjs) records
checksums and verifies packed manifests. Consult the actual workflow run and
artifact records for results on a specific commit.

Fresh native installation, real inference, cancellation/reuse, offline restart,
and platform coverage remain separate acceptance gates. Expo needs
physical-device validation of its complete native graph. Personal Node remains
outside the core preview; its release gate and signed desktop packaging checks
are documented in the [desktop README](../packages/node-desktop/README.md).

Compatibility profile validation strings may summarize historical maintainer
runs. This page documents their public reproduction paths; it does not publish
the internal reports or claim those runs have been repeated for a new checkout.

## Assistant plugins

```bash
node packages/agent-pack/scripts/build-plugin.mjs
node --test packages/agent-pack/scripts/build-plugin.test.mjs
node packages/agent-pack/scripts/smoke-plugin-hosts.mjs
```

The host smoke needs installed Codex and Claude executables. See
[plugin setup and limitations](../packages/agent-pack/PLUGIN.md). Plugin manifest
and discovery checks do not establish the quality of an assistant-driven app.

## Public checkout hygiene

Internal plans, copied research, sandbox results, and local assistant settings
are ignored. CI fixtures live in `examples/`; public CI must not depend on
ignored directories. Upstream reference checkouts are local maintainer material
and are not included in the public repository.

Removing a file from the current tree does not remove older Git objects. Review
the intended published history separately before changing repository visibility.
