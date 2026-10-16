import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(fileURLToPath(new URL('../examples/ecommerce-assistant/package.json', import.meta.url)))
const DHT = require('hyperdht')
const dht = new DHT()
const timeout = promise => Promise.race([
  promise,
  new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('No DHT reply within 15 seconds')), 15000)
    timer.unref()
  }),
])
try {
  const results = await Promise.allSettled([
    '88.99.3.86', '142.93.90.113', '138.68.147.8',
  ].map(async host => {
    await timeout(dht.ping({ host, port: 49737 }))
    return { host, result: 'reply' }
  }))
  console.log(JSON.stringify({
    bootstrap: results.map((result, i) => result.status === 'fulfilled' ? result.value : { node: i + 1, error: result.reason.message }),
    routingNodes: dht.toArray().length,
  }, null, 2))
  if (!results.some(result => result.status === 'fulfilled')) process.exitCode = 1
} finally {
  await dht.destroy()
}
