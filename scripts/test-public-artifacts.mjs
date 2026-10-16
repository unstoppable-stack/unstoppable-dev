import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { verifyPublicRelease } from './public-release.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directory = resolve(process.argv[2] || 'release-artifacts')
const record = verifyPublicRelease(directory)
const consumer = mkdtempSync(join(tmpdir(), 'unstoppable-public-consumer-'))
const example = join(root, 'examples/p2p-notes')
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: consumer, stdio: 'inherit', ...options })

try {
  cpSync(join(example, 'src'), join(consumer, 'src'), { recursive: true })
  cpSync(join(example, 'test'), join(consumer, 'test'), { recursive: true })
  const manifest = JSON.parse(readFileSync(join(example, 'package.json'), 'utf8'))
  manifest.name = 'installed-public-package-verification'
  for (const artifact of record.artifacts) manifest.dependencies[artifact.name] = `file:${join(directory, artifact.file)}`
  writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2))
  run('npm', ['install', '--no-audit', '--no-fund'], { shell: process.platform === 'win32' })
  run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createNode } from '@unstoppable-stack/p2p';
    import { NotGrantedError } from '@unstoppable-stack/p2p/errors';
    import { PROTOCOL_VERSION } from '@unstoppable-stack/p2p/protocol';
    import { syncPack } from '@unstoppable-stack/p2p/sync';
    import { ReplicationEngine } from '@unstoppable-stack/p2p/sync/replication';
    import { validateResourceManifest } from '@unstoppable-stack/p2p/sync/resource-manifest';
    for (const api of [createNode, syncPack, ReplicationEngine, validateResourceManifest]) assert.equal(typeof api, 'function');
    assert.equal(PROTOCOL_VERSION, 2);
    assert.equal(new NotGrantedError('notes', 'delete').code, 'NOT_GRANTED');
    assert.deepEqual(validateResourceManifest({ schemaVersion: 1, resources: [] }), { schemaVersion: 1, resources: [] });
  `])
  run(process.execPath, ['--test', '--test-concurrency=1', '--test-force-exit', '--test-timeout=60000', 'test/notes.test.js'])
  const cli = join(consumer, 'node_modules/@unstoppable-stack/cli/dist/us.js')
  const capture = args => execFileSync(process.execPath, [cli, ...args], { cwd: consumer, encoding: 'utf8' })
  const help = capture(['--help'])
  for (const name of ['init', 'scaffold', 'doctor', 'compatibility']) assert(help.includes(`  ${name}`), `Missing ${name}`)
  for (const name of ['node', 'memory', 'search', 'remote', 'research']) assert(!help.includes(`  ${name}`), `Excluded ${name} command shipped`)
  assert(capture(['--version']).includes(`${record.artifacts.find(a => a.name === '@unstoppable-stack/cli').version} (minimal)`))
  assert.deepEqual(JSON.parse(capture(['scaffold', 'list-platforms'])).map(p => p.id), ['pear-desktop'])
  assert.deepEqual(JSON.parse(capture(['scaffold', 'list-features'])).map(f => f.id), ['local-ai'])
  run(process.execPath, [cli, 'init', 'workspace', '--assistant', 'none', '--no-install'])
  run(process.execPath, [cli, 'scaffold', 'app', '-p', 'pear-desktop', '-n', 'notes-app', '-o', join(consumer, 'workspace/notes-app')])
  for (const file of ['worker.js', 'electron/main.js', 'app/index.js']) {
    run(process.execPath, ['--check', join(consumer, 'workspace/notes-app', file)])
  }
  // A data-only consumer must not acquire an AI wrapper, model SDK or Node app.
  run(process.execPath, ['--input-type=module', '-e', `
    import { createRequire } from 'node:module';
    import assert from 'node:assert/strict';
    const require = createRequire(import.meta.url);
    for (const name of ['@qvac/sdk', '@qvac/inference', 'unstoppable-node', '@unstoppable/memory', '@unstoppable-stack/search']) {
      assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
    }
  `])
  writeFileSync(join(directory, 'consumer-verification.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), status: 'passed', platform: process.platform, architecture: process.arch, node: process.version,
    artifacts: record.artifacts.map(({ name, sha256 }) => ({ name, sha256 })),
    checks: ['all six public P2P entry points load', 'invited RPC and streaming', 'denied uninvited/ungranted access', 'real Hyperbee replication',
      'replica restart while source offline', 'installed CLI minimal catalog', 'workspace and app generation',
      'generated JavaScript syntax', 'no AI, Memory, Search or Personal Node dependency'],
    limits: ['Local DHT only; public-internet discovery not asserted', 'No native model or generated desktop UI ran'],
  }, null, 2) + '\n')
  console.log('Canonical tarballs passed the real notes example and installed CLI checks outside the source checkout.')
} finally { rmSync(consumer, { recursive: true, force: true }) }
