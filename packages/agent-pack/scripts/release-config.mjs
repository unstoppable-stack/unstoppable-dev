import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
export const release = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)))
export const cli = JSON.parse(readFileSync(root + 'packages/cli/package.json'))
if (!/^[a-f0-9]{40}$/.test(release.cliSourceRef)) throw new Error('CLI source ref must be an immutable commit')
// The published installer stays pinned while the source package advances.
const installVersion = release.cliInstallVersion
if (typeof installVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?$/.test(installVersion)) throw new Error('CLI install version must be explicit')
export function installGuide() {
  return `# Install the Unstoppable Stack CLI

Generated from agent-pack/release.json and cli/package.json. Match this plugin with CLI ${installVersion}; Node 22.17+ is required for the candidate tooling. Plugin installation supplies workflows, not the CLI, Pear/Electron, native inference libraries or model weights.

## Check the installed command

Run us --version, us --help, us compatibility --help, us scaffold list-platforms and us scaffold list-features. Inspect the selected app's .unstoppable/project.json and installed dependencies. A matching version is not a native support certificate.

## Registry status

As checked on ${release.registryCheckedOn}, npm latest is ${release.registryLatestObserved}. The matching ${installVersion} candidate is ${release.cliRegistryPublished ? 'published' : 'not published'}. Do not use npm install -g @unstoppable-stack/cli@latest for this workflow.

${release.cliRegistryPublished ? 'Install the exact version:\n\n```sh\nnpm install --global @unstoppable-stack/cli@' + installVersion + '\n```' : 'Use the pinned source install below. Publishing the CLI candidate is a separate release step; plugin installation must not claim it is available on npm.'}

## Pinned source install

This public repository revision contains the matching maintained CLI/runtime contracts. Build and install its package, rather than linking a mutable checkout:

\`\`\`sh
git clone https://github.com/unstoppable-stack/unstoppable-dev.git unstoppable-cli-source
cd unstoppable-cli-source
git checkout ${release.cliSourceRef}
cd packages/cli
npm ci --ignore-scripts
npm run build
mkdir -p ../../cli-artifacts
npm pack --pack-destination ../../cli-artifacts
npm install --global --prefix "$HOME/.local" ../../cli-artifacts/unstoppable-stack-cli-${installVersion}.tgz
export PATH="$HOME/.local/bin:$PATH"
us --version
us doctor
us compatibility --help
us scaffold list-platforms
us scaffold list-features
\`\`\`

Choose a new source directory if unstoppable-cli-source already exists. The source install skips optional research/terminal development-addon scripts; it builds the minimal CLI. Generated apps install their own dependencies normally. On Windows, use a writable npm prefix and add its executable directory to PATH instead of the POSIX export command. Follow npm's global-install documentation for your shell: https://docs.npmjs.com/downloading-and-installing-packages-globally.

## Build an app

In the selected workspace, create a new target with the installed CLI:

\`\`\`sh
us scaffold app -p pear-desktop -n coffee-assistant -f local-ai
cd coffee-assistant
npm install
npm run dev
\`\`\`

Use the installed catalog for other features. If the harness plugin is already enabled, us init is optional: it emits a separate project-local pack and can overlap with plugin skills. Keep existing project instructions. Never regenerate an edited app with --force to upgrade it; use us compatibility check -o <app> and a deliberate migration.

Initial package/native/model downloads require connectivity. Desktop native code runs in the Bare worker through the maintained runtime; renderer code uses IPC. For advanced SDK details use installed types and the version-matched official QVAC documentation: https://docs.qvac.tether.io/sdk/js-ts-sdk/. Node native AI and Expo require separate acceptance; wallets are stubs and Personal Node remains deferred. Report build/mock/native/cached-offline evidence separately.

Source: https://github.com/unstoppable-stack/unstoppable-dev/tree/${release.cliSourceRef}/packages/cli
CLI guide: https://github.com/unstoppable-stack/unstoppable-dev/blob/${release.cliSourceRef}/packages/cli/README.md
`
}
