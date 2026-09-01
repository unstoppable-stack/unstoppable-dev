import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { files, findPackagedExecutable } from './packaged-paths.mjs'

const packageRoot = resolve(import.meta.dirname, '..')
const out = join(packageRoot, 'out')

const candidates = await files(out)
const executable = findPackagedExecutable(candidates, process.platform)

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
