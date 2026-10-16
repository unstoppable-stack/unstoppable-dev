// Verify the installed P2P tarball outside the checkout. Nothing is published.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'packages/p2p')
assert(process.argv.slice(2).every(argument => argument === '--bare'), 'Usage: node scripts/p2p-artifact-smoke.mjs [--bare]')
const directory = mkdtempSync(join(tmpdir(), 'unstoppable-p2p-artifact-'))
const consumer = join(directory, 'consumer')
const run = (command, args, cwd = consumer) => execFileSync(command, args, {
  cwd, stdio: 'inherit', timeout: 180_000, shell: command === 'npm' && process.platform === 'win32',
})
const npm = args => run('npm', args)

try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], {
    cwd: source, encoding: 'utf8', shell: process.platform === 'win32',
  }))
  mkdirSync(consumer)
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({
    name: 'p2p-artifact-consumer', private: true, type: 'module',
    dependencies: {
      '@unstoppable-stack/p2p': `file:${join(directory, packed[0].filename)}`,
      corestore: '^7.8.0', hyperbee: '^2.27.3', hyperdht: '^6.34.1', typescript: '5.9.3',
    },
  }, null, 2))
  npm(['install', '--no-audit', '--no-fund'])
  run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createNode } from '@unstoppable-stack/p2p';
    import { procedure, defineCapability } from '@unstoppable-stack/p2p/rpc';
    import { openDatabase, autobaseAdapter } from '@unstoppable-stack/p2p/db';
    for (const value of [createNode, defineCapability, openDatabase, autobaseAdapter]) assert.equal(typeof value, 'function');
    assert(procedure);
    const require = createRequire(import.meta.url);
    assert.throws(() => require.resolve('autobase'), { code: 'MODULE_NOT_FOUND' });
  `])

  for (const name of ['src', 'test']) cpSync(join(root, 'examples/p2p-notes', name), join(consumer, name), { recursive: true })
  run(process.execPath, ['--test', '--test-force-exit', '--test-timeout=60000', 'test/notes.test.js'])

  // Test files are harness inputs, copied into the installed package so their
  // relative imports resolve only the shipped implementation, never repo source.
  const installed = join(consumer, 'node_modules/@unstoppable-stack/p2p')
  mkdirSync(join(installed, 'test'))
  cpSync(join(source, 'test/helpers.js'), join(installed, 'test/helpers.js'))
  const rpcTests = readdirSync(join(source, 'test')).filter(name => /^rpc.*\.test\.js$/.test(name))
  assert(rpcTests.length > 0, 'RPC acceptance tests are missing')
  for (const name of rpcTests) cpSync(join(source, 'test', name), join(installed, 'test', name))
  cpSync(join(source, 'test/types'), join(installed, 'test/types'), { recursive: true })
  run(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', join(installed, 'test/types/tsconfig.json')])
  run(process.execPath, ['--test', '--test-force-exit', '--test-timeout=60000', ...rpcTests.map(name => join(installed, 'test', name))])

  // Installing the experimental engine is an explicit consumer choice.
  npm(['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', 'autobase@7.28.2'])
  mkdirSync(join(installed, 'test/sync'))
  cpSync(join(source, 'test/sync/helpers.js'), join(installed, 'test/sync/helpers.js'))
  cpSync(join(source, 'test/db'), join(installed, 'test/db'), { recursive: true })
  const dbTests = readdirSync(join(installed, 'test/db')).filter(name => name.endsWith('.test.js'))
  assert(dbTests.length > 0, 'Database prototype acceptance tests are missing')
  run(process.execPath, ['--test', '--test-force-exit', '--test-timeout=120000', ...dbTests.map(name => join(installed, 'test/db', name))])
  if (process.argv.includes('--bare')) run(process.execPath, [join(installed, 'scripts/run-bare-smoke.mjs')])

  const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  assert.equal(metadata.version, JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version)
  console.log('Installed P2P artifact passed: optional engine isolation, notes replication, typed RPC and database prototype')
} finally { rmSync(directory, { recursive: true, force: true }) }
