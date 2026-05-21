import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

// End-to-end coverage for `us remote *` subcommand surface. These are
// black-box tests that shell out to the built CLI binary.
//
// Scope: only commands that can answer without a running daemon
// (`--help`, `status`, `hook`). Everything that mutates daemon state
// (`start`, `stop`, `pair`, `run`, `sessions`, `logs`, `phones`, `testnet`)
// is deliberately out of scope here — those are better covered by
// integration tests in `p2p-integration.test.ts` that own the daemon
// lifecycle, and they'd otherwise spawn real DHT connections during
// `pnpm test` and make the suite network-dependent and flaky.

const CLI = resolve(import.meta.dirname, '../../../dist/us.js')

// Build-time feature flags (see `tsup.config.ts`) can omit `us remote`
// entirely — that's the whole point of the `minimal` shipping profile.
// When that happens this test can't run, so we skip the whole describe
// block rather than failing noisily. To force these to run locally:
//   pnpm build:full && pnpm test
// (or use `pnpm test:full`, which chains both).
const hasRemote = (() => {
  if (!existsSync(CLI)) return false
  try {
    const help = execSync(`node ${CLI} --help`, { encoding: 'utf-8' })
    return help.includes('remote ')
  } catch {
    return false
  }
})()

const d = hasRemote ? describe : describe.skip

function run(args: string, timeout = 10_000): string {
  return execSync(`node ${CLI} ${args}`, {
    encoding: 'utf-8',
    timeout,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
}

d('CLI E2E: us remote', () => {
  describe('us remote --help', () => {
    it('lists every subcommand we expose', () => {
      const out = run('remote --help')
      // Current surface (as of the daemon refactor):
      //   start · stop · pair · run · sessions · logs · phones · status ·
      //   testnet · hook
      // If any of these go missing we want a loud failure.
      for (const cmd of [
        'start',
        'stop',
        'pair',
        'run',
        'sessions',
        'logs',
        'phones',
        'status',
        'testnet',
        'hook',
      ]) {
        expect(out, `missing "us remote ${cmd}"`).toContain(cmd)
      }
    })

    it('documents the daemon/pairing intent', () => {
      const out = run('remote --help')
      expect(out.toLowerCase()).toContain('p2p')
    })
  })

  describe('us remote status', () => {
    it('reports daemon state, device name, and public key without needing a daemon', () => {
      const out = run('remote status')
      expect(out).toContain('Unstoppable Remote')
      expect(out).toContain('Daemon:')
      expect(out).toContain('Device:')
      expect(out).toContain('Public key:')
    })

    it('surfaces a start hint when the daemon is stopped', () => {
      const out = run('remote status')
      if (out.includes('Stopped')) {
        expect(out).toContain('us remote start')
      }
    })
  })

  describe('us remote hook', () => {
    it('emits shell functions for every default wrappable AI command', () => {
      const out = run('remote hook')
      for (const cmd of ['claude', 'opencode', 'codex', 'unstoppable-agent']) {
        expect(out, `missing hook for "${cmd}"`).toContain(`${cmd}()`)
      }
    })

    it('each function falls back to the real binary when the daemon is down', () => {
      // The hook must be a no-op in the Stopped case — tested via shape.
      const out = run('remote hook')
      expect(out).toContain('us remote status')
      expect(out).toContain('grep -q "Running"')
      expect(out).toContain('us remote run')
      expect(out).toMatch(/command (claude|opencode|codex|unstoppable-agent)/)
    })

    it('respects --commands to override the default command list', () => {
      const out = run('remote hook --commands myai,otherai')
      expect(out).toContain('myai()')
      expect(out).toContain('otherai()')
      // Defaults should NOT be present when an override was given.
      expect(out).not.toContain('claude()')
      expect(out).not.toContain('opencode()')
    })

    it('emits syntactically valid shell (evaluable by bash with -n)', () => {
      const out = run('remote hook --commands testcmd')
      // `bash -n` parses without executing — a clean exit proves syntactic
      // validity, which is all we care about here (we don't want to
      // actually redefine shell functions in the test host's shell).
      //
      // Write via fs rather than shelling out to printf; the hook body
      // contains nested quoting (`command -v us >/dev/null 2>&1`, etc.) that
      // is a pain to round-trip safely through any printf/echo/heredoc.
      const tmp = resolve(tmpdir(), `us-remote-hook-${process.pid}.sh`)
      writeFileSync(tmp, out, 'utf-8')
      try {
        execSync(`bash -n ${tmp}`, { encoding: 'utf-8' })
      } finally {
        try {
          unlinkSync(tmp)
        } catch {
          // best-effort cleanup
        }
      }
    })
  })

  describe('us remote subcommand help', () => {
    // Spot-check that every subcommand responds to --help — catches the
    // case where a subcommand is removed from `--help` listing but its
    // handler still lingers or vice versa.
    for (const cmd of ['pair', 'run', 'sessions', 'logs', 'phones', 'hook']) {
      it(`\`us remote ${cmd} --help\` prints a usage line`, () => {
        const out = run(`remote ${cmd} --help`)
        expect(out).toContain(`Usage: us remote ${cmd}`)
      })
    }
  })
})
