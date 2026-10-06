import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = resolve(root, 'packages/agent-pack/src')
const bundled = resolve(root, 'packages/cli/agent-pack-src')
function inventory(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = join(prefix, entry.name)
    return entry.isDirectory() ? inventory(join(directory, entry.name), relative) : [relative]
  }).sort()
}
const a = inventory(source)
const b = inventory(bundled)
if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Agent-pack file inventories differ')
for (const file of a) {
  if (!readFileSync(join(source, file)).equals(readFileSync(join(bundled, file)))) {
    throw new Error(`Agent-pack content drift: ${file}`)
  }
}
console.log(`Agent-pack source and bundle match (${a.length} files)`)
