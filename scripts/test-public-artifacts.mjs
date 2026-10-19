import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { verifyPublicRelease } from './public-release.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directory = resolve(process.argv[2] || 'release-artifacts')
const registry = process.argv.slice(3).includes('--registry')
assert(process.argv.slice(3).every(arg => arg === '--registry'), 'Usage: node scripts/test-public-artifacts.mjs <directory> [--registry]')
const record = verifyPublicRelease(directory, { requireClean: registry, requireTest: registry })
if (registry) {
  for (const artifact of record.artifacts) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(artifact.name)}/${artifact.version}`, { signal: AbortSignal.timeout(20_000) })
    assert(response.ok, `Not published or registry unavailable: ${artifact.name}@${artifact.version} (${response.status})`)
    const metadata = await response.json()
    assert.equal(metadata.dist?.integrity, artifact.integrity, `Registry bytes differ from tested candidate: ${artifact.name}`)
  }
}
const consumer = mkdtempSync(join(tmpdir(), 'unstoppable-public-consumer-'))
const example = join(root, 'examples/p2p-notes')
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: consumer, stdio: 'inherit', ...options })

try {
  cpSync(join(example, 'src'), join(consumer, 'src'), { recursive: true })
  cpSync(join(example, 'test'), join(consumer, 'test'), { recursive: true })
  const manifest = JSON.parse(readFileSync(join(example, 'package.json'), 'utf8'))
  manifest.name = 'installed-public-package-verification'
  for (const artifact of record.artifacts) manifest.dependencies[artifact.name] = registry ? artifact.version : `file:${join(directory, artifact.file)}`
  writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2))
  run('npm', ['install', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org'], { shell: process.platform === 'win32' })
  if (registry) {
    const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8'))
    for (const artifact of record.artifacts) {
      const installed = lock.packages[`node_modules/${artifact.name}`]
      assert.equal(installed.version, artifact.version)
      assert.equal(installed.integrity, artifact.integrity)
      assert(installed.resolved.startsWith('https://registry.npmjs.org/'), 'Registry smoke must not consume a source link or local tarball')
    }
  }
  run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createNode } from '@unstoppable-stack/p2p';
    import { NotGrantedError } from '@unstoppable-stack/p2p/errors';
    import { PROTOCOL_VERSION } from '@unstoppable-stack/p2p/protocol';
    import { syncPack } from '@unstoppable-stack/p2p/sync';
    import { ReplicationEngine } from '@unstoppable-stack/p2p/sync/replication';
    import { validateResourceManifest } from '@unstoppable-stack/p2p/sync/resource-manifest';
    import { openCollection, openCollaborativeDatabase } from '@unstoppable-stack/p2p/data';
    import { serve, connect } from '@unstoppable-stack/p2p/service';
    import { defineCapability } from '@unstoppable-stack/p2p/rpc';
    import { openDatabase, autobaseAdapter } from '@unstoppable-stack/p2p/db';
    for (const api of [createNode, syncPack, ReplicationEngine, validateResourceManifest, defineCapability, openDatabase, autobaseAdapter, openCollection, openCollaborativeDatabase, serve, connect]) assert.equal(typeof api, 'function');
    assert.equal(PROTOCOL_VERSION, 2);
    assert.equal(new NotGrantedError('notes', 'delete').code, 'NOT_GRANTED');
    assert.deepEqual(validateResourceManifest({ schemaVersion: 1, resources: [] }), { schemaVersion: 1, resources: [] });
  `])
  run(process.execPath, ['--test', '--test-concurrency=1', '--test-force-exit', '--test-timeout=60000', 'test/notes.test.js'])
  // Exercise the trust and replication regressions against the exact packed bytes.
  const installedP2p = join(consumer, 'node_modules/@unstoppable-stack/p2p')
  mkdirSync(join(installedP2p, 'test/sync'), { recursive: true })
  for (const name of ['helpers.js', 'connection-policy.test.js']) {
    cpSync(join(root, 'packages/p2p/test/sync', name), join(installedP2p, 'test/sync', name))
  }
  run(process.execPath, ['--test', '--test-force-exit', '--test-timeout=30000', join(installedP2p, 'test/sync/connection-policy.test.js')])
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
  for (const file of ['worker.js', 'electron/main.js', 'app/index.js', 'shared-data.js', 'examples/share-data.mjs']) {
    run(process.execPath, ['--check', join(consumer, 'workspace/notes-app', file)])
  }
  // A data-only consumer must not acquire an AI wrapper, model SDK or Node app.
  run(process.execPath, ['--input-type=module', '-e', `
    import { createRequire } from 'node:module';
    import assert from 'node:assert/strict';
    const require = createRequire(import.meta.url);
    for (const name of ['autobase', '@qvac/sdk', '@qvac/inference', 'unstoppable-node', '@unstoppable/memory', '@unstoppable-stack/search']) {
      assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
    }
  `])
  // Opt in only after proving that ordinary P2P consumers do not install it.
  const databaseExample = join(consumer, 'database-example')
  cpSync(join(root, 'examples/p2p-database'), databaseExample, {
    recursive: true,
    filter: path => !path.split(/[\\/]/).includes('node_modules') && !path.endsWith('package-lock.json'),
  })
  run('npm', ['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', 'autobase@7.28.2'], { shell: process.platform === 'win32' })
  run(process.execPath, ['--test', '--test-force-exit', '--test-timeout=60000', join(databaseExample, 'test/database.test.js')])
  // Verify the exact installed managed APIs and the example emitted by the installed CLI.
  for (const name of ['helpers.js', 'data.test.js', 'data-network.test.js', 'data-device.test.js', 'rpc-session.test.js']) {
    cpSync(join(root, 'packages/p2p/test', name), join(installedP2p, 'test', name))
  }
  run(process.execPath, ['--test', '--test-force-exit', '--test-timeout=120000',
    ...['data.test.js', 'data-network.test.js', 'data-device.test.js', 'rpc-session.test.js'].map(name => join(installedP2p, 'test', name))], {
    env: { ...process.env,
      P2P_DEVICE_EXAMPLE: join(consumer, 'workspace/notes-app/examples/share-data.mjs'),
      P2P_CONSUMER_CWD: consumer,
    },
  })
  writeFileSync(join(directory, registry ? 'registry-consumer-verification.json' : 'consumer-verification.json'), JSON.stringify({
    installation: registry ? 'public npm registry' : 'local release tarballs',
    checkedAt: new Date().toISOString(), status: 'passed', platform: process.platform, architecture: process.arch, node: process.version,
    artifacts: record.artifacts.map(({ name, sha256 }) => ({ name, sha256 })),
    checks: ['resource discovery cannot grant capability authority', 'outgoing network approval and grant ceilings', 'replication-only connections survive control deadlines', 'incomplete control handshakes expire', 'managed data and service public entry points load', 'installed CLI emits working separate-process data examples', 'optional database engine is not installed by default', 'explicit Autobase opt-in: offline writes, restart, conflict convergence and removal', 'invited RPC and streaming', 'denied uninvited/ungranted access', 'real Hyperbee replication',
      'replica restart while source offline', 'installed CLI minimal catalog', 'workspace and app generation',
      'generated JavaScript syntax', 'no AI, Memory, Search or Personal Node dependency'],
    limits: ['Local DHT only; public-internet discovery not asserted', 'No native model or generated desktop UI ran'],
  }, null, 2) + '\n')
  console.log(`Canonical packages installed from ${registry ? 'the public npm registry' : 'release tarballs'} passed the notes example and CLI checks outside the source checkout.`)
} finally { rmSync(consumer, { recursive: true, force: true }) }
