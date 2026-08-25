import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageFiles = {
  cli: 'packages/cli/package.json',
  node: 'packages/node/package.json',
  core: 'packages/node-core/package.json',
  capsSync: 'packages/node-caps-sync/package.json',
  capsAi: 'packages/node-caps-ai/package.json',
  desktop: 'packages/node-desktop/package.json'
}

// The Personal Node is a composition now: shipping it means shipping the
// runtime and the packs it is built from, at the same version.
const nodeLine = ['node', 'core', 'capsSync', 'capsAi']

const packages = Object.fromEntries(await Promise.all(
  Object.entries(packageFiles).map(async ([name, file]) => [name, JSON.parse(await readFile(resolve(root, file), 'utf8'))])
))

const failures = []
const warnings = []
const check = (condition, message) => { if (!condition) failures.push(message) }

// Until the 0.6 packages exist on npm, the shell can only reference them by
// file: link — a semver range would make every npm install 404. Release runs
// stay strict (a published tarball with file: deps is broken for consumers);
// PR CI sets this to get a loud warning instead of a permanently red check.
const allowUnpublishedInternal = process.env.NODE_RELEASE_GATE_UNPUBLISHED_OK === '1'
const internalNodeLineDeps = new Set([
  '@unstoppable-stack/node-core',
  '@unstoppable-stack/node-caps-sync',
  '@unstoppable-stack/node-caps-ai'
])
const baseVersion = (version) => version.split('-')[0]

for (const name of nodeLine) {
  check(packages.node.version === packages[name].version, `Node and ${name} versions must match`)
}
check(packages.node.version === packages.desktop.version, 'Node and desktop versions must match')
check(baseVersion(packages.node.version) === '0.6.0', 'Node release line must be 0.6.0')
check(baseVersion(packages.cli.version) === '0.4.0', 'CLI release line must be 0.4.0')
check(packages.desktop.dependencies?.['@qvac/sdk'] === '0.15.0', 'Desktop QVAC SDK must be pinned to 0.15.0')
check(packages.desktop.devDependencies?.['@electron-forge/plugin-fuses'] === '7.11.2', 'Electron Fuse plugin must be pinned to 7.11.2')
check(packages.desktop.scripts?.['test:packaged-runtime'], 'Desktop package runtime verification script is missing')

for (const [name, file] of Object.entries(packageFiles)) {
  const lockFile = resolve(root, file.replace('package.json', 'package-lock.json'))
  const lock = JSON.parse(await readFile(lockFile, 'utf8'))
  check(lock.version === packages[name].version, `${name} package-lock top-level version is stale`)
  check(lock.packages?.['']?.version === packages[name].version, `${name} package-lock importer version is stale`)
}

for (const name of [...nodeLine, 'cli']) {
  const pkg = packages[name]
  const dependencyEntries = Object.entries({
    ...(pkg.dependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {})
  })
  for (const [depName, value] of dependencyEntries) {
    if (!/^file:|^link:|^workspace:/.test(value)) continue
    if (allowUnpublishedInternal && internalNodeLineDeps.has(depName)) {
      warnings.push(`${name} depends on unpublished ${depName} via ${value} — must become a semver range before release`)
      continue
    }
    check(false, `${name} public package contains a local dependency (${depName}: ${value})`)
  }
  check(pkg.repository?.url === 'https://github.com/unstoppable-stack/unstoppable-dev.git', `${name} repository URL is not the public repository`)
}

const generatorFiles = [
  'packages/cli/src/generators/node-cli.ts',
  'packages/cli/src/generators/pear-desktop.ts',
  'packages/cli/src/generators/expo-mobile.ts'
]
for (const file of generatorFiles) {
  const source = await readFile(resolve(root, file), 'utf8')
  check(
    source.includes(`'@unstoppable-stack/node-core': '^${packages.core.version}'`),
    `${file} does not generate the release node-core version`
  )
}

const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8')
for (const name of ['cli', 'node']) {
  check(changelog.includes(packages[name].version), `CHANGELOG.md does not mention ${packages[name].version}`)
}

