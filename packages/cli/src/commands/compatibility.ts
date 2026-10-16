import { Command } from 'commander'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { manifest, dependenciesFor, profileFor } from '../compatibility/index.js'
import { runtimeSources, runtimeVersion } from '../generated/runtime-ai.js'
import { PLATFORMS, FEATURES, type Platform, type Feature } from '../generators/types.js'

export async function discoverApps(directory: string, depth = 0): Promise<string[]> {
  if (depth > 8) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const apps: string[] = []
  if (entries.some(e => e.isDirectory() && e.name === '.unstoppable')) {
    try { await readFile(join(directory, '.unstoppable/project.json')); apps.push(resolve(directory)) } catch {}
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'reference-apps', 'research'].includes(entry.name)) continue
    apps.push(...await discoverApps(join(directory, entry.name), depth + 1))
  }
  return apps.sort()
}

export async function checkCompatibility(directory: string) {
  const app = resolve(directory)
  const metadata = JSON.parse(await readFile(join(app, '.unstoppable/project.json'), 'utf8'))
  if (metadata.schemaVersion !== manifest.schemaVersion || !PLATFORMS.some(p => p.id === metadata.platform) ||
      !Array.isArray(metadata.features) || metadata.features.some((f: string) => !FEATURES.some(known => known.id === f))) {
    throw new Error('Unknown project metadata schema, platform, or features; use the CLI version that generated this app.')
  }
  const platform = metadata.platform as Platform
  const profile = profileFor(platform)
  const pkg = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
  const expected = { dependencies: dependenciesFor({ platform, features: metadata.features as Feature[], projectName: pkg.name }), devDependencies: profile.devDependencies }
  const changes: { path: string; from: unknown; to: unknown; reason: string }[] = []
  const needsRuntime = metadata.features.includes('local-ai') && !!profile.aiRuntime
  if (needsRuntime && !metadata.aiRuntime) {
    changes.push({ path: '.unstoppable/project.json:aiRuntime', from: null, to: { version: runtimeVersion, delivery: 'vendored' }, reason: 'Selected local AI feature is missing its runtime contract' })
  }
  for (const [name, range] of Object.entries(profile.engines)) {
    if (pkg.engines?.[name] !== range) changes.push({ path: `package.json:engines.${name}`, from: pkg.engines?.[name] ?? null, to: range, reason: 'Host engine requirement differs from the profile' })
  }
  if (metadata.compatibility?.id !== profile.id || metadata.compatibility?.revision !== profile.revision) {
    changes.push({ path: '.unstoppable/project.json', from: metadata.compatibility, to: { id: profile.id, revision: profile.revision }, reason: 'Compatibility profile changed' })
  }
  for (const [group, ranges] of Object.entries(expected)) {
    for (const [name, range] of Object.entries(ranges)) {
      if (pkg[group]?.[name] !== range) changes.push({ path: `package.json:${group}.${name}`, from: pkg[group]?.[name] ?? null, to: range, reason: 'Declaration differs from the current profile; review intentional app changes' })
    }
  }
  if (metadata.aiRuntime) {
    if (metadata.aiRuntime.version !== runtimeVersion) {
      changes.push({ path: '.unstoppable/runtime-ai', from: metadata.aiRuntime.version, to: runtimeVersion, reason: 'Runtime migration required; preserve app edits' })
    } else {
      for (const [name, content] of Object.entries(runtimeSources)) {
        const path = `.unstoppable/runtime-ai/${name}`
        let installed = null
        try { installed = await readFile(join(app, path), 'utf8') } catch {}
        if (installed !== content) changes.push({ path, from: 'modified or missing', to: runtimeVersion, reason: 'Vendored runtime differs; review edits before migration' })
      }
    }
  }
  let locked: Record<string, string> = {}
  try {
    const lock = JSON.parse(await readFile(join(app, 'package-lock.json'), 'utf8'))
    locked = Object.fromEntries(Object.keys(expected.dependencies).flatMap(name => {
      const version = lock.packages?.[`node_modules/${name}`]?.version
      return version ? [[name, version]] : []
    }))
  } catch {}
  for (const [name, range] of Object.entries(expected.dependencies)) {
    if (/^\d+\.\d+\.\d+$/.test(range) && locked[name] && locked[name] !== range) {
      changes.push({ path: `package-lock.json:${name}`, from: locked[name], to: range, reason: 'Locked version differs from an exact profile pin' })
    }
  }
  return {
    app, platform, features: metadata.features, profile: profile.id, maturity: profile.maturity,
    featureMaturity: metadata.features.map((feature: Feature) => ({ feature, maturity: profile.featureMaturity[feature] })),
    runtimeRequirements: profile.runtimeRequirements,
    matchesProfile: changes.length === 0, changes, locked,
    validation: profile.validation,
    nextSteps: changes.length
      ? ['Review the proposed dependency and runtime differences against installed types and version-matched release notes.', 'Apply explicit migrations in a branch; preserve UI, prompts, schemas and edited files.', 'Run install, runtime, cancellation/reuse and offline gates. Update metadata only after acceptance.']
      : ['Recorded files match the current generator profile. Run native and offline acceptance before making support claims.'],
    mutated: false,
  }
}

export function registerCompatibilityCommand(program: Command) {
  const command = program.command('compatibility').description('Inspect app profiles and plan upgrades without modifying files')
  command.command('list').option('-o, --output <dir>', 'Workspace to inspect', '.').action(async options => {
    console.log(JSON.stringify({ apps: await discoverApps(options.output) }, null, 2))
  })
  command.command('check').option('-o, --output <dir>', 'App to inspect', '.').action(async options => {
    try { console.log(JSON.stringify(await checkCompatibility(options.output), null, 2)) }
    catch (err) { console.error(JSON.stringify({ error: (err as Error).message, mutated: false })); process.exitCode = 1 }
  })
}
