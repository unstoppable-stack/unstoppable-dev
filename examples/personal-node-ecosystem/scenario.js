import assert from 'node:assert/strict'
import { environment, nodeInvite, notebookInvite } from './test/environment.js'
import { connectNode, protect, until } from './src/runtime.js'

// Real daemon, three identities and separate stores over an isolated local DHT.
// The two app implementations share their contract, not their domain code.
export async function runScenario(log = () => {}) {
  const env = await environment()
  try {
    let host = await env.host()
    let notebook = await env.notebook()
    let briefing = await env.briefing()
    await notebook.put({ schemaVersion: 1, id: 'launch', title: 'Launch plan', body: 'Ship a useful local app' })
    const linked = await briefing.link({ invite: await notebookInvite(notebook) })
    assert.deepEqual(linked.summary, { notes: 1, words: 5 })
    log('Briefing called Notebook’s versioned summary service: 1 note, 5 words.')

    const hostKey = host.publicKey
    const notebookKey = notebook.node.publicKey
    const peer = await connectNode(notebook, { invite: await nodeInvite(host) })
    await protect(peer, notebook.manifest(), linked.descriptor.length)
    log('Personal Node verified the Notebook checkpoint.')

    // Close EVERY app and the host, removing all possible source transports.
    await env.close(briefing)
    await env.close(notebook)
    await env.close(host)
    host = await env.host()
    assert.equal(host.publicKey, hostKey)
    briefing = await env.briefing('fresh-briefing')
    assert.equal(await briefing.report(), null)
    const readerPeer = await connectNode(briefing, { invite: await nodeInvite(host) })
    assert.deepEqual((await readerPeer.call('sync', 'status')).cores, [],
      'Briefing cannot inspect Notebook’s owner-scoped manifest')
    const report = await briefing.buildReport(linked.descriptor)
    assert.equal(report.items[0].title, 'Launch plan')
    assert.deepEqual(briefing.node.peers.map(peer => peer.remotePublicKey), [hostKey])
    log('With Notebook stopped, a fresh Briefing downloaded the notes from the restarted node.')

    await protect(readerPeer, briefing.manifest(), briefing.local.core.length)
    const status = await host.getStatus()
    assert.equal(new Set(status.cores.map(core => core.owner)).size, 2)
    assert.equal(status.cores.length, 2)
    log('The node now mirrors two independently owned datasets: notes and reports.')

    await env.close(briefing)
    await env.close(host)
    briefing = await env.briefing('fresh-briefing', true)
    assert.deepEqual(await briefing.report(), report)
    assert.equal(briefing.node.peers.length, 0)
    notebook = await env.notebook('notebook', true)
    assert.equal(notebook.node.publicKey, notebookKey)
    await notebook.put({ schemaVersion: 1, id: 'launch', title: 'Updated offline', body: 'Offline edits stay local until connected' })
    assert.equal((await notebook.get('launch')).title, 'Updated offline')
    log('Both apps reopened without peers; Briefing kept its report and Notebook accepted an offline edit.')
    await env.close(briefing)
    await env.close(notebook)

    host = await env.host()
    notebook = await env.notebook()
    await notebook.node.listen()
    const reconnected = await connectNode(notebook, { publicKey: hostKey })
    await protect(reconnected, notebook.manifest(), notebook.local.core.length)
    briefing = await env.briefing()
    const refreshed = await briefing.link({ publicKey: notebookKey })
    assert.equal(refreshed.descriptor.key, linked.descriptor.key)
    assert.ok(refreshed.descriptor.length > linked.descriptor.length)
    await env.close(notebook)
    await until(() => !host.node.peer(notebookKey))
    await connectNode(briefing, { invite: await nodeInvite(host) })
    assert.equal((await briefing.buildReport(refreshed.descriptor)).items[0].title, 'Updated offline')
    log('Remembered identities reconnected; the node served the new checkpoint after Notebook stopped again.')
  } finally { await env.cleanup() }
}
