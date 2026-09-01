import { Command } from 'commander'
import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, openSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { homedir } from 'os'
import chalk from 'chalk'

// ESM-friendly equivalents — esbuild's `define` doesn't synthesize these for us.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const _require = createRequire(import.meta.url)

/**
 * us node
 *
 * Friendly front-door for the Unstoppable Node. Wraps the headless daemon
 * binary (`unstoppable-node-desktop/bin/headless.js`) with three actions
 * users actually do day-to-day:
 *
 *   us node start    # spawn the daemon in the background, pid + log file
 *   us node status   # read the saved pid/log/storage; tail recent lines
 *   us node stop     # SIGTERM the saved pid, clean up the pid file
 *   us node invite   # mint a pairing code for a phone or second computer
 *
 * We deliberately don't ship a full process manager. If you outgrow this
 * (clusters, restarts, log rotation) put the daemon under systemd / launchd
 * directly. `us node start` is the local-dev equivalent of `npx some-server`.
 *
 * State files live under `~/.unstoppable/node/`:
 *   - `daemon.pid`  — process id of the running daemon
 *   - `daemon.log`  — appended stdout/stderr from the daemon
 *   - `meta.json`   — small JSON record (storagePath, args, startedAt)
 *
 * Storage default: `~/.unstoppable/node/storage/`. Override with --storage.
 */

export const STATE_DIR = join(homedir(), '.unstoppable', 'node')
export const PID_FILE = join(STATE_DIR, 'daemon.pid')
export const LOG_FILE = join(STATE_DIR, 'daemon.log')
export const META_FILE = join(STATE_DIR, 'meta.json')
const DEFAULT_STORAGE = join(STATE_DIR, 'storage')

interface DaemonMeta {
  pid: number
  storagePath: string
  args: string[]
  startedAt: string
  runtime: string
  headlessPath: string
}

function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true })
}

