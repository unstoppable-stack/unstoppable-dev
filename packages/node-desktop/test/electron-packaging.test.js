import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const forge = require('../forge.config.cjs')
const pkg = require('../package.json')
const mainSource = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8')
const forgeSource = readFileSync(new URL('../forge.config.cjs', import.meta.url), 'utf8')
const smokeSource = readFileSync(new URL('../scripts/packaged-smoke.mjs', import.meta.url), 'utf8')

describe('Electron packaging contract', () => {
  it('keeps the Bare worker outside ASAR and defines native installers', () => {
    assert.equal(forge.packagerConfig.asar, false)
    assert.equal(typeof forge.hooks.packageAfterPrune, 'function')
    assert.match(forgeSource, /pruneForeignPrebuilds/)
    const makers = new Set(forge.makers.map((maker) => maker.name))
    assert.ok(makers.has('@electron-forge/maker-dmg'))
    assert.ok(makers.has('@electron-forge/maker-squirrel'))
    assert.ok(makers.has('@electron-forge/maker-deb'))
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

  it('requires the packaged Bare runtime to resolve the pinned QVAC SDK', () => {
    assert.match(smokeSource, /--qvac-smoke/)
    assert.match(smokeSource, /PERSONAL_NODE_QVAC_READY 0\.15\.0/)
  })
})
