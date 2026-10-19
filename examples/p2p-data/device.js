import { createInterface } from 'node:readline'
import { openCollection, openCollaborativeDatabase } from '@unstoppable-stack/p2p/data'

const [mode, storage, key, version] = process.argv.slice(2)
if (!storage || !['mirror-host', 'mirror-read', 'db-host', 'db-join'].includes(mode) ||
    (mode === 'mirror-read' && (!key || !/^\d+$/.test(version || ''))) || (mode === 'db-join' && !key)) {
  console.error('Usage: node device.js mirror-host <directory>\n' +
    '       node device.js mirror-read <directory> <key> <version>\n' +
    '       node device.js db-host <directory>\n' +
    '       node device.js db-join <directory> <key>')
  process.exitCode = 1
} else {
  // Optional private-network configuration; ordinary users use public discovery.
  const nodeOptions = process.env.P2P_BOOTSTRAP
    ? { swarm: { bootstrap: JSON.parse(process.env.P2P_BOOTSTRAP) } } : undefined
  const controller = new AbortController()
  const stop = () => controller.abort(new Error('Stopped'))
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  const hold = () => controller.signal.aborted ? Promise.resolve() : new Promise(resolve => controller.signal.addEventListener('abort', resolve, { once: true }))
  let data, input, unwatch, diagnostics
  try {
    data = mode.startsWith('mirror')
      ? await openCollection({ storage, key, nodeOptions })
      : await openCollaborativeDatabase({ storage, key, nodeOptions, signal: controller.signal })
    console.log('Opening public discovery; local data stays in', storage)
    if (process.env.P2P_DEBUG === '1') {
      diagnostics = setInterval(() => console.error('DATA_STATUS', JSON.stringify({ network: data.network.status(), database: data.state?.() })), 10000)
      diagnostics.unref()
    }
    if (mode === 'mirror-host') {
      await data.put('note', { text: 'Hello from another device' })
      await data.network.ready({ signal: controller.signal })
      console.log('SHARE', JSON.stringify({ key: data.key, version: data.version }))
      console.log('Keep this app running until the reader finishes. Ctrl+C closes safely.')
      await hold()
    } else if (mode === 'mirror-read') {
      await data.sync({ version: Number(version), timeoutMs: 60000, signal: controller.signal })
      console.log('DOWNLOADED', JSON.stringify(await data.get('note')))
    } else if (mode === 'db-host') {
      await data.network.ready({ signal: controller.signal })
      console.log('DATABASE', data.key)
      console.log('After verifying the joining device, paste its WRITER key here and press Enter.')
      input = createInterface({ input: process.stdin, output: process.stdout })
      input.on('line', line => {
        data.members.add(line.trim()).then(() => console.log('Writer approved'), error => console.error(error.message))
      })
      let last
      unwatch = data.watch(() => {
        data.get('note').then(value => {
          const text = JSON.stringify(value)
          if (value !== null && text !== last) { last = text; console.log('OBSERVED', text) }
        }).catch(error => { if (!controller.signal.aborted) console.error(error.message) })
      })
      await hold()
    } else {
      console.log('WRITER', data.writerKey)
      console.log('Ask the founder to approve this writer key. Waiting up to two minutes.')
      await data.waitFor(state => state.writable, { timeoutMs: 120000, signal: controller.signal })
      await data.put('note', { text: 'Written on another device' })
      console.log('Written locally. Confirm OBSERVED on the founder before closing. Ctrl+C exits.')
      await hold()
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(error.code || 'ERROR', error.message)
      if (error.network) console.error('Network status:', JSON.stringify(error.network))
      process.exitCode = 1
    }
  } finally {
    clearInterval(diagnostics)
    unwatch?.()
    input?.close()
    await data?.close()
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
}
