import { test } from 'node:test'
import { release } from './release-config.mjs'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, cpSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { assemblePlugin, assembleDistribution, writeDistribution, inventory, validateFiles, writePublicDistribution } from './build-plugin.mjs'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'us-plugin-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

test('copied packages resolve every local Markdown reference without the source repository', t => {
  const root = temporary(t)
  const output = assembleDistribution()
  writeDistribution(root, output)
  for (const host of ['portable', 'claude']) {
    const files = new Map(inventory(join(root, host)).map(path => [path, readFileSync(join(root, host, path))]))
    validateFiles(files)
    assert(files.has('skills/unstoppable-modules/resources/qvac.mdc'))
    assert(files.has('skills/add-ai-chat/resources/tool-calling-example.md'))
    const desktop = files.get('skills/setup-pear-desktop/SKILL.md').toString()
    assert(desktop.includes('.unstoppable/runtime-ai/index.js'))
    assert(!desktop.includes('chat-context.js'))
    assert(!files.has('hooks/hooks.json'))
    assert(!files.has('agents/unstoppable-dev.md'))
    for (const [path, bytes] of files) {
      if (path.endsWith('/SKILL.md') && !path.includes('/build-with-unstoppable/')) {
        assert(!bytes.toString().includes('.unstoppable/guidance'), path)
      }
    }
  }
})

test('builds are deterministic, source content is unchanged, host content stays identical', () => {
  const source = join(packageRoot, 'src')
  const before = inventory(source).map(path => [path, readFileSync(join(source, path))])
  const a = assemblePlugin()
  const b = assemblePlugin()
  assert.deepEqual([...a.portable], [...b.portable])
  for (const [path, bytes] of a.portable) {
    if (path === 'plugin.json' || path === 'content-inventory.json') continue
    assert.deepEqual(bytes, a.claude.get(path), path)
  }
  for (const [path, bytes] of before) assert.deepEqual(readFileSync(join(source, path)), bytes, path)
})

test('check mode detects corrupt content and extra artifacts; rebuild removes stale plugin files', t => {
  const root = temporary(t)
  const output = assembleDistribution()
  writeDistribution(root, output)
  writeDistribution(root, output, { check: true })
  const path = join(root, 'portable', 'skills/build-with-unstoppable/SKILL.md')
  writeFileSync(path, 'corrupt')
  assert.throws(() => writeDistribution(root, output, { check: true }), /content drift/)
  writeDistribution(root, output)
  writeFileSync(join(root, 'portable/stale.txt'), 'old')
  assert.throws(() => writeDistribution(root, output, { check: true }), /inventory drift/)
  writeDistribution(root, output)
  writeDistribution(root, output, { check: true })
})

test('recursive binary resources are preserved and symlinks are rejected', t => {
  const root = temporary(t)
  const source = join(root, 'source')
  cpSync(join(packageRoot, 'src'), source, { recursive: true })
  const assets = join(source, 'skills/build-with-unstoppable/assets/nested')
  mkdirSync(assets, { recursive: true })
  const binary = Buffer.from([0, 255, 17, 0])
  writeFileSync(join(assets, 'fixture.bin'), binary)
  const output = assemblePlugin({ sourceRoot: source })
  assert.deepEqual(output.portable.get('skills/build-with-unstoppable/assets/nested/fixture.bin'), binary)
  symlinkSync(join(assets, 'fixture.bin'), join(assets, 'link.bin'))
  assert.throws(() => assemblePlugin({ sourceRoot: source }), /Symlink/)
})

test('missing links and escaping links fail before writing any package', () => {
  const path = 'skills/example/SKILL.md'
  const skill = target => Buffer.from(`---\nname: example\ndescription: Example\n---\n\n[Resource](${target})\n`)
  assert.throws(() => validateFiles(new Map([[path, skill('resources/missing.md')]])), /Broken bundled link/)
  assert.throws(() => validateFiles(new Map([[path, skill('../../../outside.md')]])), /Broken bundled link/)
})

test('catalogs point to real generated host artifacts with matching identities', () => {
  const output = assembleDistribution()
  const codex = JSON.parse(output.get('.agents/plugins/marketplace.json'))
  const claude = JSON.parse(output.get('.claude-plugin/marketplace.json'))
  const portableManifest = JSON.parse(output.get('portable/plugin.json'))
  const claudeManifest = JSON.parse(output.get('claude/.claude-plugin/plugin.json'))
  assert.equal(codex.plugins[0].source.path, './portable')
  assert.equal(claude.plugins[0].source, './claude')
  assert.equal(codex.plugins[0].name, portableManifest.name)
  assert.equal(claude.plugins[0].name, claudeManifest.name)
  assert.equal(portableManifest.version, claudeManifest.version)
  const hashes = JSON.parse(output.get('portable/content-inventory.json')).files
  assert(hashes['plugin.json'])
  assert(hashes['skills/build-with-unstoppable/SKILL.md'])
})

test('public catalogs resolve tracked packages and CLI instructions match the candidate', () => {
  writePublicDistribution({ check: true })
  const repo = fileURLToPath(new URL('../../../', import.meta.url))
  for (const path of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json']) {
    const catalog = JSON.parse(readFileSync(join(repo, path)))
    assert.equal(catalog.name, 'unstoppable-stack')
    const source = catalog.plugins[0].source
    const directory = join(repo, typeof source === 'string' ? source : source.path)
    const manifest = path.startsWith('.agents') ? 'plugin.json' : '.claude-plugin/plugin.json'
    assert.equal(JSON.parse(readFileSync(join(directory, manifest))).name, catalog.plugins[0].name)
  }
  const { portable } = assemblePlugin()
  const guide = portable.get('skills/build-with-unstoppable/resources/install-cli.md').toString()
  assert(guide.includes(`Match this plugin with CLI ${release.cliInstallVersion}`))
  if (release.cliRegistryPublished) {
    assert(guide.includes('candidate is published'))
    assert(guide.includes(`npm install --global @unstoppable-stack/cli@${release.cliInstallVersion}`))
  } else {
    assert(guide.includes('not published'))
  }
  assert(guide.includes(`git checkout ${release.cliSourceRef}`))
  assert(portable.has('LICENSE'))
  const metadata = JSON.parse(portable.get('plugin.json'))
  for (const key of ['logo', 'composerIcon']) {
    assert(portable.has(metadata.extensions['com.openai'].interface[key].replace(/^\.\//, '')))
  }
})
