import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { checkCompatibility, discoverApps } from '../commands/compatibility.js'
import { getGenerator, type Platform, type Feature } from '../generators/index.js'
import { manifest } from '../compatibility/index.js'

const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })
async function app(platform: Platform, features: Feature[], target?: string) {
  const directory = target || await mkdtemp(join(tmpdir(), 'us-profile-test-'))
  if (!target) directories.push(directory)
  for (const file of getGenerator(platform)({ platform, features, projectName: 'contract-app' })) {
    await mkdir(dirname(join(directory, file.path)), { recursive: true })
    await writeFile(join(directory, file.path), file.content)
  }
  return directory
}

describe('recorded compatibility contract', () => {
  for (const platform of ['pear-desktop', 'node-cli', 'expo-mobile'] as Platform[]) {
    it(`${platform}: emits matching declarations/profile and reports native maturity separately`, async () => {
      const directory = await app(platform, ['local-ai'])
      const result = await checkCompatibility(directory)
      expect(result.matchesProfile).toBe(true)
      expect(result.mutated).toBe(false)
      const metadata = JSON.parse(await readFile(join(directory, '.unstoppable/project.json'), 'utf8'))
      expect(metadata.model.sha256Checksum).toBe(manifest.model.sha256Checksum)
      expect(metadata.aiRuntime?.version || null).toBe(platform === 'expo-mobile' ? null : '0.1.0')
      expect(result.validation.adapter).toContain('pending')
    })
  }
  it('reports edited runtime, mismatched declarations and exact locked pins without overwriting anything', async () => {
    const directory = await app('pear-desktop', ['local-ai'])
    const pkgPath = join(directory, 'package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')); pkg.dependencies['@qvac/inference'] = '0.15.0'
    const edited = JSON.stringify(pkg); await writeFile(pkgPath, edited)
    const runtime = join(directory, '.unstoppable/runtime-ai/index.js'); await writeFile(runtime, '// app edit\n')
    await writeFile(join(directory, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@qvac/inference': { version: '0.15.0' } } }))
    const result = await checkCompatibility(directory)
    expect(result.matchesProfile).toBe(false)
    expect(result.changes.map(change => change.path)).toEqual(expect.arrayContaining(['package.json:dependencies.@qvac/inference', '.unstoppable/runtime-ai/index.js', 'package-lock.json:@qvac/inference']))
    expect(await readFile(pkgPath, 'utf8')).toBe(edited)
    expect(await readFile(runtime, 'utf8')).toBe('// app edit\n')
  })
  it('discovers several app profiles and excludes dependency/build trees', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'us-workspace-test-')); directories.push(workspace)
    await app('pear-desktop', [], join(workspace, 'apps/desktop'))
    await app('node-cli', ['local-ai'], join(workspace, 'apps/cli'))
    await app('node-cli', [], join(workspace, 'node_modules/example'))
    expect(await discoverApps(workspace)).toEqual([join(workspace, 'apps/cli'), join(workspace, 'apps/desktop')])
  })
  it('rejects unknown metadata before proposing a migration', async () => {
    const directory = await app('pear-desktop', [])
    await writeFile(join(directory, '.unstoppable/project.json'), JSON.stringify({ schemaVersion: 99 }))
    await expect(checkCompatibility(directory)).rejects.toThrow('Unknown project metadata')
  })
})
