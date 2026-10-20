import { afterEach, describe, expect, it, vi } from 'vitest'
import { Command } from 'commander'
import { getPluginStatus, installPlugin, registerPluginCommand, runPluginHost } from '../commands/plugin.js'

const ID = 'unstoppable-stack@unstoppable-stack'
const SOURCE = 'unstoppable-stack/unstoppable-dev'
type Host = 'claude' | 'codex'

// Fixtures follow the native JSON schemas; no real user plugins are installed.
function host(assistant: Host, options: {
  registered?: boolean; installed?: boolean; disabled?: boolean; legacy?: boolean
  noInstall?: boolean; conflict?: boolean; scope?: string; fail?: string
  malformed?: 'marketplace' | 'plugin'; postMissing?: boolean
} = {}) {
  let registered = options.registered ?? false
  let installed = options.installed ?? false
  const run = vi.fn(async (binary: Host, args: string[], _timeout?: number) => {
    expect(binary).toBe(assistant)
    const command = args.join(' ')
    if (command === 'plugin --help') return `Commands:\n  marketplace  Manage catalogs\n${options.legacy ? '' : '  list  List plugins\n'}${options.noInstall ? '' : `  ${assistant === 'claude' ? 'install|i' : 'add'} <plugin> Install\n`}`
    if (command === 'plugin marketplace list --help') return options.legacy ? 'Usage: list' : 'Usage: list --json'
    if (command === 'plugin marketplace list --json') {
      if (options.malformed === 'marketplace') return '{}'
      const entries = registered ? [assistant === 'claude'
        ? { name: 'unstoppable-stack', source: 'github', repo: options.conflict ? 'other/repo' : SOURCE }
        : { name: 'unstoppable-stack', marketplaceSource: { source: options.conflict ? './local' : SOURCE } }] : []
      return JSON.stringify(assistant === 'codex' ? { marketplaces: entries } : entries)
    }
    if (command === 'plugin marketplace list') return registered
      ? `Configured marketplaces:\n\n  ❯ unstoppable-stack\n    Source: ${options.conflict ? 'Directory (/tmp/other)' : `GitHub (${SOURCE})`}\n`
      : 'No marketplaces configured'
    if (command === 'plugin list --help') return 'Usage: list --json --marketplace <name>'
    if (command === `plugin list --json${assistant === 'codex' ? ' --marketplace unstoppable-stack' : ''}`) {
      if (options.malformed === 'plugin') return 'unexpected output'
      // Include similarly named plugins to ensure exact identity matching.
      const entries = [{ [assistant === 'claude' ? 'id' : 'pluginId']: 'unstoppable-stack@unstoppable-stack-dev', enabled: true }]
      if (installed) entries.push({ [assistant === 'claude' ? 'id' : 'pluginId']: ID, enabled: !options.disabled, ...{ scope: options.scope ?? 'user', version: '0.1.0' } })
      return JSON.stringify(assistant === 'codex' ? { installed: entries, available: [] } : entries)
    }
    if (command.endsWith('--help')) return 'Usage: install --scope <scope>'
    if (options.fail && command.includes(options.fail)) throw new Error('host failed: network unavailable')
    if (command === `plugin marketplace add ${SOURCE}`) { registered = true; return 'added' }
    if (command === `plugin ${assistant === 'claude' ? 'install' : 'add'} ${ID}${assistant === 'claude' ? ' --scope user' : ''}`) {
      installed = !options.postMissing
      return 'installed'
    }
    throw new Error(`Unexpected command: ${command}`)
  })
  return run
}
const mutations = (run: ReturnType<typeof host>) => run.mock.calls.filter(([, args]) => !args.includes('--help') && (args.includes('add') || args.includes('install')))
afterEach(() => { vi.restoreAllMocks(); process.exitCode = 0 })

