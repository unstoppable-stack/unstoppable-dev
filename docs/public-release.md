# Canonical public release

[release/public-packages.json](../release/public-packages.json) is the explicit
npm release allowlist. The published preview consists of:

| Package | Version | npm tag |
| --- | --- | --- |
| `@unstoppable-stack/cli` | `0.4.0-beta.1` | `beta` |
| `@unstoppable-stack/p2p` | `0.6.0-alpha.1` | `alpha` |

Claude and Codex plugins share a separately built website download. They remain
local plugin previews, not npm packages or marketplace listings. Personal Node
has a separate optional release workflow; Memory and Search are excluded.
QVAC and WDK are upstream integrations, not public wrapper packages.

## Published preview (16 October 2026)

Install the tested versions explicitly:

```sh
npm install -g @unstoppable-stack/cli@0.4.0-beta.1
npm install @unstoppable-stack/p2p@0.6.0-alpha.1
```

Both versions were first published using an authenticated maintainer account
from the exact, clean [merged-main CI artifacts](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/38936285871).
Registry integrity matched those artifacts, and fresh npm installs passed the
notes replication/authorization/offline-restart tests plus CLI catalog and
scaffolding checks. The [canonical acceptance run](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/38937905740)
retains the CI registry evidence. Native model and public-internet acceptance
remain separate.

CLI `latest` remains `0.3.0`; the current preview is on `beta`. npm also assigned
`latest` to the first P2P version and rejected its removal with HTTP 400, so P2P
currently has both `alpha` and `latest` pointing at `0.6.0-alpha.1`. This is still
an alpha: use the explicit version above. See the [npm registry report](https://github.com/npm/cli/issues/8490).

No persistent trusted-publisher permission was added for this release. Setting
that up for future versions requires separate authorization for the repository,
workflow and environment described below. The acceptance job can skip versions
already published with identical bytes and run its registry tests.

## Prepare and test

Install dependencies from the repository root with Node 22.17 or later:

```sh
pnpm --dir packages/cli install --frozen-lockfile
npm ci --prefix packages/p2p
npm ci --prefix examples/p2p-notes
node scripts/prepare-public-release.mjs release-artifacts/candidate
```

Use a new candidate directory each time. Preparation runs source regressions,
the real [notes example](../examples/p2p-notes/README.md), plugin tests, and release
validator tests. It builds the CLI's minimal profile, packs exactly the two
allowlisted packages, validates their exports and dependencies, then installs
the tarballs in a temporary consumer outside the checkout. That consumer runs
the notes tests, invokes the installed CLI, generates a workspace and desktop
app, loads all six P2P entry points, and checks the generated JavaScript.
Preparation checks production dependency advisories, performs npm
publication dry runs, checks registry version availability, and copies the
website plugin download into `plugins/`.

`artifact-manifest.json` records versions, tags, SHA-256, npm integrity, commit
and whether the source was dirty. `consumer-verification.json` binds the tests
to those exact npm bytes. `preparation.json`, `registry-preflight.json` and
`logs/` contain the remaining evidence. Nothing is published by this command.
Public registry checks do not establish ownership or publishing permissions.

Pull-request and push CI use `--source-check`: they still build, audit, dry-run
and test the exact source artifacts, but skip registry version availability.
This allows documentation and development changes after a version is published.
Local preparation defaults and manual release runs retain registry preflight;
the publish command always rechecks registry version, tags and integrity. Source
CI does not authorize overwriting a published version.


To enforce a source freeze:

```sh
node scripts/public-release.mjs verify release-artifacts/candidate --require-clean
```

This intentionally rejects a candidate built from uncommitted source. Commit
and review the intended changes, then rebuild; do not relabel dirty artifacts
as clean. The generated directory is ignored by Git.

## Publication

### First publication of the P2P package

npm requires a package to exist before trusted publishing can be configured.
P2P is new, so its first version needs an authenticated maintainer. Run the
canonical workflow with `publish: false`, download its validated artifact and
use a checkout at the recorded commit. Keep the downloaded tarballs intact.

```sh
node scripts/public-release.mjs verify release-artifacts/candidate --require-clean
npm login --registry=https://registry.npmjs.org
npm publish release-artifacts/candidate/unstoppable-stack-p2p-0.6.0-alpha.1.tgz --ignore-scripts --access public --tag alpha
```

The publishing account needs permission to create packages in the
`@unstoppable-stack` organization. Complete npm's interactive authentication
and 2FA prompts locally; do not put credentials in Git or chat. Then configure
the P2P trusted publisher, as well as the CLI publisher, before selecting the
workflow's publishing input. See [npm prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites).

### Following the manual release workflow

The [canonical workflow](../.github/workflows/public-packages.yml) runs validation
on pull requests and main. A manual dispatch defaults to validation only.
Selecting `publish: true` enables the separate `npm-release` environment job,
which should have required reviewers. Configure npm trusted publishing for
both packages with the repository, `public-packages.yml` workflow and
`npm-release` environment, and enable direct publishing. The job uses a hosted
runner, an OIDC token and npm 12. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

The publish step rechecks commit, source cleanliness, archive identity,
consumer-test hashes and registry versions. It publishes P2P first, then CLI,
with the declared tags. It does not promote `latest`, rebuild the tarballs or
publish other packages. An identical version already on its intended tag can
be skipped when retrying a partially completed release; conflicting bytes or
tags require review.

After publishing, the workflow installs both exact versions from the public
npm registry in a fresh temporary consumer and reruns the notes and CLI checks.
It compares registry and installed-lockfile integrity against the validated
tarballs, and records `registry-consumer-verification.json`. A local repeat is:

```sh
node scripts/test-public-artifacts.mjs release-artifacts/candidate --registry
```

This mode refuses missing versions or different bytes; it never falls back to
local tarballs or source links. A registry test failure after publication is a
release failure to investigate; it does not unpublish or overwrite a version.

Configure ownership and trusted publishers in npm before dispatch; local
preparation cannot validate OIDC authorization. A successful workflow is the
publication record. After publication, verify the registry versions and update
`packages/agent-pack/release.json` to set `cliRegistryPublished: true` after the
registry smoke passes. Rebuild the public catalogs and website: the setup guides
will then use the exact CLI beta from npm instead of the pinned source build.
Keep `registryLatestObserved` accurate; publishing to `beta` does not move
`latest`. Bump the plugin preview when changing its bundled installation guide.

## Acceptance limits

The notes checks run real protocol and storage implementations against a local
DHT. They do not run an assistant session, generated desktop UI or native AI
model. The separate [public preview workflow](../.github/workflows/public-preview.yml)
checks the generated desktop UI and offers real-model/offline acceptance.
Platform, public-internet connectivity, native inference and independent pilot
acceptance remain distinct from package validation. See [validation](validation.md).
