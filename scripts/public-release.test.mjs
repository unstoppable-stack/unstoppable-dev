import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectPublicArchive, validatePublicManifest, verifyPublicRelease } from './public-release.mjs'

const config = JSON.parse(readFileSync(new URL('../release/public-packages.json', import.meta.url)))
const manifest = entry => JSON.parse(readFileSync(new URL(`../${entry.directory}/package.json`, import.meta.url)))

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'public-release-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

function archive(directory, entry, extras = {}) {
  const source = join(directory, entry.tag)
  mkdirSync(join(source, 'package/src'), { recursive: true })
  const pkg = { ...manifest(entry), main: './src/index.js', exports: { '.': './src/index.js' }, bin: undefined, types: undefined }
  for (const [file, content] of Object.entries({ 'package.json': JSON.stringify(pkg), 'README.md': 'Fixture', LICENSE: 'MIT', 'src/index.js': 'export const ok = true', ...extras })) {
    writeFileSync(join(source, 'package', file), content)
  }
  const target = join(directory, `${entry.tag}.tgz`)
  execFileSync('tar', ['-czf', target, '-C', source, 'package'])
  return target
}

test('canonical boundary rejects excluded packages, private packages, local dependencies and latest', () => {
  for (const entry of config.npm) validatePublicManifest(manifest(entry), entry)
  const entry = config.npm[0]
  assert.throws(() => validatePublicManifest({ ...manifest(entry), private: true }, entry), /private/)
  assert.throws(() => validatePublicManifest({ ...manifest(entry), dependencies: { bad: 'file:../node' } }, entry), /Unresolved/)
  assert.throws(() => validatePublicManifest({ ...manifest(entry), dependencies: { 'unstoppable-node': '*' } }, entry), /excluded/)
  assert.throws(() => validatePublicManifest({ ...manifest(entry), dependencies: { '@qvac/sdk': '*' } }, entry), /independent/)
  assert.throws(() => validatePublicManifest(manifest(entry), { ...entry, tag: 'latest' }), /allowlist/)
  assert.throws(() => validatePublicManifest({ ...manifest(entry), name: 'unstoppable-node' }, { name: 'unstoppable-node', tag: 'alpha' }), /allowlist/)
})

test('archive inspection rejects missing exported files and private npm configuration', t => {
  const directory = fixture(t)
  const entry = config.npm[0]
  const pkg = { ...manifest(entry), exports: { '.': './not-packed.js' } }
  assert.throws(() => inspectPublicArchive(archive(directory, entry, { 'package.json': JSON.stringify(pkg) }), entry), /missing/)
  assert.throws(() => inspectPublicArchive(archive(directory, entry, { '.npmrc': 'registry=https://example.invalid' }), entry), /Private/)
})

test('verification binds the consumer proof to the exact packed bytes', t => {
  const directory = fixture(t)
  const artifacts = config.npm.map(entry => inspectPublicArchive(archive(directory, entry), entry))
  const record = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTree: 'dirty', artifacts }
  writeFileSync(join(directory, 'artifact-manifest.json'), JSON.stringify(record))
  writeFileSync(join(directory, 'consumer-verification.json'), JSON.stringify({ status: 'passed', artifacts: artifacts.map(({ name, sha256 }) => ({ name, sha256 })) }))
  verifyPublicRelease(directory, { requireTest: true })
  assert.throws(() => verifyPublicRelease(directory, { requireClean: true }), /uncommitted/)
  writeFileSync(join(directory, 'consumer-verification.json'), JSON.stringify({ status: 'passed', artifacts: artifacts.map(({ name }) => ({ name, sha256: 'stale' })) }))
  assert.throws(() => verifyPublicRelease(directory, { requireTest: true }), /different bytes/)
  archive(directory, config.npm[0], { 'README.md': 'Changed after testing' })
  assert.throws(() => verifyPublicRelease(directory), /identity changed/)
})
