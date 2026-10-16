import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'release/public-packages.json'), 'utf8'))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const npm = args => execFileSync('npm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
const json = path => JSON.parse(readFileSync(path, 'utf8'))

export function validatePublicManifest(manifest, entry) {
  assert(config.npm.some(item => item.name === entry.name && item.tag === entry.tag), 'Package is outside the canonical npm allowlist')
  assert.equal(manifest.name, entry.name, 'Unexpected package in public release')
  assert(!config.excluded.includes(manifest.name), 'Excluded package cannot enter the canonical release')
  assert.notEqual(manifest.private, true, 'Cannot publish a private package')
  assert.equal(manifest.publishConfig?.access, 'public')
  assert.equal(manifest.publishConfig?.tag, entry.tag)
  assert.equal(manifest.repository?.url, 'https://github.com/unstoppable-stack/unstoppable-dev.git')
  assert.equal(manifest.license, 'MIT')
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/)
  assert(['alpha', 'beta'].includes(entry.tag), 'Canonical preview must use an explicit alpha/beta tag')
  assert.match(manifest.version, new RegExp(`-${entry.tag}\\.`), 'Preview version must match its dist-tag')
  for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies })) {
    assert(!/^(file:|link:|workspace:|\.\.?\/|\/)/.test(version), `Unresolved production dependency: ${name}`)
    assert(!config.excluded.includes(name), `Canonical package depends on excluded ${name}`)
    if (manifest.name === '@unstoppable-stack/p2p') assert(!name.startsWith('@qvac/'), 'P2P must remain independent of QVAC')
  }
}

export function inspectPublicArchive(path, entry) {
  const paths = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).trim().split(/\r?\n/)
  for (const name of paths) {
    assert(name.startsWith('package/') && !name.split('/').includes('..'), `Unsafe archive path ${name}`)
    assert(!/(?:^|\/)(?:node_modules|\.git|\.npmrc|\.env(?:\.[^/]+)?)(?:\/|$)/.test(name), `Private/build content in archive: ${name}`)
  }
  for (const name of ['package.json', 'README.md', 'LICENSE']) assert(paths.includes(`package/${name}`), `Missing ${name}`)
  const manifest = JSON.parse(execFileSync('tar', ['-xOzf', path, 'package/package.json'], { encoding: 'utf8' }))
  validatePublicManifest(manifest, entry)
  function targets(value) {
    if (typeof value === 'string') return [value]
    if (!value || typeof value !== 'object') return []
    return Object.values(value).flatMap(targets)
  }
  for (const file of targets({ exports: manifest.exports, bin: manifest.bin, main: manifest.main, types: manifest.types })) {
    assert(paths.includes(`package/${file.replace(/^\.\//, '')}`), `Export or executable is missing: ${file}`)
  }
  const bytes = readFileSync(path)
  return { name: manifest.name, version: manifest.version, tag: entry.tag, file: basename(path), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` }
}

export function verifyPublicRelease(directory, { requireClean = false, requireTest = false } = {}) {
  const record = json(join(directory, 'artifact-manifest.json'))
  assert.equal(record.commit, git('rev-parse', 'HEAD'), 'Artifacts belong to a different commit')
  assert.equal(record.artifacts.length, config.npm.length)
  assert.equal(readdirSync(directory).filter(name => name.endsWith('.tgz')).length, config.npm.length, 'Unexpected tarballs in canonical release')
  for (const entry of config.npm) {
    const artifact = record.artifacts.find(item => item.name === entry.name)
    assert(artifact, `Missing canonical package ${entry.name}`)
    assert.equal(artifact.file, basename(artifact.file), 'Archive must be in the release directory')
    assert.deepEqual(inspectPublicArchive(join(directory, artifact.file), entry), artifact, 'Artifact identity changed')
    assert.equal(artifact.version, json(join(root, entry.directory, 'package.json')).version, 'Manifest version changed after packing')
  }
  if (requireClean) {
    assert.equal(record.workingTree, 'clean', 'Candidate was packed from uncommitted source')
    assert.equal(git('status', '--porcelain'), '', 'Release checkout has uncommitted changes')
  }
  if (requireTest) {
    const test = json(join(directory, 'consumer-verification.json'))
    assert.equal(test.status, 'passed')
    assert.deepEqual(test.artifacts, record.artifacts.map(({ name, sha256 }) => ({ name, sha256 })), 'Tests were run on different bytes')
  }
  return record
}

async function registryPreflight(directory, options = {}) {
  const record = verifyPublicRelease(directory, options)
  const results = []
  for (const artifact of record.artifacts) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(artifact.name)}`, { signal: AbortSignal.timeout(20_000) })
    assert(response.ok || response.status === 404, `Registry unavailable for ${artifact.name}: ${response.status}`)
    const metadata = response.ok ? await response.json() : {}
    const existing = metadata.versions?.[artifact.version]
    if (existing) {
      assert.equal(existing.dist?.integrity, artifact.integrity, `Version exists with different bytes: ${artifact.name}@${artifact.version}`)
      assert.equal(metadata['dist-tags']?.[artifact.tag], artifact.version, 'Existing version is not on the intended tag; review manually')
    }
    results.push({ name: artifact.name, version: artifact.version, tag: artifact.tag,
      packageExists: response.ok, status: existing ? 'already-published-identical' : 'available', latest: metadata['dist-tags']?.latest ?? null })
  }
  writeFileSync(join(directory, 'registry-preflight.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results,
    note: 'Public registry availability only; this does not verify npm ownership or OIDC authorization.' }, null, 2) + '\n')
  return results
}

