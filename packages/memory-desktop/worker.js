/* global Pear */

import pearPipe from 'pear-pipe'
import { createMemoryHost } from './lib/memory-host.js'

const pipe = pearPipe()
const storagePath = Pear.config.storage

function send (msg) {
  pipe.write(JSON.stringify(msg) + '\n')
}

const host = createMemoryHost({
  storagePath,
  args: Pear.config.args || [],
  send
})

let buffer = ''
pipe.on('data', async (data) => {
  buffer += data.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      await host.handleCommand(JSON.parse(line))
    } catch (err) {
      send({ type: 'error', phase: 'command', error: err.message })
    }
  }
})

Pear.teardown(() => host.cleanup())

await host.start()
