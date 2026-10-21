import { openBriefing } from './src/briefing.js'
import { protect } from './src/runtime.js'
import { argumentsFor, attachNode, print, stayOpen } from './src/cli.js'

let app
try {
  const { storage, values, positionals: [command] } = argumentsFor('briefing')
  if (!['link', 'sync', 'show'].includes(command)) throw new Error('Usage: briefing.js link --invite CODE | sync [--node-invite CODE | --node-key KEY] [--stay-open] | show [--storage DIR]')
  app = await openBriefing({ storage, swarm: command === 'show' ? { bootstrap: [] } : undefined })
  if (command === 'link') {
    const source = await app.source()
    if (!values.invite && !source) throw new Error('First link requires a Notebook invitation')
    const linked = await app.link({ invite: values.invite, publicKey: source?.publicKey })
    print({ status: 'linked; no note payload downloaded yet', summary: linked.summary, checkpoint: linked.descriptor.length })
  } else if (command === 'sync') {
    const source = await app.source()
    if (!source) throw new Error('Link with Notebook first to obtain its shared dataset descriptor')
    const peer = await attachNode(app, values)
    const report = await app.buildReport(source.descriptor)
    await protect(peer, app.manifest(), app.local.core.length)
    print({ nodePublicKey: peer.remotePublicKey, report })
    if (values['stay-open']) {
      console.log('Report synced. Briefing remains connected to Personal Node; Ctrl+C stops it.')
      await stayOpen()
    }
  } else {
    print(await app.report())
  }
} catch (error) {
  console.error(error.code || 'ERROR', error.message)
  process.exitCode = 1
} finally { await app?.close() }
