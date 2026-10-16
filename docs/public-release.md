# Canonical public release

[release/public-packages.json](../release/public-packages.json) is the explicit
npm release allowlist. The candidate consists of:

| Package | Candidate | npm tag |
| --- | --- | --- |
| `@unstoppable-stack/cli` | `0.4.0-beta.1` | `beta` |
| `@unstoppable-stack/p2p` | `0.6.0-alpha.1` | `alpha` |

Claude and Codex plugins share a separately built website download. They remain
local plugin previews, not npm packages or marketplace listings. Personal Node
has a separate optional release workflow; Memory and Search are excluded.
QVAC and WDK are upstream integrations, not public wrapper packages.

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

To enforce a source freeze:

```sh
node scripts/public-release.mjs verify release-artifacts/candidate --require-clean
```

This intentionally rejects a candidate built from uncommitted source. Commit
and review the intended changes, then rebuild; do not relabel dirty artifacts
as clean. The generated directory is ignored by Git.

## Publication

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

Configure ownership and trusted publishers in npm before dispatch; local
preparation cannot validate OIDC authorization. A successful workflow is the
publication record. After publication, verify the registry versions and switch
website install commands from the current published CLI to the tested beta
only if the preview should become the recommended install path.

## Acceptance limits

The notes checks run real protocol and storage implementations against a local
DHT. They do not run an assistant session, generated desktop UI or native AI
model. The separate [public preview workflow](../.github/workflows/public-preview.yml)
checks the generated desktop UI and offers real-model/offline acceptance.
Platform, public-internet connectivity, native inference and independent pilot
acceptance remain distinct from package validation. See [validation](validation.md).
