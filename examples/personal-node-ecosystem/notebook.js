import { openNotebook } from './src/notebook.js'
import { protect } from './src/runtime.js'
import { argumentsFor, attachNode, print, stayOpen } from './src/cli.js'

let app
try {
  const { storage, values, positionals: [command, id, title, body] } = argumentsFor('notebook')
  if (!['put', 'show', 'serve'].includes(command)) throw new Error('Usage: notebook.js put ID TITLE BODY | show ID | serve [--node-invite CODE | --node-key KEY] [--storage DIR]')
  app = await openNotebook({ storage, swarm: command === 'serve' ? undefined : { bootstrap: [] } })
  if (command === 'put') {
    await app.put({ schemaVersion: 1, id, title, body })
    print(await app.get(id))
  } else if (command === 'show') {
    print(await app.get(id))
  } else {
    // A useful initial dataset is required before sharing a checkpoint.
    const shared = app.describe()
    if (values['node-invite'] || values['node-key']) {
      const peer = await attachNode(app, values)
      await protect(peer, app.manifest(), shared.length)
      print({ nodePublicKey: peer.remotePublicKey, status: 'verified checkpoint' })
    }
    const invite = await app.node.createInvite({
      grants: { 'ecosystem-notebook': ['describe', 'summary', 'watch'] }, uses: 1,
    })
    print({ notebookPublicKey: app.node.publicKey, invitation: invite.code })
    console.log('Share this one-use invitation privately with Briefing. Keep this process open until linking finishes; Ctrl+C stops it.')
    await stayOpen()
  }
} catch (error) {
  console.error(error.code || 'ERROR', error.message)
  process.exitCode = 1
} finally { await app?.close() }
