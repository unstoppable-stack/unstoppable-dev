import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '..')
const out = join(packageRoot, 'out')

async function files (directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else result.push(path)
  }
  return result
}

const candidates = await files(out)
const executable = candidates.find((file) => {
  if (process.platform === 'darwin') return file.endsWith('.app/Contents/MacOS/unstoppable-personal-node')
  if (process.platform === 'win32') return file.endsWith('Unstoppable Personal Node.exe')
  return file.endsWith('/unstoppable-personal-node')
})

if (!executable) throw new Error(`Could not find packaged executable under ${out}`)

const child = spawn(executable, ['--smoke-test', '--qvac-smoke', '--enable-logging=stderr'], {
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
})
let output = ''
child.stdout.on('data', (data) => { output += data.toString() })
child.stderr.on('data', (data) => { output += data.toString() })

const timer = setTimeout(() => child.kill(), 30_000)
const code = await new Promise((resolveExit) => child.once('exit', resolveExit))
clearTimeout(timer)

if (
  code !== 0 ||
  !output.includes('PERSONAL_NODE_QVAC_READY 0.15.0') ||
  !output.includes('PERSONAL_NODE_SMOKE_READY')
) {
  throw new Error(`Packaged smoke failed (exit ${code})\n${output}`)
}
console.log(output.trim())
