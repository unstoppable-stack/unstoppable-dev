import { Argument, Command } from 'commander'
import { execFile } from 'node:child_process'

const SOURCE = 'unstoppable-stack/unstoppable-dev'
const MARKETPLACE = 'unstoppable-stack'
const PLUGIN = `${MARKETPLACE}@${MARKETPLACE}`
type Assistant = 'claude' | 'codex'
type Run = (assistant: Assistant, args: string[], timeout?: number) => Promise<string>
type Installation = { scope: string; version: string | null; enabled: boolean | null; errors: string[] }
export type PluginStatus = {
  assistant: Assistant
  plugin: string
  marketplace: 'registered' | 'missing' | 'unknown'
  sourceMatches: boolean | null
  installed: boolean | null
  installations: Installation[]
  warnings: string[]
  errors: string[]
}

// Fixed executables and argument arrays: never run host commands through a shell.
export const runPluginHost: Run = (assistant, args, timeout = 15_000) => new Promise((resolve, reject) => {
  execFile(assistant, args, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (!error) return resolve(stdout)
    const reason = (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? `${assistant} was not found on PATH. Install the assistant first.`
      : error.killed ? 'Command timed out; inspect the host before retrying.' : stderr.trim() || stdout.trim() || error.message
    reject(new Error(`${assistant} ${args.join(' ')}: ${reason}`))
  })
})

function supports(help: string, command: string) {
  return new RegExp(`^\\s*${command}(?:[|\\s<]|$)`, 'm').test(help)
}
function publicSource(source: unknown) {
  return typeof source === 'string' && [SOURCE, `https://github.com/${SOURCE}`, `https://github.com/${SOURCE}.git`].includes(source)
}
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Unrecognized host JSON; cannot verify plugin state.')
  }
  return value
}

