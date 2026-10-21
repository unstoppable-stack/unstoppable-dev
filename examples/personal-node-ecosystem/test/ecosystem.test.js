import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runScenario } from '../scenario.js'
import { environment, nodeInvite, notebookInvite } from './environment.js'
import { notebookCapability, notebookContract } from '../src/contract.js'
import { connectNode, protect, until } from '../src/runtime.js'

test('two independent apps use real RPC and a restarted Personal Node with the writer offline', () => runScenario())

test('explicit grants, contract versions, cancellation and persistent revocation', async () => {
  const env = await environment()
  try {
    let notebook = await env.notebook()
    const briefing = await env.briefing()
    await notebook.put({ schemaVersion: 1, id: 'one', title: 'One', body: 'Hello' })
    await notebook.node.listen()
    await assert.rejects(() => briefing.node.connect(notebook.node.publicKey), { code: 'PAIR_DENIED' })
    const peer = await briefing.node.pair(await notebookInvite(notebook, ['describe', 'watch']))
    const api = peer.client(notebookContract)
    await api.describe()
    await assert.rejects(() => api.summary(), { code: 'NOT_GRANTED' })
    assert.throws(() => peer.client(notebookCapability({}, 2).contract), { code: 'INCOMPATIBLE_CAPABILITY' })
    await assert.rejects(() => peer.call('sync', 'status'), { code: 'NOT_GRANTED' })

    const controller = new AbortController()
    const stream = api.watch(undefined, { signal: controller.signal })
    assert.equal((await stream.next()).value.schemaVersion, 1)
    assert.equal(notebook.watchers, 1)
    const pending = stream.next()
    controller.abort()
    await assert.rejects(() => pending, { code: 'CANCELLED' })
    await stream.return()
    await until(() => notebook.watchers === 0)
    assert.equal((await api.describe()).schemaVersion, 1, 'cancellation leaves the peer reusable')

    const hostKey = notebook.node.publicKey
    await notebook.node.unpair(briefing.node.publicKey)
    await env.close(notebook)
    notebook = await env.notebook()
    await notebook.node.listen()
    assert.equal(notebook.node.publicKey, hostKey)
    await assert.rejects(() => briefing.node.connect(hostKey), { code: 'PAIR_DENIED' })
  } finally { await env.cleanup() }
})

test('unsupported shared schemas and unavailable checkpoints cannot overwrite a saved report', async () => {
  const env = await environment()
  try {
    const notebook = await env.notebook()
    const briefing = await env.briefing()
    await notebook.put({ schemaVersion: 1, id: 'one', title: 'One', body: 'Hello' })
    const linked = await briefing.link({ invite: await notebookInvite(notebook) })
    const report = await briefing.buildReport(linked.descriptor)
    await assert.rejects(() => briefing.buildReport({ ...linked.descriptor, schemaVersion: 2 }), /Unsupported dataset schema/)
    // A genuinely replicated unsupported record, not a mocked validator call.
    await notebook.local.put('two', { schemaVersion: 2, id: 'two', title: 'Unknown', body: '' })
    await assert.rejects(() => briefing.buildReport(notebook.describe()), /Unsupported note schema/)
    assert.deepEqual(await briefing.report(), report)
    const future = { ...notebook.describe(), length: notebook.local.core.length + 1 }
    await env.close(notebook)
    await assert.rejects(() => briefing.buildReport(future, { timeout: 150 }), /download timed out/)
    const controller = new AbortController()
    const downloading = briefing.buildReport(future, { signal: controller.signal })
    controller.abort(new Error('User cancelled download'))
    await assert.rejects(() => downloading, /User cancelled download/)
    assert.deepEqual(await briefing.report(), report)
  } finally { await env.cleanup() }
})

test('Personal Node keeps app ownership scoped and rejects a second owner for the same core', async () => {
  const env = await environment()
  try {
    const host = await env.host()
    const notebook = await env.notebook()
    const briefing = await env.briefing()
    await notebook.put({ schemaVersion: 1, id: 'one', title: 'One', body: 'Hello' })
    const writerPeer = await connectNode(notebook, { invite: await nodeInvite(host) })
    await protect(writerPeer, notebook.manifest(), notebook.local.core.length)
    const readerPeer = await connectNode(briefing, { invite: await nodeInvite(host) })
    assert.deepEqual((await readerPeer.call('sync', 'status')).cores, [])
    await assert.rejects(() => readerPeer.call('sync', 'manifest.replace', { manifest: notebook.manifest() }), { code: 'NOT_GRANTED' })
    await host.setPeerGrant(briefing.node.publicKey, 'sync', ['usage'])
    await assert.rejects(() => readerPeer.call('sync', 'status'), { code: 'NOT_GRANTED' })
    await readerPeer.call('sync', 'usage')
  } finally { await env.cleanup() }
})