for (const assistant of ['claude', 'codex'] as const) describe(`${assistant} plugins`, () => {
  it('registers the public catalog, installs with native arguments, and verifies status', async () => {
    const run = host(assistant)
    const result = await installPlugin(assistant, run)
    expect(result).toMatchObject({ outcome: 'installed', installed: true, marketplace: 'registered', sourceMatches: true, errors: [] })
    expect(result.installations).toEqual([{ scope: 'user', version: '0.1.0', enabled: true, errors: [] }])
    expect(mutations(run).map(([, args]) => args)).toEqual([
      ['plugin', 'marketplace', 'add', SOURCE],
      ['plugin', assistant === 'claude' ? 'install' : 'add', ID, ...(assistant === 'claude' ? ['--scope', 'user'] : [])],
    ])
    expect(result.nextStep).toContain('new')
  })
  it('keeps an existing catalog and makes repeat installation a no-op', async () => {
    const run = host(assistant, { registered: true })
    expect((await installPlugin(assistant, run)).outcome).toBe('installed')
    expect((await installPlugin(assistant, run)).outcome).toBe('already-installed')
    expect(mutations(run)).toHaveLength(1)
  })
  it('preserves disabled plugins and explains how to enable them', async () => {
    const run = host(assistant, { registered: true, installed: true, disabled: true })
    const result = await installPlugin(assistant, run)
    expect(result.outcome).toBe('already-installed')
    expect(result.warnings.join(' ')).toContain('disabled')
    expect(mutations(run)).toEqual([])
  })
  it('does not replace a conflicting catalog', async () => {
    const run = host(assistant, { registered: true, conflict: true })
    const result = await installPlugin(assistant, run)
    expect(result.outcome).toBe('failed')
    expect(result.errors.join(' ')).toContain('source')
    expect(mutations(run)).toEqual([])
  })
  it('reports missing plugins without mistaking development plugins for the public plugin', async () => {
    const run = host(assistant, { registered: true })
    expect(await getPluginStatus(assistant, run)).toMatchObject({ marketplace: 'registered', installed: false, installations: [] })
    expect(mutations(run)).toEqual([])
  })
  it('stops after a catalog registration failure', async () => {
    const run = host(assistant, { fail: 'marketplace add' })
    const result = await installPlugin(assistant, run)
    expect(result).toMatchObject({ outcome: 'failed', marketplace: 'missing', installed: false })
    expect(result.errors.join(' ')).toContain('network unavailable')
    expect(mutations(run)).toHaveLength(1)
  })
  it('reports partial registration when plugin installation fails', async () => {
    const run = host(assistant, { fail: `plugin ${assistant === 'claude' ? 'install' : 'add'} ${ID}` })
    const result = await installPlugin(assistant, run)
    expect(result).toMatchObject({ outcome: 'failed', marketplace: 'registered', installed: false })
    expect(result.steps).toHaveLength(1)
  })
  it('does not claim verified installation when the post-install list is empty', async () => {
    const result = await installPlugin(assistant, host(assistant, { postMissing: true }))
    expect(result).toMatchObject({ outcome: 'failed', installed: false })
    expect(result.errors.join(' ')).toContain('does not show')
  })
  for (const malformed of ['marketplace', 'plugin'] as const) it(`fails safely on malformed ${malformed} output`, async () => {
    const run = host(assistant, { malformed })
    const result = await installPlugin(assistant, run)
    expect(result.outcome).toBe('failed')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(mutations(run)).toEqual([])
  })
})

