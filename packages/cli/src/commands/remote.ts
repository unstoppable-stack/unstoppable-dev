import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { existsSync, readFileSync, openSync } from 'fs'
import { fileURLToPath } from 'url'
import { sendCommand, isDaemonRunning } from '../remote/ipc-client.js'
import { getPidPath, getSockPath } from '../remote/daemon.js'
import { loadConfig } from '../remote/config.js'

function getDaemonScriptPath(): string {
  // When bundled with tsup, resolve relative to the dist/ root
  const thisFile = fileURLToPath(import.meta.url)
  const distRoot = dirname(thisFile).replace(/\/commands$/, '').replace(/[\\/]chunk.*$/, '')
  // Try common locations
  const candidates = [
    resolve(distRoot, 'remote', 'daemon-entry.js'),
    resolve(distRoot, '..', 'dist', 'remote', 'daemon-entry.js'),
    resolve(dirname(thisFile), '..', 'remote', 'daemon-entry.js'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return candidates[0]
}

const accent = chalk.hex('#00d4aa')
const muted = chalk.hex('#71717a')

function bootstrapFlag(cmd: Command) {
  return cmd.option(
    '-b, --bootstrap <addrs>',
    'DHT bootstrap addresses (comma-separated, for local testing)'
  )
}

function requireDaemon() {
  if (!isDaemonRunning()) {
    console.error(chalk.red('  Daemon is not running.'))
    console.error(muted('  Start it with: ') + accent('us remote start'))
    process.exit(1)
  }
}

export function registerRemoteCommand(program: Command) {
  const remote = program
    .command('remote')
    .description('P2P remote control — stream AI sessions to your phone')

  // ─── us remote start ──────────────────────────────────────────
  bootstrapFlag(
    remote
      .command('start')
      .description('Start the background daemon (persistent P2P + session manager)')
  )
    .option('-f, --foreground', 'Run in foreground (don\'t detach)')
    .option('-t, --test-port <port>', 'Open a TCP port for local testing (bypasses DHT)')
    .action(async (options) => {
      if (isDaemonRunning()) {
        console.log(accent('  Daemon is already running.'))
        console.log(muted('  Use ') + accent('us remote stop') + muted(' to restart.'))
        return
      }

      const daemonScript = getDaemonScriptPath()

      if (options.foreground) {
        console.log(muted('  Starting daemon in foreground...'))
        const daemonArgs = [daemonScript]
        if (options.bootstrap) daemonArgs.push('--bootstrap', options.bootstrap)
        if (options.testPort) daemonArgs.push('--test-port', options.testPort)
        const child = spawn('node', daemonArgs, { stdio: 'inherit' })
        child.on('exit', (code) => process.exit(code ?? 0))
        return
      }

      // Detached background mode
      const daemonArgs = [daemonScript]
      if (options.bootstrap) daemonArgs.push('--bootstrap', options.bootstrap)
      if (options.testPort) daemonArgs.push('--test-port', options.testPort)

      const logDir = resolve(getSockPath(), '..')
      const { mkdirSync } = await import('fs')
      mkdirSync(logDir, { recursive: true })
      const logPath = resolve(logDir, 'daemon.log')
      const out = openSync(logPath, 'a')
      const child = spawn('node', daemonArgs, {
        detached: true,
        stdio: ['ignore', out, out],
      })
      child.unref()

      // Wait for daemon to be ready
      await new Promise((r) => setTimeout(r, 1500))

      if (isDaemonRunning()) {
        console.log()
        console.log(muted('  ─────────────────────────────────────────'))
        console.log(chalk.bold.white('     📡 ') + chalk.bold.white('Unstoppable ') + accent('Remote'))
        console.log(muted('  ─────────────────────────────────────────'))
        console.log()
        console.log(accent('  ✓ ') + `Daemon started (PID: ${child.pid})`)
        console.log(muted(`    Log: ${logPath}`))
        console.log()
        console.log(muted('  Next steps:'))
        console.log(accent('    us remote pair') + muted('       — pair your phone'))
        console.log(accent('    us remote run <cmd>') + muted('  — start a session'))
        console.log(accent('    us remote sessions') + muted('  — list sessions'))
        console.log(accent('    us remote stop') + muted('       — stop daemon'))
        console.log()
      } else {
        console.error(chalk.red('  Daemon failed to start. Check log:'))
        console.error(muted(`    ${logPath}`))
        process.exit(1)
      }
    })

  // ─── us remote stop ───────────────────────────────────────────
  remote
    .command('stop')
    .description('Stop the background daemon')
    .action(async () => {
      if (!isDaemonRunning()) {
        console.log(muted('  Daemon is not running.'))
        return
      }
      try {
        await sendCommand({ cmd: 'stop' })
        console.log(accent('  ✓ ') + 'Daemon stopped.')
      } catch {
        // Force kill via PID
        try {
          const pid = parseInt(readFileSync(getPidPath(), 'utf-8'))
          process.kill(pid, 'SIGTERM')
          console.log(accent('  ✓ ') + 'Daemon stopped (via signal).')
        } catch {
          console.log(chalk.red('  Could not stop daemon.'))
        }
      }
    })

  // ─── us remote pair ───────────────────────────────────────────
  remote
    .command('pair')
    .description('Enter pairing mode (show QR code for phone)')
    .action(async () => {
      requireDaemon()

      try {
        const resp = await sendCommand({ cmd: 'pair' })
        if (!resp.ok) {
          console.error(chalk.red(`  Error: ${resp.error}`))
          return
        }

        console.log()
        console.log(muted('  ─────────────────────────────────────────'))
        console.log(chalk.bold.white('     📱 ') + chalk.bold.white('Unstoppable ') + accent('Remote'))
        console.log(muted('     Scan QR to pair your phone'))
        console.log(muted('  ─────────────────────────────────────────'))
        console.log()

        let qrcode: any
        try {
          qrcode = await import('qrcode-terminal')
          qrcode = qrcode.default || qrcode
        } catch {}

        if (qrcode) {
          qrcode.generate(resp.payload, { small: true }, (code: string) => {
            for (const line of code.split('\n')) {
              console.log('  ' + line)
            }
          })
          console.log()
        }

        console.log(muted('  Pairing payload (for test client):'))
        console.log(accent(`  ${resp.payload}`))
        console.log()
        console.log(muted('  Daemon is waiting for the phone to connect...'))
        console.log(muted('  Check status with: ') + accent('us remote phones'))
        console.log()
      } catch (err: any) {
        console.error(chalk.red(`  ${err.message}`))
      }
    })

  // ─── us remote run ────────────────────────────────────────────
  remote
    .command('run <cmd...>')
    .description('Start a new session (spawns command via daemon)')
    .action(async (cmd: string[]) => {
      requireDaemon()

      const [command, ...args] = cmd
      try {
        const resp = await sendCommand({ cmd: 'run', command, args })
        if (!resp.ok) {
          console.error(chalk.red(`  Error: ${resp.error}`))
          return
        }

        console.log(accent('  ✓ ') + `Session started: ${command} ${args.join(' ')}`)
        console.log(muted(`    ID: ${resp.sessionId}`))
        console.log()
        console.log(muted('  View output: ') + accent(`us remote logs ${resp.sessionId.slice(0, 8)}`))
        console.log(muted('  All sessions: ') + accent('us remote sessions'))
        console.log()
      } catch (err: any) {
        console.error(chalk.red(`  ${err.message}`))
      }
    })

  // ─── us remote sessions ───────────────────────────────────────
  remote
    .command('sessions')
    .description('List all sessions managed by the daemon')
    .action(async () => {
      requireDaemon()

      try {
        const resp = await sendCommand({ cmd: 'sessions' })
        if (!resp.ok || !resp.sessions.length) {
          console.log(muted('  No sessions.'))
          console.log(muted('  Start one with: ') + accent('us remote run <command>'))
          return
        }

        console.log()
        console.log(chalk.bold(`  Sessions (${resp.sessions.length}):`))
        console.log()
        for (const s of resp.sessions) {
          const dot = s.active !== false ? chalk.green('●') : chalk.gray('○')
          console.log(`  ${dot} ${chalk.bold(s.command)}`)
          console.log(muted(`    ID: ${s.id}  Started: ${new Date(s.startedAt).toLocaleTimeString()}  Peers: ${s.peers}`))
        }
        console.log()
      } catch (err: any) {
        console.error(chalk.red(`  ${err.message}`))
      }
    })

  // ─── us remote logs ───────────────────────────────────────────
  remote
    .command('logs [session-id]')
    .description('View session output logs')
    .option('-n, --tail <lines>', 'Number of lines to show', '50')
    .action(async (sessionId, options) => {
      requireDaemon()

      if (!sessionId) {
        // Show latest session
        const resp = await sendCommand({ cmd: 'sessions' })
        if (!resp.ok || !resp.sessions.length) {
          console.log(muted('  No sessions to show logs for.'))
          return
        }
        sessionId = resp.sessions[resp.sessions.length - 1].id
      }

      try {
        const resp = await sendCommand({ cmd: 'logs', sessionId, tail: parseInt(options.tail) })
        if (!resp.ok) {
          console.error(chalk.red(`  ${resp.error}`))
          return
        }

        console.log(muted(`  ── Session ${sessionId.slice(0, 8)} (${resp.totalLines} lines total) ──`))
        console.log()
        process.stdout.write(resp.output)
        console.log()
      } catch (err: any) {
        console.error(chalk.red(`  ${err.message}`))
      }
    })

  // ─── us remote phones ─────────────────────────────────────────
  remote
    .command('phones')
    .description('Show connected phones')
    .action(async () => {
      requireDaemon()

      try {
        const resp = await sendCommand({ cmd: 'phones' })
        if (!resp.ok || !resp.phones.length) {
          console.log(muted('  No phones connected.'))
          console.log(muted('  Pair one with: ') + accent('us remote pair'))
          return
        }

        console.log()
        console.log(chalk.bold(`  Connected Phones (${resp.phones.length}):`))
        for (const p of resp.phones) {
          console.log(accent('    📱 ') + p.short)
        }
        console.log()
      } catch (err: any) {
        console.error(chalk.red(`  ${err.message}`))
      }
    })

  // ─── us remote status ─────────────────────────────────────────
  remote
    .command('status')
    .description('Show daemon status, paired devices, and connections')
    .action(async () => {
      const running = isDaemonRunning()
      const config = loadConfig()

      console.log()
      console.log(muted('  ─────────────────────────────────────────'))
      console.log(chalk.bold.white('     📡 ') + chalk.bold.white('Unstoppable ') + accent('Remote') + chalk.bold.white(' Status'))
      console.log(muted('  ─────────────────────────────────────────'))
      console.log()
      console.log(chalk.bold('  Daemon:     ') + (running ? chalk.green('Running') : chalk.red('Stopped')))
      console.log(chalk.bold('  Device:     ') + accent(config.deviceName))
      if (config.keypair) {
        console.log(chalk.bold('  Public key: ') + muted(config.keypair.publicKey.slice(0, 16) + '...'))
      }
      console.log(chalk.bold('  Paired:     ') + `${config.trustedDevices.length} device(s)`)

      if (running) {
        try {
          const phones = await sendCommand({ cmd: 'phones' })
          const sessions = await sendCommand({ cmd: 'sessions' })
          console.log(chalk.bold('  Phones:     ') + `${phones.phones?.length || 0} connected`)
          console.log(chalk.bold('  Sessions:   ') + `${sessions.sessions?.length || 0} active`)
        } catch {}
      }
      console.log()

      if (!running) {
        console.log(muted('  Start with: ') + accent('us remote start'))
        console.log()
      }
    })

  // ─── us remote testnet ────────────────────────────────────────
  remote
    .command('testnet')
    .description('Start a local DHT testnet for same-machine testing')
    .action(async () => {
      // @ts-ignore
      const createTestnet = (await import('@hyperswarm/testnet')).default
      const testnet = await createTestnet(3)
      const addrs = testnet.bootstrap.map((b: any) => `${b.host}:${b.port}`)
      const flag = addrs.join(',')

      console.log()
      console.log(muted('  ─────────────────────────────────────────'))
      console.log(chalk.bold.white('     🧪 ') + chalk.bold.white('Unstoppable ') + accent('Testnet'))
      console.log(muted('  ─────────────────────────────────────────'))
      console.log()
      console.log(chalk.bold('  Local DHT: ') + accent(flag))
      console.log()
      console.log(muted('  Usage:'))
      console.log(accent(`    us remote start --bootstrap ${flag}`))
      console.log(accent(`    us remote pair`))
      console.log(accent(`    us remote run echo hello`))
      console.log()
      console.log(muted('  Press Ctrl+C to stop'))

      process.on('SIGINT', async () => {
        await testnet.destroy()
        process.exit(0)
      })
    })

  // ─── us remote hook ───────────────────────────────────────────
  remote
    .command('hook')
    .description('Output shell hook for auto-wrapping AI commands')
    .option('--commands <list>', 'Comma-separated list of commands to wrap', 'claude,opencode,codex,unstoppable-agent')
    .action((options) => {
      const commands = options.commands.split(',').map((c: string) => c.trim())
      const hookScript = commands
        .map(
          (cmd: string) => `
${cmd}() {
  if command -v us >/dev/null 2>&1 && us remote status 2>/dev/null | grep -q "Running"; then
    us remote run ${cmd} "$@"
  else
    command ${cmd} "$@"
  fi
}`
        )
        .join('\n')

      console.log(`# Unstoppable Remote — shell hook`)
      console.log(`# Add to your .zshrc/.bashrc: eval "$(us remote hook)"`)
      console.log(hookScript)
    })
}
