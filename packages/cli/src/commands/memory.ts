import { Command } from 'commander'
import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, openSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { homedir } from 'os'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const _require = createRequire(import.meta.url)

export const STATE_DIR = join(homedir(), '.unstoppable', 'memory')
export const PID_FILE = join(STATE_DIR, 'daemon.pid')
export const LOG_FILE = join(STATE_DIR, 'daemon.log')
export const META_FILE = join(STATE_DIR, 'meta.json')
const DEFAULT_STORAGE = join(STATE_DIR, 'storage')
const DEFAULT_PORT = 8787

interface DaemonMeta {
  pid: number
  storagePath: string
  port: number
  args: string[]
  startedAt: string
  runtime: string
  serverPath: string
}

export function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err: any) {
    if (err?.code === 'ESRCH') return false
    if (err?.code === 'EPERM') return true
    return false
  }
}

export function buildMcpConfig({ port = DEFAULT_PORT } = {}) {
  return {
    mcpServers: {
      'unstoppable-memory': {
        url: `http://127.0.0.1:${port}/mcp`
      }
    }
  }
}

function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true })
}

function readPid(): number | null {
  if (!existsSync(PID_FILE)) return null
  const raw = readFileSync(PID_FILE, 'utf8').trim()
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

function readMeta(): DaemonMeta | null {
  if (!existsSync(META_FILE)) return null
  try {
    return JSON.parse(readFileSync(META_FILE, 'utf8')) as DaemonMeta
  } catch {
    return null
  }
}

function clearState() {
  for (const f of [PID_FILE, META_FILE]) {
    try { unlinkSync(f) } catch {}
  }
}

function resolveServerPath(): string {
  try {
    return _require.resolve('@unstoppable/memory-mcp')
  } catch {}

  const candidates = [
    join(__dirname, '..', '..', 'memory-mcp', 'src', 'index.js'),
    join(__dirname, '..', '..', '..', 'memory-mcp', 'src', 'index.js'),
    join(__dirname, '..', '..', '..', 'packages', 'memory-mcp', 'src', 'index.js'),
  ]
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error('Memory is deferred and its source is preserved on codex/deferred-package-development. Install @unstoppable/memory-mcp from that branch next to this CLI for experimental use.')
}

export function registerMemoryCommand(program: Command) {
  const memory = program
    .command('memory')
    .description('Run and configure the local Unstoppable Memory companion service')

  memory
    .command('start')
    .description('Start Unstoppable Memory MCP service in the background')
    .option('--storage <path>', `storage directory (default: ${DEFAULT_STORAGE})`)
    .option('--port <port>', `MCP port (default: ${DEFAULT_PORT})`, String(DEFAULT_PORT))
    .option('--runtime <bin>', 'runtime to use', process.execPath)
    .option('--no-background', 'run in the foreground; useful for debugging')
    .action((opts) => {
      ensureStateDir()
      const existing = readPid()
      if (existing && isAlive(existing)) {
        console.error(chalk.yellow(`Unstoppable Memory is already running (pid ${existing}). Stop it first with: us memory stop`))
        process.exit(1)
      }

      const storagePath = opts.storage || DEFAULT_STORAGE
      const port = Number.parseInt(opts.port, 10) || DEFAULT_PORT
      mkdirSync(storagePath, { recursive: true })

      let serverPath: string
      try {
        serverPath = resolveServerPath()
      } catch (err: any) {
        console.error(chalk.red(err.message))
        process.exit(1)
      }

      const args = [serverPath, '--storage', storagePath, '--port', String(port)]
      console.log(chalk.dim(`spawn: ${opts.runtime} ${args.join(' ')}`))

      if (opts.background === false) {
        const child = spawn(opts.runtime, args, { stdio: 'inherit' })
        child.on('exit', (code) => process.exit(code ?? 0))
        return
      }

      const out = openSync(LOG_FILE, 'a')
      const err = openSync(LOG_FILE, 'a')
      const child: ChildProcess = spawn(opts.runtime, args, {
        detached: true,
        stdio: ['ignore', out, err]
      })
      if (!child.pid) {
        console.error(chalk.red('failed to spawn memory service'))
        process.exit(1)
      }

      const meta: DaemonMeta = {
        pid: child.pid,
        storagePath,
        port,
        args,
        startedAt: new Date().toISOString(),
        runtime: opts.runtime,
        serverPath
      }
      writeFileSync(PID_FILE, String(child.pid))
      writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
      child.unref()

      console.log(chalk.green(`✓ Unstoppable Memory started (pid ${child.pid})`))
      console.log(chalk.dim(`  MCP:     http://127.0.0.1:${port}/mcp`))
      console.log(chalk.dim(`  storage: ${storagePath}`))
      console.log(chalk.dim(`  log:     ${LOG_FILE}`))
      console.log()
      console.log(`Configure MCP: ${chalk.cyan('us memory setup-mcp')}`)
      console.log(`Stop:          ${chalk.cyan('us memory stop')}`)
    })

  memory
    .command('status')
    .description('Show the running Unstoppable Memory status')
    .option('-n, --lines <n>', 'number of log lines to tail', '20')
    .action((opts) => {
      const meta = readMeta()
      const pid = readPid()
      if (!pid || !meta) {
        console.log(chalk.dim('No memory service running.'))
        console.log(`Start one with: ${chalk.cyan('us memory start')}`)
        return
      }
      if (!isAlive(pid)) {
        console.log(chalk.yellow(`Stale pid ${pid} (no live process). Cleaning up.`))
        clearState()
        return
      }
      console.log(chalk.green('✓ Unstoppable Memory running'))
      console.log(`  pid:        ${pid}`)
      console.log(`  startedAt:  ${meta.startedAt}`)
      console.log(`  MCP:        http://127.0.0.1:${meta.port}/mcp`)
      console.log(`  storage:    ${meta.storagePath}`)
      console.log(`  runtime:    ${meta.runtime}`)
      console.log(`  log:        ${LOG_FILE}`)

      const n = Math.max(0, parseInt(opts.lines, 10) || 0)
      if (n > 0 && existsSync(LOG_FILE)) {
        const lines = readFileSync(LOG_FILE, 'utf8').trim().split('\n')
        const tail = lines.slice(-n)
        console.log()
        console.log(chalk.dim(`--- last ${tail.length} log lines ---`))
        for (const line of tail) console.log(line)
      }
    })

  memory
    .command('stop')
    .description('Stop the running Unstoppable Memory service')
    .option('--signal <sig>', 'signal to send', 'SIGTERM')
    .action((opts) => {
      const pid = readPid()
      if (!pid) {
        console.log(chalk.dim('No memory service running.'))
        return
      }
      if (!isAlive(pid)) {
        console.log(chalk.yellow(`No live process for pid ${pid}. Cleaning up.`))
        clearState()
        return
      }
      try {
        process.kill(-pid, opts.signal)
      } catch {
        try { process.kill(pid, opts.signal) } catch {}
      }
      clearState()
      console.log(chalk.green(`✓ Sent ${opts.signal} to Unstoppable Memory.`))
    })

  memory
    .command('setup-mcp')
    .description('Print MCP client configuration for Unstoppable Memory')
    .option('--port <port>', `MCP port (default: ${DEFAULT_PORT})`, String(DEFAULT_PORT))
    .action((opts) => {
      const port = Number.parseInt(opts.port, 10) || DEFAULT_PORT
      console.log(JSON.stringify(buildMcpConfig({ port }), null, 2))
    })
}