async function main() {
  const [command, target, ...flags] = process.argv.slice(2)
  assert(['pack', 'verify', 'preflight', 'publish'].includes(command) && target && flags.every(f => f === '--require-clean'),
    'Usage: node scripts/public-release.mjs <pack|verify|preflight|publish> <directory> [--require-clean]')
  const directory = resolve(target)
  if (command === 'pack') {
    mkdirSync(directory, { recursive: true })
    assert(!readdirSync(directory).some(name => name.endsWith('.tgz')), 'Pack into an empty candidate directory')
    execFileSync(process.execPath, [join(root, 'scripts/sync-stack-assets.mjs'), '--check'], { stdio: 'inherit' })
    const artifacts = []
    for (const entry of config.npm) {
      const manifest = json(join(root, entry.directory, 'package.json'))
      validatePublicManifest(manifest, entry)
      npm(['pack', `./${entry.directory}`, '--pack-destination', directory])
      const filename = `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`
      artifacts.push(inspectPublicArchive(join(directory, filename), entry))
    }
    writeFileSync(join(directory, 'artifact-manifest.json'), JSON.stringify({ schemaVersion: 1, recordedAt: new Date().toISOString(),
      commit: git('rev-parse', 'HEAD'), workingTree: git('status', '--porcelain') ? 'dirty' : 'clean', artifacts,
      note: 'Canonical npm candidate only. Validation and source freeze are separate from publication approval.' }, null, 2) + '\n')
  }
  const record = verifyPublicRelease(directory, { requireClean: flags.includes('--require-clean') || command === 'publish', requireTest: command === 'publish' })
  if (command === 'preflight' || command === 'publish') {
    const results = await registryPreflight(directory, { requireClean: command === 'publish', requireTest: command === 'publish' })
    console.log(JSON.stringify(results, null, 2))
    if (command === 'publish') {
      assert(process.env.GITHUB_ACTIONS === 'true' && process.env.PUBLIC_RELEASE_APPROVED === '1', 'Publish only from the explicitly selected GitHub release job')
      assert(results.every(item => item.packageExists), 'First publish requires an authenticated maintainer: publish the verified new-package tarball, then configure npm trusted publishing. See docs/public-release.md.')
      for (const artifact of record.artifacts) {
        if (results.find(item => item.name === artifact.name).status === 'already-published-identical') continue
        npm(['publish', join(directory, artifact.file), '--ignore-scripts', '--access', 'public', '--tag', artifact.tag])
      }
    }
  }
  console.log(`Verified canonical release: ${record.artifacts.map(item => `${item.name}@${item.version} (${item.tag})`).join(', ')}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
