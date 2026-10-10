import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const work = mkdtempSync(join(tmpdir(), 'node-package-smoke-'))
const stage = resolve(process.env.NODE_PACKAGE_ARTIFACT_DIR || join(work, 'artifacts'))
const consumer = join(work, 'consumer')
mkdirSync(stage, { recursive: true })
mkdirSync(consumer)
// Execute npm's JavaScript entry directly on Windows; .cmd launchers require a shell.
const npmCli = process.platform === 'win32'
  ? execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/).map(path => join(dirname(path), 'node_modules', 'npm', 'bin', 'npm-cli.js')).find(existsSync)
  : null
if (process.platform === 'win32' && !npmCli) throw new Error('Cannot locate npm-cli.js next to npm.cmd')
const run = (args, cwd) => execFileSync(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, npm_config_cache: join(work, 'npm-cache') } })
try {
  const artifacts = []
  for (const directory of ['node-core', 'node-caps-sync', 'node-caps-ai', 'node']) {
    const result = JSON.parse(run(['pack', '--json', '--pack-destination', stage], join(root, 'packages', directory)))[0]
    const path = join(stage, result.filename)
    const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).split(/\r?\n/)
    for (const required of ['package/package.json', 'package/README.md', 'package/LICENSE']) {
      if (!entries.includes(required)) throw new Error(`${result.filename} missing ${required}`)
    }
    const pkg = JSON.parse(execFileSync('tar', ['-xOzf', path, 'package/package.json'], { encoding: 'utf8' }))
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) {
      if (/^(file:|link:|workspace:|\.\.?\/|\/)/.test(version)) throw new Error(`${pkg.name} has local production dependency ${name}`)
    }
    const bytes = readFileSync(path)
    artifacts.push({ file: result.filename, name: pkg.name, version: pkg.version, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  console.log(run(['install', '--no-audit', '--no-fund', ...artifacts.map(a => join(stage, a.file))], consumer).trim())
  run(['ls', '--omit=dev'], consumer)
  writeFileSync(join(consumer, 'smoke.mjs'), `
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import DHT from 'hyperdht'
import { createServer } from 'node:net'
import { createNode } from '@unstoppable-stack/node-core'
import { aiPack } from '@unstoppable-stack/node-caps-ai'
import { syncPack } from '@unstoppable-stack/node-caps-sync'
import { PersonalNode } from 'unstoppable-node/personal-node'
const require = createRequire(import.meta.url)
for (const name of ['@unstoppable-stack/node-core', '@unstoppable-stack/node-caps-sync', '@unstoppable-stack/node-caps-ai', 'unstoppable-node']) {
  assert.ok(realpathSync(require.resolve(name)).startsWith(process.cwd()), 'package escaped the isolated consumer')
}
assert.equal(typeof PersonalNode, 'function')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const dht = DHT.bootstrapper(port, '127.0.0.1')
await dht.ready()
const bootstrap = [{ host: '127.0.0.1', port: dht.address().port }]
const host = createNode({ storage: './host', swarm: { bootstrap }, capabilities: [aiPack({ mock: true }), syncPack({ storage: './store' })] })
const client = createNode({ storage: './client', swarm: { bootstrap } })
try {
  await host.ready(); await client.ready(); await host.listen()
  const invitation = await host.createInvite({ grants: { ai: ['completion.stream'], sync: ['status'] } })
  const peer = await client.pair(invitation.code)
  assert.ok(peer.capabilities.sync)
  let text = ''
  for await (const token of peer.stream('ai', 'completion.stream', { messages: [{ role: 'user', content: 'portable packages' }] })) text += token
  assert.equal(text, 'Mock: portable packages')
  console.log('PASS: four installed tarballs compose a real paired P2P node outside the repository')
} finally { await client.close(); await host.close(); await dht.destroy() }
`)
  console.log(execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, encoding: 'utf8', timeout: 60000 }).trim())
  const manifest = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() ? 'dirty' : 'clean', artifacts, note: 'Unpublished alpha artifacts tested together in an isolated consumer. This is not registry publication evidence.' }
  writeFileSync(join(stage, 'artifact-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`PASS: portable production dependency graph; ${artifacts.length} artifact identities retained`)
} finally { rmSync(work, { recursive: true, force: true }) }