function readPid(): number | null {
  if (!existsSync(PID_FILE)) return null
  const raw = readFileSync(PID_FILE, 'utf8').trim()
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
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

function readMeta(): DaemonMeta | null {
  if (!existsSync(META_FILE)) return null
  try {
    return JSON.parse(readFileSync(META_FILE, 'utf8'))
  } catch {
    return null
  }
}

function clearState() {
  for (const f of [PID_FILE, META_FILE]) {
    try { unlinkSync(f) } catch {}
  }
}

// Resolve the headless daemon entry point. In a globally-installed CLI we
// expect `unstoppable-node-desktop` as a peer; in the monorepo we fall back
// to the repo-relative path so `pnpm dev` works without an extra install.
function resolveHeadlessPath(): string {
  // 1. Globally installed sibling.
  try {
    return _require.resolve('unstoppable-node-desktop/bin/headless.js')
  } catch {}
  // 2. Monorepo fallback. The built CLI lives at packages/cli/dist; the
  //    daemon at packages/node-desktop. Walk up from this file until we
  //    find a `node-desktop/bin/headless.js` sibling.
  const candidates = [
    join(__dirname, '..', '..', 'node-desktop', 'bin', 'headless.js'),         // dist → packages/cli/dist
    join(__dirname, '..', '..', '..', 'node-desktop', 'bin', 'headless.js'),   // src  → packages/cli/src/commands
  ]
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error(
    'Could not locate unstoppable-node-desktop. Install it next to this CLI, ' +
    'or run inside the unstoppable-stack monorepo.'
  )
}

interface InviteResult {
  id: string
  code: string
  publicKey: string
  expiresAt: string | null
  uses: number | null
  label: string | null
}

export function registerNodeCommand(program: Command) {
  const node = program
    .command('node')
    .description('Run and inspect the local Unstoppable Node daemon')

  node
    .command('start')
    .description('Start the Unstoppable Node in the background')
    .option('--storage <path>', `storage directory (default: ${DEFAULT_STORAGE})`)
    .option('--ai', 'enable real AI (loads QVAC; requires the model deps)')
    .option('--ai-mock', 'enable mock AI (no model download; for demos + tests)')
    .option('--ai-model <src>', 'QVAC model source (e.g. preset name or URL)')
    .option('--runtime <bin>', 'runtime to use', process.env.BARE_BIN || 'bare')
    .option('--no-background', 'run in the foreground; useful for debugging')
    .action(async (opts) => {
      ensureStateDir()

      const existing = readPid()
      if (existing && isAlive(existing)) {
        console.error(chalk.yellow(`A node is already running (pid ${existing}). Stop it first with: us node stop`))
        process.exit(1)
      }

      const storagePath = opts.storage || DEFAULT_STORAGE
      mkdirSync(storagePath, { recursive: true })

      const args = ['--storage', storagePath]
      if (opts.aiMock) args.push('--ai-mock')
      if (opts.ai) args.push('--ai')
      if (opts.aiModel) args.push('--ai-model', opts.aiModel)

      let headlessPath: string
      try {
        headlessPath = resolveHeadlessPath()
      } catch (err: any) {
        console.error(chalk.red(err.message))
        process.exit(1)
      }

      console.log(chalk.dim(`spawn: ${opts.runtime} ${headlessPath} ${args.join(' ')}`))

      if (opts.background === false) {
        // Foreground mode: just inherit stdio and exit when the child does.
        const child = spawn(opts.runtime, [headlessPath, ...args], { stdio: 'inherit' })
        child.on('exit', (code) => process.exit(code ?? 0))
        return
      }

      // Background mode: detach, write pid + meta, append to log file.
      const out = openSync(LOG_FILE, 'a')
      const err = openSync(LOG_FILE, 'a')
      const child: ChildProcess = spawn(opts.runtime, [headlessPath, ...args], {
        detached: true,
        stdio: ['ignore', out, err]
      })

      if (!child.pid) {
        console.error(chalk.red('failed to spawn daemon'))
        process.exit(1)
      }

      const meta: DaemonMeta = {
        pid: child.pid,
        storagePath,
        args,
        startedAt: new Date().toISOString(),
        runtime: opts.runtime,
        headlessPath
      }
      writeFileSync(PID_FILE, String(child.pid))
      writeFileSync(META_FILE, JSON.stringify(meta, null, 2))

      child.unref()
      console.log(chalk.green(`✓ unstoppable-node started (pid ${child.pid})`))
      console.log(chalk.dim(`  storage: ${storagePath}`))
      console.log(chalk.dim(`  log:     ${LOG_FILE}`))
      console.log()
      console.log(`Inspect: ${chalk.cyan('us node status')}`)
      console.log(`Stop:    ${chalk.cyan('us node stop')}`)
    })

  node
    .command('status')
    .description('Show the running Unstoppable Node status (and tail logs)')
    .option('-n, --lines <n>', 'number of log lines to tail', '20')
    .action((opts) => {
      const meta = readMeta()
      const pid = readPid()

      if (!pid || !meta) {
        console.log(chalk.dim('No node running.'))
        console.log(`Start one with: ${chalk.cyan('us node start --ai-mock')}`)
        return
      }
      if (!isAlive(pid)) {
        console.log(chalk.yellow(`Stale pid ${pid} (no live process). Cleaning up.`))
        clearState()
        return
      }
      console.log(chalk.green(`✓ Unstoppable Node running`))
      console.log(`  pid:        ${pid}`)
      console.log(`  startedAt:  ${meta.startedAt}`)
      console.log(`  storage:    ${meta.storagePath}`)
      console.log(`  runtime:    ${meta.runtime}`)
      console.log(`  args:       ${meta.args.join(' ')}`)
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

  node
    .command('invite')
    .description('Create a pairing code so another device or app can pair with this node')
    .option('--storage <path>', `storage directory (default: ${DEFAULT_STORAGE})`)
    .option('--expires <minutes>', 'minutes until the code stops working', '15')
    .option('--uses <n>', 'how many times the code may be redeemed (0 = unlimited)', '1')
    .option('--label <name>', 'a note to yourself about who this code is for')
    .option('--grant <cap:method...>', 'limit the code, e.g. --grant sync:status sync:usage')
    .action(async (opts) => {
      const storagePath = opts.storage || DEFAULT_STORAGE

      const minutes = Number(opts.expires)
      if (!Number.isFinite(minutes) || minutes < 0) {
        console.error(chalk.red('--expires must be a non-negative number of minutes'))
        process.exit(1)
      }
      const uses = Number(opts.uses)
      if (!Number.isInteger(uses) || uses < 0) {
        console.error(chalk.red('--uses must be a non-negative integer (0 = unlimited)'))
        process.exit(1)
      }

      // Parse `--grant sync:status` pairs into the grants map the node wants.
      let grants: Record<string, string[]> | null = null
      for (const entry of (opts.grant as string[] | undefined) || []) {
        const [capability, method] = entry.split(':')
        if (!capability || !method) {
          console.error(chalk.red(`--grant expects capability:method, got "${entry}"`))
          process.exit(1)
        }
        grants = grants || {}
        grants[capability] = [...(grants[capability] || []), method]
      }

      // Resolved dynamically, like the daemon binary: node-core is an optional
      // peer, not a hard dependency of the CLI. A non-literal specifier also
      // keeps TypeScript from trying to resolve it at build time.
      const nodeCoreSpecifier = '@unstoppable-stack/node-core'
      let issueInvite: (opts: Record<string, unknown>) => Promise<InviteResult>
      try {
        ;({ issueInvite } = (await import(nodeCoreSpecifier)) as {
          issueInvite: (opts: Record<string, unknown>) => Promise<InviteResult>
        })
      } catch {
        console.error(chalk.red('@unstoppable-stack/node-core is not installed.'))
        console.error(
          'Install it next to this CLI, or run inside the unstoppable-stack monorepo.'
        )
        process.exit(1)
        return
      }

      // Writes the invite into the node's storage directory and stops there.
      // A running daemon picks it up within seconds; there is no IPC channel
      // between `us` and the daemon. Deliberately no swarm here — starting one
      // would derive the daemon's own identity key and fight it for its DHT
      // announcement.
      try {
        const invite = await issueInvite({
          storage: storagePath,
          grants,
          uses: uses === 0 ? null : uses,
          expiresIn: minutes === 0 ? null : minutes * 60_000,
          label: opts.label || null,
        })

        console.log()
        console.log(chalk.bold('  Pairing code'))
        console.log()
        console.log(`  ${chalk.cyan(invite.code)}`)
        console.log()
        console.log(chalk.dim(`  node:    ${invite.publicKey}`))
        console.log(chalk.dim(`  expires: ${invite.expiresAt || 'never'}`))
        console.log(chalk.dim(`  uses:    ${invite.uses === null ? 'unlimited' : invite.uses}`))
        if (grants) console.log(chalk.dim(`  grants:  ${JSON.stringify(grants)}`))
        console.log()
        console.log(chalk.dim('  Share this with the other device. Anyone holding it can pair'))
        console.log(chalk.dim('  until it expires or its uses run out.'))
        console.log()
        if (!readPid()) {
          console.log(chalk.yellow('  No node is running — start one so the code can be redeemed:'))
          console.log(`    ${chalk.cyan('us node start')}`)
          console.log()
        }
      } catch (err) {
        console.error(chalk.red((err as Error).message))
        process.exit(1)
      }
    })

  node
    .command('stop')
    .description('Stop the running Unstoppable Node')
    .option('--signal <sig>', 'signal to send', 'SIGTERM')
    .action((opts) => {
      const pid = readPid()
      if (!pid) {
        console.log(chalk.dim('No node running.'))
        return
      }
      if (!isAlive(pid)) {
        console.log(chalk.yellow(`No live process for pid ${pid}. Cleaning up.`))
        clearState()
        return
      }
      // `us node start` spawns the daemon with `detached: true`, which makes
      // the child the leader of a new process group. SIGTERM to just the
      // leader pid leaves any grandchildren (e.g. Bare's own runtime child)
      // alive — `kill -- -pid` signals the whole group instead. We try the
      // group first, then fall back to the single pid if that fails (e.g.
      // foreground-started daemons don't have a separate group).
      let signaled = false
      try {
        process.kill(-pid, opts.signal)
        signaled = true
      } catch (err: any) {
        if (err?.code !== 'ESRCH' && err?.code !== 'EPERM') {
          try {
            process.kill(pid, opts.signal)
            signaled = true
          } catch (err2: any) {
            console.error(chalk.red(`Failed to stop pid ${pid}: ${err2.message}`))
            process.exit(1)
          }
        } else {
          try {
            process.kill(pid, opts.signal)
            signaled = true
          } catch {}
        }
      }
      if (signaled) {
        console.log(chalk.green(`✓ Sent ${opts.signal} to process group ${pid}.`))
      }
      clearState()
    })
}
