# Canonical public release

[release/public-packages.json](../release/public-packages.json) is the explicit
npm release allowlist. The published preview consists of:

| Package | Version | npm tag |
| --- | --- | --- |
| `@unstoppable-stack/cli` | `0.4.0-beta.3` | `beta` |
| `@unstoppable-stack/p2p` | `0.6.0-alpha.2` | `alpha` |

Claude and Codex plugins share a separately built website download. They remain
local plugin previews, not npm packages or marketplace listings. Personal Node
has a separate optional release workflow; Memory and Search are excluded.
QVAC and WDK are upstream integrations, not public wrapper packages.

## CLI beta.3 publication (20 October 2026)

CLI `0.4.0-beta.3` is published under `beta`. It adds
`us plugin install claude|codex` and `us plugin status [claude|codex]` to both
build profiles, independently of `init`. Existing plugins and disabled settings
are preserved; catalog conflicts and partial failures are reported.

```sh
npm install -g @unstoppable-stack/cli@0.4.0-beta.3
us --version
us plugin install claude
# or: us plugin install codex
```

The published tarball came from merged commit
`8cfe4017e0754429b9cc207ace0ff55559fa1fd2` ([PR #24](https://github.com/unstoppable-stack/unstoppable-dev/pull/24)).
The [canonical build](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/39440369504)
passed before publication. Fresh npm acceptance verified registry/lockfile
integrity against that exact tarball, the temporary global `us` binary, plugin
command help and real Codex status, and the canonical installed-consumer tests
([registry record](../release/registry-acceptance-2026-10-20-beta3.json)).

P2P remains `0.6.0-alpha.2`; its published bytes and alpha tag were verified and
it was not republished. CLI `latest` remains `0.3.0`. Plugin preview `0.1.8`
refreshes bundled guidance and the website to the exact published beta.3 npm
install, retaining the immutable published-source commit as a fallback.
The [earlier live session record](../release/plugin-cli-2026-10-20.json) used
plugin 0.1.6; publication acceptance does not claim new assistant-driven app,
native inference, offline-model or desktop GUI checks.

## Published preview (19 October 2026)

Install the tested versions explicitly:

```sh
npm install -g @unstoppable-stack/cli@0.4.0-beta.2
npm install @unstoppable-stack/p2p@0.6.0-alpha.2
```

These versions were published using an authenticated maintainer account from
clean commit `a96d424e3ce481d4b336c38488e560da94cd01b7`, reviewed and merged in
[PR #20](https://github.com/unstoppable-stack/unstoppable-dev/pull/20).
The [canonical source checks](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/39274026233)
passed before publication. A fresh local registry acceptance run then verified
both npm integrity hashes against the tested tarballs ([acceptance record](../release/registry-acceptance-2026-10-19.json)) and passed the installed
package and generated sharing-example tests. This was a registry install on
macOS arm64 / Node 22, not a public-network or native-model acceptance run.

CLI `latest` remains `0.3.0`; P2P `latest` remains `0.6.0-alpha.1`.
The new versions use the `beta` and `alpha` tags respectively. Install the exact
versions above; both remain prereleases. No trusted-publisher permission was
added for this release.

### Included in this release

P2P alpha.2 adds typed `/rpc` contracts, managed `/service` sessions, JSON
collections and collaborative databases through `/data`, and the optional `/db`
Autobase prototype. It fixes resource-discovery authorization, applies
app-network policy in both directions, and preserves replication-only
connections beyond the control handshake deadline. Discovery retries and
bounded diagnostics help identify unreachable networks; no HTTP fallback or
all-network connectivity guarantee is provided.

CLI beta.2 includes opt-in managed data modules and a two-device sharing example
in generated Node/desktop apps, and pins their P2P dependency to alpha.2.
Existing app storage formats are preserved. The installed consumer checks run
the exact sharing example emitted by the published CLI in separate processes
on an isolated loopback DHT. A separate [20 October manual test](../release/public-discovery-2026-10-20.json)
passed public discovery, replication and collaborative writer admission between
separate processes on one Mac using the published npm package. Cross-device
and cross-network connectivity remain unverified; this does not block the
current preview release.

The plugin installer uses explicit `cliInstallVersion` release metadata so a
source version bump cannot claim that an unpublished candidate is on npm.

The [notes example](../examples/p2p-notes/README.md) now uses typed calls and
streams; [Local Goods](../examples/ecommerce-assistant/README.md) uses scoped
receipt RPC instead of sharing its database. The separate
[database example](../examples/p2p-database/README.md) exercises offline edits,
restart, conflict convergence and writer removal. The standalone
`node scripts/p2p-artifact-smoke.mjs` also runs the database example against an
installed tarball after explicitly installing Autobase, and checks that ordinary
P2P consumers do not acquire that engine.

## Prepare and test

Install dependencies from the repository root with Node 22.17 or later:

```sh
pnpm --dir packages/cli install --frozen-lockfile
npm ci --prefix packages/p2p
npm ci --prefix examples/p2p-notes
npm ci --prefix examples/p2p-database
node scripts/prepare-public-release.mjs release-artifacts/candidate
```

Use a new candidate directory each time. Preparation runs source regressions,
the real notes and database examples, P2P type inference, plugin tests, and release
validator tests. It builds the CLI's minimal profile, packs exactly the two
allowlisted packages, validates their exports and dependencies, then installs
the tarballs in a temporary consumer outside the checkout. That consumer runs
the notes tests, invokes the installed CLI, generates a workspace and desktop
app, loads the public P2P entry points, including managed data and service APIs, and checks the generated JavaScript. It checks
engine isolation before explicitly installing Autobase and running the collaborative
database example against the installed P2P package. It also runs the sharing example emitted by the installed CLI in separate processes and verifies managed data persistence and connection lifetime.
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

### Authenticated maintainer publication

npm requires a package to exist before trusted publishing can be configured.
The packages already exist, but releases still need an authenticated maintainer
until trusted publishing is configured. Run the
canonical workflow with `publish: false`, download its validated artifact and
use a checkout at the recorded commit. Keep the downloaded tarballs intact.

```sh
node scripts/public-release.mjs verify release-artifacts/candidate --require-clean
npm login --registry=https://registry.npmjs.org
npm publish release-artifacts/candidate/unstoppable-stack-cli-0.4.0-beta.3.tgz --ignore-scripts --access public --tag beta
node scripts/test-public-artifacts.mjs release-artifacts/candidate --registry
```

The example above is a CLI-only release: registry preflight must confirm the
existing P2P alpha.2 integrity and tag first. Do not republish unchanged P2P.
For a future new P2P version, publish and registry-verify it before publishing
the CLI that depends on it. Do not publish the CLI if that verification fails.

The publishing account needs permission to publish packages in the
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
