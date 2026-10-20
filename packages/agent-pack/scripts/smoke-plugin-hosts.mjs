import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const rawArgs = process.argv.slice(2)
const publicMode = rawArgs.includes('--public')
const marketplaceName = publicMode ? 'unstoppable-stack' : 'unstoppable-stack-dev'
const args = rawArgs.filter(arg => arg !== '--public')
const reportIndex = args.indexOf('--report')
const reportPath = reportIndex === -1 ? null : args[reportIndex + 1]
if (args.length && (reportIndex !== 0 || args.length !== 2 || !reportPath)) {
  throw new Error('Usage: node scripts/smoke-plugin-hosts.mjs [--public] [--report <file>]')
}
const temporary = mkdtempSync(join(tmpdir(), 'us-plugin-hosts-'))
// A globally installed copy can hide the candidate in `list --available`.
// Native discovery checks must not inherit or change user plugin state.
const codexHome = join(temporary, 'codex-home')
mkdirSync(codexHome)
const codexEnv = { ...process.env, CODEX_HOME: codexHome }
let child
const report = { timestamp: new Date().toISOString(), scope: 'Native package/catalog parsing only; no model turn, global installation or app acceptance', hosts: {} }
function run(command, params, cwd = temporary) {
  const result = spawnSync(command, params, { cwd, encoding: 'utf8', timeout: 20000, env: command === 'codex' ? codexEnv : process.env })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

try {
  const catalog = join(temporary, 'catalog')
  if (publicMode) {
    const repo = fileURLToPath(new URL('../../../', import.meta.url))
    cpSync(join(packageRoot, 'plugins'), join(catalog, 'packages/agent-pack/plugins'), { recursive: true })
    for (const path of ['.agents', '.claude-plugin']) cpSync(join(repo, path), join(catalog, path), { recursive: true })
  } else cpSync(join(packageRoot, 'dist'), catalog, { recursive: true })
  const claudeRoot = publicMode ? join(catalog, 'packages/agent-pack/plugins/claude') : join(catalog, 'claude')
  const portableRoot = publicMode ? join(catalog, 'packages/agent-pack/plugins/portable') : join(catalog, 'portable')
  const claudeVersion = run('claude', ['--version'])
  const pluginValidation = run('claude', ['plugin', 'validate', claudeRoot])
  const catalogValidation = run('claude', ['plugin', 'validate', join(catalog, '.claude-plugin/marketplace.json')])
  assert(pluginValidation.includes('Validation passed'))
  assert(catalogValidation.includes('Validation passed'))
  assert(!catalogValidation.includes('warning'))
  report.hosts.claude = { version: claudeVersion, pluginValidation, catalogValidation, sessionSkillDiscovery: 'not evaluated' }

  const codexVersion = run('codex', ['--version'])
  const list = JSON.parse(run('codex', ['plugin', 'list', '--available', '--json', '-m', marketplaceName,
    '-c', `marketplaces.${marketplaceName}.source_type="local"`,
    '-c', `marketplaces.${marketplaceName}.source=${JSON.stringify(catalog)}`]))
  const version = JSON.parse(readFileSync(join(portableRoot, 'plugin.json'))).version
  assert.equal(list.available.find(plugin => plugin.name === 'unstoppable-stack')?.version, version)

  child = spawn('codex', ['app-server', '-c', `sqlite_home=${JSON.stringify(join(temporary, 'state'))}`,
    '-c', `log_dir=${JSON.stringify(join(temporary, 'logs'))}`], { cwd: temporary, env: codexEnv, stdio: ['pipe', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-2000) })
  const pending = new Map()
  const lines = createInterface({ input: child.stdout })
  lines.on('line', line => {
    let value
    try { value = JSON.parse(line) } catch { return }
    const callbacks = pending.get(value.id)
    if (!callbacks) return
    pending.delete(value.id)
    clearTimeout(callbacks.timer)
    if (value.error) callbacks.reject(new Error(JSON.stringify(value.error)))
    else callbacks.resolve(value.result)
  })
  child.on('exit', () => {
    for (const callbacks of pending.values()) {
      clearTimeout(callbacks.timer)
      callbacks.reject(new Error(`Codex app-server exited: ${stderr}`))
    }
    pending.clear()
  })
  let id = 0
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timeout: ${method}`)) }, 20000)
    pending.set(requestId, { resolve, reject, timer })
    child.stdin.write(JSON.stringify({ id: requestId, method, params }) + '\n')
  })
  await request('initialize', { clientInfo: { name: 'unstoppable-plugin-smoke', version: '0.1.0' }, capabilities: { experimentalApi: true } })
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
  const { plugin } = await request('plugin/read', { marketplacePath: join(catalog, '.agents/plugins/marketplace.json'), pluginName: 'unstoppable-stack' })
  const names = plugin.skills.map(skill => skill.name).sort()
  assert(names.includes('unstoppable-stack:build-with-unstoppable'), `Parsed skill names: ${JSON.stringify(names)}`)
  assert(names.includes('unstoppable-stack:unstoppable-modules'))
  assert.equal(names.length, 19)
  assert.deepEqual(plugin.hooks, [])
  assert.deepEqual(plugin.mcpServers, [])
  report.hosts.codex = { version: codexVersion, packageVersion: version, marketplaceName, catalogDiscovery: 'passed',
    packageSkillParsing: 'passed', skillNames: names, sessionActivation: 'not evaluated' }
  console.log(JSON.stringify(report, null, 2))
  if (reportPath) {
    mkdirSync(dirname(resolve(reportPath)), { recursive: true })
    writeFileSync(resolve(reportPath), JSON.stringify(report, null, 2) + '\n')
  }
} finally {
  if (child && child.exitCode === null) {
    await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM') })
  }
  rmSync(temporary, { recursive: true, force: true })
}