const desktopMain = await readFile(resolve(root, 'packages/node-desktop/electron/main.js'), 'utf8')
for (const securityControl of [
  'setPermissionRequestHandler',
  'onBeforeRequest',
  'will-attach-webview',
  'registerSchemesAsPrivileged',
  'protocol.handle',
  'ApprovedPathPolicy',
  'nodeIntegration: false',
  'contextIsolation: true',
  'sandbox: true'
]) check(desktopMain.includes(securityControl), `Electron security control missing: ${securityControl}`)

const forgeConfig = await readFile(resolve(root, 'packages/node-desktop/forge.config.cjs'), 'utf8')
for (const fuseControl of [
  'FuseV1Options.RunAsNode]: false',
  'FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false',
  'FuseV1Options.EnableNodeCliInspectArguments]: false',
  'FuseV1Options.GrantFileProtocolExtraPrivileges]: false',
  'FuseV1Options.EnableCookieEncryption]: true'
]) check(forgeConfig.includes(fuseControl), `Electron Fuse control missing: ${fuseControl}`)
check(forgeConfig.includes('pruneForeignPrebuilds'), 'Desktop packaging does not prune foreign native binaries')

for (const workflow of ['.github/workflows/node-release.yml', '.github/workflows/node-desktop-release.yml', '.github/workflows/node-qvac.yml']) {
  const source = await readFile(resolve(root, workflow), 'utf8')
  for (const line of source.split('\n').filter((line) => line.trim().startsWith('uses:') || line.includes('- uses:'))) {
    check(/@[0-9a-f]{40}(?:\s|$)/.test(line), `${workflow} has an unpinned action: ${line.trim()}`)
  }
}

const nodeRelease = await readFile(resolve(root, '.github/workflows/node-release.yml'), 'utf8')
check(!nodeRelease.includes('\n  push:'), 'Node publishing must not be triggered by a pushed tag')
check(nodeRelease.includes('environment: npm-release'), 'Node publishing is missing its protected environment')
check(nodeRelease.includes('id-token: write'), 'Node publishing is missing npm trusted-publishing OIDC permission')
check(nodeRelease.includes('npm@12.0.2'), 'Node publishing is missing the pinned trusted-publishing npm CLI')
check(!nodeRelease.includes('NODE_AUTH_TOKEN'), 'Node publishing must not use a long-lived npm token')
check(!nodeRelease.includes('--provenance'), 'Private-repository Node publishing must not request unsupported npm provenance')
for (const directory of ['node-core', 'node-caps-sync', 'node-caps-ai']) {
  check(
    nodeRelease.includes(`npm pack ./packages/${directory}`),
    `Node release does not pack ${directory} from the monorepo root correctly`
  )
}
check(nodeRelease.includes('npm pack ./packages/node '), 'Node release does not pack node from the monorepo root correctly')

const desktopRelease = await readFile(resolve(root, '.github/workflows/node-desktop-release.yml'), 'utf8')
check(desktopRelease.includes('environment: desktop-release'), 'Desktop release is missing its protected environment')
check(desktopRelease.includes('codesign --verify'), 'Desktop release does not verify the macOS signature')
check(desktopRelease.includes('Get-AuthenticodeSignature'), 'Desktop release does not verify the Windows signature')
check(desktopRelease.includes('npm run test:packaged-runtime'), 'Desktop release does not verify packaged dependencies and fuses')
check(desktopRelease.includes('npm run test:packaged'), 'Desktop release does not smoke the packaged app')

const qvacRelease = await readFile(resolve(root, '.github/workflows/node-qvac.yml'), 'utf8')
check(qvacRelease.includes('environment: qvac-validation'), 'Real QVAC validation is missing its protected environment')
check(qvacRelease.includes('@qvac/sdk@0.15.0'), 'Real QVAC validation does not install the pinned desktop SDK')
for (const runner of ['macos-14', 'ubuntu-24.04', 'windows-2025']) {
  check(qvacRelease.includes(runner), `Real QVAC validation is missing ${runner}`)
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`)

if (failures.length > 0) {
  console.error('Node release gate failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Node release gate passed (node line ${packages.node.version}; CLI ${packages.cli.version})`)
}
