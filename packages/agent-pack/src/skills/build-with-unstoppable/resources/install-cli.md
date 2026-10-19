# Install the Unstoppable Stack CLI

Generated from agent-pack/release.json and cli/package.json. The recorded registry install is CLI 0.4.0-beta.2; Node 22.17+ is required for the candidate tooling. Plugin installation supplies workflows, not the CLI, Pear/Electron, native inference libraries or model weights.

## Check the installed command

Run us --version, us --help, us compatibility --help, us scaffold list-platforms and us scaffold list-features. Inspect the selected app's .unstoppable/project.json and installed dependencies. A matching version is not a native support certificate. If this guide was emitted by a newer installed CLI, keep that CLI and use its catalog; the registry record below is not an instruction to downgrade it. Use compatibility checks before replacing an installed version.

## Registry status

As checked on 2026-10-19, npm latest is 0.3.0. The matching 0.4.0-beta.2 candidate is published. Do not use npm install -g @unstoppable-stack/cli@latest for this workflow.

Install the exact version:

```sh
npm install --global @unstoppable-stack/cli@0.4.0-beta.2
```

## Pinned source install

This public repository revision contains the matching maintained CLI/runtime contracts. Build and install its package, rather than linking a mutable checkout:

```sh
git clone https://github.com/unstoppable-stack/unstoppable-dev.git unstoppable-cli-source
cd unstoppable-cli-source
git checkout a96d424e3ce481d4b336c38488e560da94cd01b7
cd packages/cli
npm ci --ignore-scripts
npm run build
mkdir -p ../../cli-artifacts
npm pack --pack-destination ../../cli-artifacts
npm install --global --prefix "$HOME/.local" ../../cli-artifacts/unstoppable-stack-cli-0.4.0-beta.2.tgz
export PATH="$HOME/.local/bin:$PATH"
us --version
us doctor
us compatibility --help
us scaffold list-platforms
us scaffold list-features
```

Choose a new source directory if unstoppable-cli-source already exists. The source install skips optional research/terminal development-addon scripts; it builds the minimal CLI. Generated apps install their own dependencies normally. On Windows, use a writable npm prefix and add its executable directory to PATH instead of the POSIX export command. Follow npm's global-install documentation for your shell: https://docs.npmjs.com/downloading-and-installing-packages-globally.

## Build an app

In the selected workspace, create a new target with the installed CLI:

```sh
us scaffold app -p pear-desktop -n coffee-assistant -f local-ai
cd coffee-assistant
npm install
npm run dev
```

Use the installed catalog for other features. If the harness plugin is already enabled, us init is optional: it emits a separate project-local pack and can overlap with plugin skills. Keep existing project instructions. Never regenerate an edited app with --force to upgrade it; use us compatibility check -o <app> and a deliberate migration.

Initial package/native/model downloads require connectivity. Desktop native code runs in the Bare worker through the maintained runtime; renderer code uses IPC. For advanced SDK details use installed types and the version-matched official QVAC documentation: https://docs.qvac.tether.io/sdk/js-ts-sdk/. Node native AI and Expo require separate acceptance; wallets are stubs and Personal Node remains deferred. Report build/mock/native/cached-offline evidence separately.

Source: https://github.com/unstoppable-stack/unstoppable-dev/tree/a96d424e3ce481d4b336c38488e560da94cd01b7/packages/cli
CLI guide: https://github.com/unstoppable-stack/unstoppable-dev/blob/a96d424e3ce481d4b336c38488e560da94cd01b7/packages/cli/README.md
