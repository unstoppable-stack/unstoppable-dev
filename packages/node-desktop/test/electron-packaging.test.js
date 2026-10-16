import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { findPackagedExecutable } from '../scripts/packaged-paths.mjs'

const require = createRequire(import.meta.url)
const forge = require('../forge.config.cjs')
const pkg = require('../package.json')
const mainSource = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8')
const forgeSource = readFileSync(new URL('../forge.config.cjs', import.meta.url), 'utf8')
const smokeSource = readFileSync(new URL('../scripts/packaged-smoke.mjs', import.meta.url), 'utf8')

describe('Electron packaging contract', () => {
  it('stages resolvable P2P and internal AI exports without the removed packages or source symlinks', async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'node-packaging-')))
    try {
      await forge.hooks.packageAfterPrune({}, directory, '', process.platform, process.arch)
      const staged = createRequire(join(directory, 'package.json'))
      for (const entry of ['@unstoppable-stack/p2p', '@unstoppable-stack/p2p/sync', 'unstoppable-node/internal/ai', 'unstoppable-node/internal/qvac-runtime']) {
        const file = staged.resolve(entry)
        assert(file.startsWith(directory), `${entry} must resolve inside the packaged application`)
        assert.equal(lstatSync(file).isFile(), true)
      }
      for (const name of ['unstoppable-node', '@unstoppable-stack/p2p']) {
        assert.equal(lstatSync(join(directory, 'node_modules', name)).isSymbolicLink(), false)
      }
      for (const name of ['node-core', 'node-caps-sync', 'node-caps-ai']) {
        assert.equal(existsSync(join(directory, 'node_modules/@unstoppable-stack', name)), false)
      }
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })

  it('keeps the Bare worker outside ASAR and defines native installers', () => {
    assert.equal(forge.packagerConfig.asar, false)
    assert.equal(typeof forge.hooks.packageAfterPrune, 'function')
    assert.match(forgeSource, /pruneForeignPrebuilds/)
    const makers = new Set(forge.makers.map((maker) => maker.name))
    assert.ok(makers.has('@electron-forge/maker-dmg'))
    assert.ok(makers.has('@electron-forge/maker-squirrel'))
    assert.ok(makers.has('@electron-forge/maker-deb'))
  })

  it('uses a space-free Linux package path for Electron child processes', () => {
    assert.equal(
      forge.packagerConfig.name,
      process.platform === 'linux' ? 'unstoppable-personal-node' : 'Unstoppable Personal Node'
    )
  })

  it('finds the configured executable on every packaged platform', () => {
    assert.equal(
      findPackagedExecutable(['/out/App.app/Contents/MacOS/unstoppable-personal-node'], 'darwin'),
      '/out/App.app/Contents/MacOS/unstoppable-personal-node'
    )
    assert.equal(
      findPackagedExecutable(['D:\\out\\App-win32-x64\\unstoppable-personal-node.exe'], 'win32'),
      'D:\\out\\App-win32-x64\\unstoppable-personal-node.exe'
    )
    assert.equal(
      findPackagedExecutable(['/out/App-linux-x64/unstoppable-personal-node'], 'linux'),
      '/out/App-linux-x64/unstoppable-personal-node'
    )
  })

  it('disables Electron runtime escape hatches with package-time fuses', () => {
    assert.match(forgeSource, /FuseV1Options\.RunAsNode\]: false/)
    assert.match(forgeSource, /FuseV1Options\.EnableNodeOptionsEnvironmentVariable\]: false/)
    assert.match(forgeSource, /FuseV1Options\.EnableNodeCliInspectArguments\]: false/)
    assert.match(forgeSource, /FuseV1Options\.GrantFileProtocolExtraPrivileges\]: false/)
    assert.match(forgeSource, /FuseV1Options\.EnableCookieEncryption\]: true/)
  })

  it('uses Electron by default while preserving Pear commands', () => {
    assert.equal(pkg.main, 'electron/main.js')
    assert.match(pkg.scripts.dev, /dev:electron/)
    assert.match(pkg.scripts['dev:pear'], /pear run/)
  })

  it('cleans generated output before every package and installer build', () => {
    assert.equal(pkg.scripts['prepackage:electron'], 'npm run clean:electron')
    assert.equal(pkg.scripts.premake, 'npm run clean:electron')
    assert.equal(pkg.scripts['premake:mac'], 'npm run clean:electron')
    assert.equal(pkg.scripts['premake:windows'], 'npm run clean:electron')
    assert.equal(pkg.scripts['premake:linux'], 'npm run clean:electron')
  })

  it('denies renderer network access and unneeded Electron permissions', () => {
    assert.match(mainSource, /setPermissionRequestHandler/)
    assert.match(mainSource, /onBeforeRequest/)
    assert.match(mainSource, /will-attach-webview/)
    assert.match(mainSource, /registerSchemesAsPrivileged/)
    assert.match(mainSource, /protocol\.handle/)
    assert.match(mainSource, /ApprovedPathPolicy/)
    assert.match(mainSource, /nodeIntegration: false/)
    assert.match(mainSource, /contextIsolation: true/)
    assert.match(mainSource, /sandbox: true/)
  })

  it('requires the packaged Bare runtime to resolve the pinned QVAC inference engine', () => {
    assert.match(smokeSource, /--qvac-smoke/)
    assert.match(smokeSource, /PERSONAL_NODE_QVAC_READY 0\.21\.0/)
  })
})
