import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { connectNode } from './runtime.js'

export function argumentsFor(app) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      storage: { type: 'string', default: `.data/${app}` },
      invite: { type: 'string' },
      'node-invite': { type: 'string' },
      'node-key': { type: 'string' },
      'stay-open': { type: 'boolean', default: false },
    },
  })
  return { values, positionals, storage: resolve(values.storage) }
}

export function attachNode(app, values) {
  return connectNode(app, { invite: values['node-invite'], publicKey: values['node-key'] })
}

export const print = value => console.log(JSON.stringify(value, null, 2))

export async function stayOpen() {
  await new Promise(resolve => {
    const stop = () => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      resolve()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
}
