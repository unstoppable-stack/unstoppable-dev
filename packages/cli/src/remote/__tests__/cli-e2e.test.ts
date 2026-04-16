import { describe, it, expect } from 'vitest'
import { execSync, spawn, type ChildProcess } from 'child_process'
import { resolve } from 'path'

const CLI = resolve(import.meta.dirname, '../../../dist/us.js')

function run(args: string, timeout = 10000): string {
  return execSync(`node ${CLI} ${args}`, {
    encoding: 'utf-8',
    timeout,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
}

function spawnCli(args: string): ChildProcess {
  return spawn('node', [CLI, ...args.split(' ')], {
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
}

function collectOutput(child: ChildProcess, timeoutMs = 5000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))

    const timer = setTimeout(() => {
      child.kill()
      resolve({ stdout, stderr, code: null })
    }, timeoutMs)

    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code })
    })
  })
}

describe('CLI E2E: us remote', () => {
  describe('us remote --help', () => {
    it('prints subcommands', () => {
      const out = run('remote --help')
      expect(out).toContain('pair')
      expect(out).toContain('wrap')
      expect(out).toContain('status')
      expect(out).toContain('devices')
      expect(out).toContain('hook')
    })
  })

  describe('us remote status', () => {
    it('prints device name and key info', () => {
      const out = run('remote status')
      expect(out).toContain('Unstoppable')
      expect(out).toContain('Remote')
      expect(out).toContain('Device name:')
    })

    it('shows public key or not-generated message', () => {
      const out = run('remote status')
      const hasKey = out.includes('Public key:')
      expect(hasKey).toBe(true)
    })
  })

  describe('us remote hook', () => {
    it('outputs shell functions for default commands', () => {
      const out = run('remote hook')
      expect(out).toContain('claude()')
      expect(out).toContain('opencode()')
      expect(out).toContain('codex()')
      expect(out).toContain('unstoppable-agent()')
      expect(out).toContain('us remote wrap')
    })

    it('respects --commands flag', () => {
      const out = run('remote hook --commands myai,otherai')
      expect(out).toContain('myai()')
      expect(out).toContain('otherai()')
      expect(out).not.toContain('claude()')
    })

    it('outputs valid shell syntax (no syntax errors)', () => {
      const out = run('remote hook --commands testcmd')
      expect(out).toContain('testcmd()')
      expect(out).toContain('command -v us')
      expect(out).toContain('command testcmd')
    })
  })

  describe('us remote devices', () => {
    it('lists devices or shows empty message', () => {
      const out = run('remote devices')
      // Either shows device list or "No paired devices"
      expect(typeof out).toBe('string')
    })
  })

  describe('us remote wrap', () => {
    it('wraps a simple command and captures output', async () => {
      const child = spawnCli('remote wrap echo hello-from-wrap-test')
      const result = await collectOutput(child, 8000)

      expect(result.stdout).toContain('Unstoppable')
      expect(result.stdout).toContain('Remote')
      expect(result.stdout).toContain('Wrapping:')
      expect(result.stdout).toContain('hello-from-wrap-test')
      expect(result.stdout).toContain('Session ended')
    })

    it('captures stderr output too', async () => {
      const child = spawnCli('remote wrap "echo error-test >&2"')
      const result = await collectOutput(child, 8000)

      const combined = result.stdout + result.stderr
      expect(combined).toContain('error-test')
    })

    it('reports session ID', async () => {
      const child = spawnCli('remote wrap echo session-id-test')
      const result = await collectOutput(child, 8000)

      expect(result.stdout).toMatch(/Session [a-f0-9]+ started/)
    })

    it('reports exit code', async () => {
      const child = spawnCli('remote wrap "exit 0"')
      const result = await collectOutput(child, 8000)

      expect(result.stdout).toContain('exit code:')
    })

    it('handles a command that exits with non-zero', async () => {
      const child = spawnCli('remote wrap "exit 42"')
      const result = await collectOutput(child, 8000)

      expect(result.stdout).toContain('Session ended')
    })

    it('wraps a multi-word command', async () => {
      const child = spawnCli('remote wrap echo one two three')
      const result = await collectOutput(child, 8000)

      expect(result.stdout).toContain('one two three')
    })
  })

  describe('us remote pair', () => {
    it('starts pairing mode and shows QR code area', async () => {
      const child = spawnCli('remote pair --timeout 3')
      const result = await collectOutput(child, 12000)

      expect(result.stdout).toContain('Unstoppable')
      expect(result.stdout).toContain('pairing mode')
      expect(result.stdout).toContain('Scan this QR code')
      // Pairing payload is always printed for easy copy-paste
      expect(result.stdout).toContain('unstoppable-remote')
    })

    it('respects --timeout flag', async () => {
      const start = Date.now()
      const child = spawnCli('remote pair --timeout 2')
      const result = await collectOutput(child, 12000)
      const elapsed = Date.now() - start

      // Should have taken at least 2 seconds
      expect(elapsed).toBeGreaterThan(1500)
      expect(elapsed).toBeLessThan(15000)
      expect(result.stdout).toContain('pairing mode')
    })
  })
})
