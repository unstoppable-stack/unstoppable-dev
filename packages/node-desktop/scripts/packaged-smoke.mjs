import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { files, findPackagedExecutable } from './packaged-paths.mjs'

if (process.env.PERSONAL_NODE_REAL_QVAC === '1' && !process.env.QVAC_MODEL_SRC) {
  throw new Error('QVAC_MODEL_SRC is required for actual packaged inference')
}

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

const timer = setTimeout(() => child.kill(), process.env.PERSONAL_NODE_REAL_QVAC === '1' ? 120_000 : 30_000)
const code = await new Promise((resolveExit) => child.once('exit', resolveExit))
clearTimeout(timer)

if (
  code !== 0 ||
  !output.includes('PERSONAL_NODE_QVAC_READY 0.21.0') ||
  !output.includes('PERSONAL_NODE_SMOKE_READY') ||
  (process.env.PERSONAL_NODE_REAL_QVAC === '1' && !output.includes('PERSONAL_NODE_QVAC_COMPLETION'))
) {
  throw new Error(`Packaged smoke failed (exit ${code})\n${output}`)
}
console.log(output.trim())