it('supports installation with legacy Claude while leaving plugin status unknown', async () => {
  const run = host('claude', { legacy: true })
  const result = await installPlugin('claude', run)
  expect(result).toMatchObject({ outcome: 'installed', installed: null, marketplace: 'registered' })
  expect(result.warnings.join(' ')).toContain('status unavailable')
})
it('reuses the legacy Claude catalog without overwriting it', async () => {
  const run = host('claude', { legacy: true, registered: true })
  expect((await installPlugin('claude', run)).outcome).toBe('installed')
  expect(mutations(run)).toHaveLength(1)
})
it('does not treat a Claude project installation as a user installation', async () => {
  const run = host('claude', { registered: true, installed: true, scope: 'project' })
  expect((await installPlugin('claude', run)).outcome).toBe('installed')
  expect(mutations(run)).toHaveLength(1)
})
it('offers a manual Codex fallback before making changes on older hosts', async () => {
  const run = host('codex', { noInstall: true })
  const result = await installPlugin('codex', run)
  expect(result.outcome).toBe('manual-required')
  expect(result.errors.join(' ')).toContain('desktop plugin browser')
  expect(mutations(run)).toEqual([])
})
it('reports missing host executables without throwing or attempting installation', async () => {
  const run = vi.fn(async () => { throw new Error('claude was not found on PATH') })
  expect(await installPlugin('claude', run)).toMatchObject({ outcome: 'failed', installed: null, marketplace: 'unknown' })
  expect(run).toHaveBeenCalledTimes(1)
})

it('registers status for both assistants and outputs JSON with no mutations', async () => {
  const claude = host('claude')
  const codex = host('codex', { registered: true, installed: true })
  const run = vi.fn((assistant: Host, args: string[]) => (assistant === 'claude' ? claude : codex)(assistant, args))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const program = new Command()
  registerPluginCommand(program, run)
  await program.parseAsync(['plugin', 'status', '--json'], { from: 'user' })
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject([{ assistant: 'claude', installed: false }, { assistant: 'codex', installed: true }])
  expect(mutations(claude)).toEqual([])
  expect(mutations(codex)).toEqual([])
  expect(process.exitCode).toBe(0)
})
it('rejects unsupported assistant arguments before invoking any host', async () => {
  const run = vi.fn()
  const program = new Command().exitOverride().configureOutput({ writeErr: () => {} })
  registerPluginCommand(program, run)
  await expect(program.parseAsync(['plugin', 'install', 'codex;echo injected'], { from: 'user' })).rejects.toThrow()
  expect(run).not.toHaveBeenCalled()
})
it('returns a nonzero exit code for unavailable status', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const program = new Command()
  registerPluginCommand(program, host('claude', { legacy: true }))
  await program.parseAsync(['plugin', 'status', 'claude'], { from: 'user' })
  expect(process.exitCode).toBe(1)
})
it('returns a nonzero exit code for installation errors and prints JSON', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const program = new Command()
  registerPluginCommand(program, host('codex', { fail: 'marketplace add' }))
  await program.parseAsync(['plugin', 'install', 'codex', '--json'], { from: 'user' })
  expect(JSON.parse(log.mock.calls[0][0]).outcome).toBe('failed')
  expect(process.exitCode).toBe(1)
})
it('the real runner identifies a missing executable', async () => {
  const oldPath = process.env.PATH
  process.env.PATH = '/nonexistent/us-plugin-test'
  try { await expect(runPluginHost('claude', ['plugin', '--help'])).rejects.toThrow('was not found on PATH') }
  finally { process.env.PATH = oldPath }
})

it('runs native argument arrays, surfaces failures and enforces timeouts without a shell', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = await mkdtemp(join(tmpdir(), 'us-plugin-host with spaces-'))
  const oldPath = process.env.PATH
  try {
    await writeFile(join(directory, 'codex'), `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (args[0] === 'hang') setInterval(() => {}, 1000);\nelse if (args[0] === 'fail') { console.error('fixture host failed'); process.exit(2); }\nelse console.log(JSON.stringify(args));\n`, { mode: 0o755 })
    process.env.PATH = directory
    expect(JSON.parse(await runPluginHost('codex', ['plugin', 'literal; $(echo nope)']))).toEqual(['plugin', 'literal; $(echo nope)'])
    await expect(runPluginHost('codex', ['fail'])).rejects.toThrow('fixture host failed')
    await expect(runPluginHost('codex', ['hang'], 100)).rejects.toThrow('timed out')
  } finally {
    process.env.PATH = oldPath
    await rm(directory, { recursive: true, force: true })
  }
})
