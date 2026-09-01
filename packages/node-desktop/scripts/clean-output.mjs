import { rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '..')
const output = resolve(packageRoot, 'out')

if (dirname(output) !== packageRoot || basename(output) !== 'out') {
  throw new Error(`Refusing to clean unexpected output path: ${output}`)
}

await rm(output, { recursive: true, force: true })
console.log(`Cleaned generated Electron output: ${output}`)
