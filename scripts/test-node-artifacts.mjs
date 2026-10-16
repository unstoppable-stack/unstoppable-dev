import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const artifacts = resolve(process.argv[2] || 'release-artifacts')
const consumer = mkdtempSync(join(tmpdir(), 'unstoppable-node-consumer-'))
const tarballs = ['unstoppable-stack-p2p-', 'unstoppable-node-'].map(prefix => {
  const files = readdirSync(artifacts).filter(name => name.startsWith(prefix) && name.endsWith('.tgz'))
  if (files.length !== 1) throw new Error(`Expected exactly one ${prefix} artifact`)
  return join(artifacts, files[0])
})

try {
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  execFileSync('npm', ['install', '--no-audit', '--no-fund', ...tarballs], {
    cwd: consumer, stdio: 'inherit', shell: process.platform === 'win32',
  })
  const nodeManifest = JSON.parse(readFileSync(join(consumer, 'node_modules/unstoppable-node/package.json'), 'utf8'))
  if (!nodeManifest.dependencies['@unstoppable-stack/p2p']?.startsWith('^')) {
    throw new Error('Installed Personal Node must depend on a published P2P semver range')
  }
  // Tests live outside the checkout and resolve only installed tarball code.
  // A mock inference call proves adapter packaging, not native QVAC support.
  writeFileSync(join(consumer, 'smoke.test.mjs'), `
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import DHT from 'hyperdht'
import { createNode, PROTOCOL_VERSION } from '@unstoppable-stack/p2p'
import { syncPack, validateResourceManifest } from '@unstoppable-stack/p2p/sync'
import { ReplicationEngine } from '@unstoppable-stack/p2p/sync/replication'
import { PersonalNode } from 'unstoppable-node/personal-node'

test('installed P2P and Personal Node pair, authorize and stream without source links', { timeout: 60000 }, async () => {
  const storage = await mkdtemp(join(tmpdir(), 'installed-node-'))
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const dht = DHT.bootstrapper(port, '127.0.0.1')
  let host, client
  try {
    await dht.ready()
    const swarm = { bootstrap: [{ host: '127.0.0.1', port: dht.address().port }] }
    assert.equal(typeof syncPack, 'function')
    assert.equal(typeof ReplicationEngine, 'function')
    assert.ok(PROTOCOL_VERSION)
    assert.deepEqual(validateResourceManifest({ schemaVersion: 1, resources: [] }).resources, [])
    host = new PersonalNode(join(storage, 'host'), { swarm, topic: null, ai: { mock: true } })
    await host.start()
    client = createNode({ storage: join(storage, 'client'), swarm })
    await client.ready()
    const peer = await client.connect(host.publicKey)
    assert.equal((await peer.call('sync', 'usage')).scope, 'self')
    assert.deepEqual((await peer.call('sync', 'status')).cores, [])
    let output = ''
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'installed artifact' }],
    })) output += token
    assert.equal(output, 'Mock: installed artifact')
    await host.setPeerGrant(client.publicKey, 'sync', ['usage'])
    await assert.rejects(() => peer.call('sync', 'status'), { code: 'NOT_GRANTED' })
  } finally {
    if (client) await client.close()
    if (host) await host.close()
    await dht.destroy()
    await rm(storage, { recursive: true, force: true })
  }
})
`)
  execFileSync(process.execPath, ['--test', '--test-force-exit', 'smoke.test.mjs'], { cwd: consumer, stdio: 'inherit' })
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