async function marketplaceStatus(assistant: Assistant, run: Run, status: PluginStatus) {
  const help = await run(assistant, ['plugin', 'marketplace', 'list', '--help'])
  if (help.includes('--json')) {
    const data = JSON.parse(await run(assistant, ['plugin', 'marketplace', 'list', '--json']))
    const entries = records(assistant === 'codex' ? data.marketplaces : data)
    if (entries.some(entry => typeof entry.name !== 'string')) throw new Error('Unrecognized marketplace names.')
    const entry = entries.find(entry => entry.name === MARKETPLACE)
    status.marketplace = entry ? 'registered' : 'missing'
    status.sourceMatches = entry ? publicSource(assistant === 'codex'
      ? (entry.marketplaceSource as { source?: unknown } | undefined)?.source
      : entry.repo ?? entry.url) : null
  } else if (assistant === 'claude') {
    // Claude 2.0.x has no JSON list. Accept only its known listing format.
    const text = (await run(assistant, ['plugin', 'marketplace', 'list'])).replace(/\x1b\[[0-9;]*m/g, '')
    if (/^No marketplaces configured\.?\s*$/.test(text.trim())) {
      status.marketplace = 'missing'
      return
    }
    if (!text.trim().startsWith('Configured marketplaces:')) throw new Error('Unrecognized marketplace listing.')
    const entries = [...text.matchAll(/^\s*❯ ([^\n]+)\n\s*Source: ([^\n]+)/gm)]
    if (!entries.length) throw new Error('Unrecognized marketplace listing.')
    const entry = entries.find(entry => entry[1].trim() === MARKETPLACE)
    status.marketplace = entry ? 'registered' : 'missing'
    status.sourceMatches = entry ? entry[2].trim() === `GitHub (${SOURCE})` : null
  } else {
    throw new Error('This Codex version cannot list marketplaces as JSON. Upgrade Codex.')
  }
}

async function inspect(assistant: Assistant, run: Run) {
  const status: PluginStatus = {
    assistant, plugin: PLUGIN, marketplace: 'unknown', sourceMatches: null,
    installed: null, installations: [], warnings: [], errors: [],
  }
  let help: string
  try { help = await run(assistant, ['plugin', '--help']) }
  catch (error) { status.errors.push((error as Error).message); return { status, help: '' } }
  try { await marketplaceStatus(assistant, run, status) }
  catch (error) { status.errors.push((error as Error).message) }
  if (status.sourceMatches === false) status.warnings.push(`The ${MARKETPLACE} catalog points to another or unverifiable source. It will not be replaced.`)
  if (!supports(help, 'list')) {
    status.warnings.push(`Plugin status unavailable: this ${assistant} version has no plugin list command. Inspect the desktop plugin browser or upgrade ${assistant}.`)
    return { status, help }
  }
  try {
    const listHelp = await run(assistant, ['plugin', 'list', '--help'])
    if (!listHelp.includes('--json')) throw new Error('Plugin status unavailable: this host has no JSON plugin list. Upgrade the assistant.')
    // A global Codex list also queries the remote public directory. Restrict
    // inspection to our catalog so unrelated service latency cannot block setup.
    const filter = assistant === 'codex' && listHelp.includes('--marketplace')
      ? ['--marketplace', MARKETPLACE] : []
    const data = JSON.parse(await run(assistant, ['plugin', 'list', '--json', ...filter]))
    const entries = records(assistant === 'codex' ? data.installed : data)
    const idKey = assistant === 'codex' ? 'pluginId' : 'id'
    if (entries.some(entry => typeof entry[idKey] !== 'string')) throw new Error('Unrecognized plugin identities.')
    status.installations = entries.filter(entry => entry[idKey] === PLUGIN).map(entry => ({
      scope: typeof entry.scope === 'string' ? entry.scope : 'host',
      version: typeof entry.version === 'string' ? entry.version : null,
      enabled: typeof entry.enabled === 'boolean' ? entry.enabled : null,
      errors: Array.isArray(entry.errors) ? entry.errors.map(String) : [],
    }))
    status.installed = status.installations.length > 0
  } catch (error) { status.errors.push((error as Error).message) }
  return { status, help }
}

export async function getPluginStatus(assistant: Assistant, run: Run = runPluginHost) {
  return (await inspect(assistant, run)).status
}

export async function installPlugin(assistant: Assistant, run: Run = runPluginHost) {
  const { status, help } = await inspect(assistant, run)
  const steps: string[] = []
  const nextStep = assistant === 'claude'
    ? 'Start a new Claude Code session. For Claude Desktop, reopen Code → Local. Select unstoppable-stack:build-with-unstoppable.'
    : 'Start a new chat in the target workspace and select unstoppable-stack:build-with-unstoppable.'
  const result = { ...status, steps, outcome: 'failed', nextStep }
  const installCommand = assistant === 'claude' ? 'install' : 'add'
  if (!help) return result
  if (!supports(help, installCommand)) {
    result.outcome = 'manual-required'
    result.errors.push(`This ${assistant} version cannot install plugins from the CLI. Use the desktop plugin browser to add ${SOURCE} and install ${PLUGIN}, or upgrade ${assistant}.`)
    return result
  }
  if (status.marketplace === 'unknown' || status.sourceMatches === false) {
    result.errors.push('Cannot verify the public catalog source. Inspect the host marketplace list before installing.')
    return result
  }
  if (status.errors.length) return result
  // A user-scope Claude installation is distinct from a project/local install.
  if (status.installed && status.installations.some(entry => assistant === 'codex' || entry.scope === 'user')) {
    result.outcome = 'already-installed'
    if (status.installations.some(entry => entry.enabled === false)) result.warnings.push('The plugin is disabled in host settings. Enable it in the plugin browser when ready.')
    return result
  }
  try {
    const installHelp = await run(assistant, ['plugin', installCommand, '--help'])
    if (assistant === 'claude' && !installHelp.includes('--scope')) throw new Error('This Claude version cannot select user scope. Upgrade Claude Code.')
    if (status.marketplace === 'missing') {
      await run(assistant, ['plugin', 'marketplace', 'add', SOURCE], 120_000)
      result.marketplace = 'registered'
      result.sourceMatches = true
      steps.push('Registered the public repository catalog.')
    } else steps.push('Kept the existing public repository catalog.')
    await run(assistant, ['plugin', installCommand, PLUGIN, ...(assistant === 'claude' ? ['--scope', 'user'] : [])], 120_000)
    steps.push('Host plugin installation command completed.')
    result.outcome = 'installed'
    // Do not infer activation or enabled state from a successful install command.
    const after = await getPluginStatus(assistant, run)
    result.installed = after.installed
    result.installations = after.installations
    result.warnings = [...new Set([...result.warnings, ...after.warnings, ...after.errors])]
    if (after.installations.some(entry => entry.enabled === false)) result.warnings.push('The plugin is disabled in host settings. Enable it in the plugin browser when ready.')
    if (after.installed === false) {
      result.outcome = 'failed'
      result.errors.push('The host completed installation but its plugin list does not show the plugin. Inspect the plugin browser before retrying.')
    }
  } catch (error) { result.errors.push((error as Error).message) }
  return result
}

function printStatus(status: PluginStatus) {
  console.log(`${status.assistant}: catalog ${status.marketplace}; plugin ${status.installed === null ? 'status unavailable' : status.installed ? 'installed' : 'not installed'}`)
  for (const entry of status.installations) console.log(`  ${entry.scope}: ${entry.version ?? 'version unknown'}, ${entry.enabled === null ? 'enabled state unknown' : entry.enabled ? 'enabled' : 'disabled'}${entry.errors.length ? `; errors: ${entry.errors.join('; ')}` : ''}`)
  for (const message of [...status.warnings, ...status.errors]) console.log(`  ${message}`)
}

export function registerPluginCommand(program: Command, run: Run = runPluginHost) {
  const command = program.command('plugin').description('Install or inspect the Unstoppable Stack assistant plugin (preview)')
  command.command('install')
    .description('Install the preview plugin through the assistant’s native installer')
    .addArgument(new Argument('<assistant>', 'Assistant to configure').choices(['claude', 'codex']))
    .option('--json', 'Print a structured result')
    .action(async (assistant: Assistant, options) => {
      const result = await installPlugin(assistant, run)
      if (options.json) console.log(JSON.stringify(result, null, 2))
      else {
        printStatus(result)
        for (const step of result.steps) console.log(`  ${step}`)
        console.log(`  Result: ${result.outcome}.`)
        if (result.outcome === 'installed' || result.outcome === 'already-installed') console.log(`  ${result.nextStep}`)
      }
      if (result.outcome === 'failed' || result.outcome === 'manual-required') process.exitCode = 1
    })
  command.command('status')
    .description('Inspect catalog registration and plugin installation')
    .addArgument(new Argument('[assistant]', 'Omit to inspect both assistants').choices(['claude', 'codex']))
    .option('--json', 'Print structured results')
    .action(async (assistant: Assistant | undefined, options) => {
      const results = []
      for (const target of assistant ? [assistant] : ['claude', 'codex'] as const) results.push(await getPluginStatus(target, run))
      if (options.json) console.log(JSON.stringify(results, null, 2))
      else for (const result of results) printStatus(result)
      if (results.some(result => result.errors.length || result.installed === null)) process.exitCode = 1
    })
}
