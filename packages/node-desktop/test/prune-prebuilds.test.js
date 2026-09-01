import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const { pruneForeignPrebuilds } = require('../scripts/prune-prebuilds.cjs')
const temporaryPaths = []

function directory (...parts) {
  const target = join(...parts)
  mkdirSync(target, { recursive: true })
  return target
}

afterEach(() => {
  for (const target of temporaryPaths.splice(0)) rmSync(target, { recursive: true, force: true })
})

describe('native prebuild pruning', () => {
  it('keeps only target native binaries and leaves nested dependency trees alone', () => {
    const buildPath = mkdtempSync(join(tmpdir(), 'unstoppable-prebuilds-'))
    temporaryPaths.push(buildPath)
    const modules = directory(buildPath, 'node_modules')
    const nativePrebuilds = directory(modules, 'native-addon', 'prebuilds')
    directory(nativePrebuilds, 'darwin-arm64')
    directory(nativePrebuilds, 'darwin-arm64+simd')
    directory(nativePrebuilds, 'linux-x64')
    directory(nativePrebuilds, 'win32-x64')

    const incompatiblePrebuilds = directory(modules, 'other-addon', 'prebuilds')
    directory(incompatiblePrebuilds, 'linux-x64')

    const nestedPrebuilds = directory(modules, 'wrapper', 'node_modules', 'nested', 'prebuilds')
    directory(nestedPrebuilds, 'linux-x64')

    const result = pruneForeignPrebuilds(buildPath, 'darwin', 'arm64')

    assert.equal(result.directories, 2)
    assert.equal(result.kept, 2)
    assert.equal(result.removed, 3)
    assert.equal(existsSync(join(nativePrebuilds, 'darwin-arm64')), true)
    assert.equal(existsSync(join(nativePrebuilds, 'darwin-arm64+simd')), true)
    assert.equal(existsSync(join(nativePrebuilds, 'linux-x64')), false)
    assert.equal(existsSync(incompatiblePrebuilds), false)
    assert.equal(existsSync(join(nestedPrebuilds, 'linux-x64')), true)
  })
})
