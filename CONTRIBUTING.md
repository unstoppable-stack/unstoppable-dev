# Contributing

Thanks for helping improve the Unstoppable Stack. The repository is preparing
a developer preview, so small, testable changes with explicit maturity claims
are preferred.

## Before opening a change

1. Search [existing issues](https://github.com/unstoppable-stack/unstoppable-dev/issues).
2. For a bug, include the affected package, operating system, architecture,
   Node.js version, exact command, and the first useful error. Remove secrets,
   peer keys, seed phrases, application data, and private model URLs.
3. Report suspected vulnerabilities privately as described in
   [SECURITY.md](./SECURITY.md), not in a public issue.

## Local setup

The repository root is not a package-manager workspace. Install and test only
the package you are changing.

### CLI

```bash
cd packages/cli
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

### Website

```bash
cd packages/website
pnpm install --frozen-lockfile
pnpm build
```

### Runtime packages

The P2P library is an experimental public alpha candidate; Personal Node is
deferred. Each package has its own lockfile and tests; run commands from that
package directory. Some
packages use local `file:` dependencies and are not yet registry-installable.
Do not describe a source-level test as a published-package result.
Use [canonical release preparation](docs/public-release.md) to test the CLI and
P2P tarballs outside the source checkout before publication.

## Agent-pack changes

Edit `packages/agent-pack/src/`. After source changes, regenerate maintained
assets and verify the CLI bundle:

```bash
node scripts/sync-stack-assets.mjs
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
```

## Change expectations

- Use TypeScript for new TypeScript/JavaScript project code where practical.
- Add or update tests for behavior changes.
- Keep local-first and peer-disconnection behavior explicit.
- Label mocks, stubs, and documentation-only patterns as such.
- Do not commit model files, credentials, seed phrases, private user data, or
  ignored planning/research/sandbox contents or local assistant settings.
- Use conventional commit messages when committing.

Opening a pull request confirms that you have the right to contribute the
submitted material under the repository's [MIT License](./LICENSE).
