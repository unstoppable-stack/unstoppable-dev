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

Runtime and Personal Node packages are deferred alpha work. Each package has
its own lockfile and tests; run commands from that package directory. Some
packages use local `file:` dependencies and are not yet registry-installable.
Do not describe a source-level test as a published-package result.

## Agent-pack changes

Edit `packages/agent-pack/src/`, then synchronize it to
`packages/cli/agent-pack-src/`. Before submitting, verify the trees match:

```bash
rsync -av --delete packages/agent-pack/src/ packages/cli/agent-pack-src/
diff -qr packages/agent-pack/src packages/cli/agent-pack-src
```

## Change expectations

- Use TypeScript for new TypeScript/JavaScript project code where practical.
- Add or update tests for behavior changes.
- Keep local-first and peer-disconnection behavior explicit.
- Label mocks, stubs, and documentation-only patterns as such.
- Do not commit model files, credentials, seed phrases, private user data, or
  ignored research/sandbox contents.
- Use conventional commit messages when committing.

Opening a pull request confirms that you have the right to contribute the
submitted material under the repository's [MIT License](./LICENSE).
