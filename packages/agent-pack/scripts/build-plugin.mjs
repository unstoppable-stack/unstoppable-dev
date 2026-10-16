import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, lstatSync } from 'node:fs'
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
export const publicSkills = [
  'build-with-unstoppable', 'scaffold-project', 'setup-pear-desktop', 'setup-node-cli',
  'add-p2p-networking', 'add-p2p-sync', 'add-p2p-rpc', 'add-multi-writer-sync',
  'add-encrypted-channels', 'add-kv-storage', 'add-database', 'add-file-storage',
  'add-ai-chat', 'setup-local-testing', 'diagnose-stack-runtime', 'upgrade-stack',
]
const groups = {
  core: ['unstoppable-foundations', 'Architecture and ownership invariants for Unstoppable apps'],
  modules: ['unstoppable-modules', 'Runtime boundaries and integration notes for Unstoppable stack modules'],
  recipes: ['unstoppable-recipes', 'Composition patterns for extending Unstoppable apps'],
}
const json = value => JSON.stringify(value, null, 2) + '\n'
const hash = value => createHash('sha256').update(value).digest('hex')
const stripFrontmatter = text => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim() + '\n'
const description = text => text.match(/^description:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '')

function inside(root, path) {
  const rel = relative(root, path)
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}

export function inventory(root, prefix = '') {
  return readdirSync(join(root, prefix)).sort().flatMap(name => {
    const path = join(prefix, name)
    const stat = lstatSync(join(root, path))
    if (stat.isSymbolicLink()) throw new Error(`Symlink is not a distributable resource: ${path}`)
    if (stat.isDirectory()) return inventory(root, path)
    if (!stat.isFile()) throw new Error(`Unsupported resource: ${path}`)
    return [path.split(sep).join('/')]
  })
}

// Validate generated Markdown references in the artifact, not in the authoring checkout.
export function validateFiles(files) {
  for (const [path, bytes] of files) {
    if (!/\.mdc?$/.test(path)) continue
    const text = bytes.toString('utf8')
    if (path.endsWith('/SKILL.md')) {
      const name = text.match(/^name:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/m)?.[1]
      if (name !== path.split('/').at(-2) || !description(text)) throw new Error(`Invalid skill metadata: ${path}`)
    }
    // Ignore code blocks: example code may contain link-like expressions.
    const prose = text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '')
    for (const match of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1]
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue
      const local = decodeURIComponent(target.split('#')[0])
      const destination = resolve('/artifact', dirname(path), local)
      if (!inside('/artifact', destination) || !files.has(relative('/artifact', destination).split(sep).join('/'))) {
        throw new Error(`Broken bundled link: ${path} -> ${target}`)
      }
    }
  }
}

export function assemblePlugin({ sourceRoot = join(packageRoot, 'src'), version } = {}) {
  const metadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  version ||= metadata.version
  const files = new Map()
  const inputs = new Map()
  function read(path) {
    const full = resolve(sourceRoot, path)
    if (!inside(sourceRoot, full)) throw new Error(`Source escapes pack: ${path}`)
    const bytes = readFileSync(full)
    inputs.set(path, hash(bytes))
    return bytes
  }
  for (const skill of publicSkills) {
    for (const path of inventory(join(sourceRoot, 'skills', skill))) {
      files.set(`skills/${skill}/${path}`, read(`skills/${skill}/${path}`))
    }
    if (skill !== 'build-with-unstoppable') {
      const path = `skills/${skill}/SKILL.md`
      files.set(path, Buffer.from(files.get(path).toString('utf8').trimEnd() +
        '\n\n## Bundled integration references\n\nFor app ownership and runtime boundaries, load only the relevant ' +
        '[foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), ' +
        'or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.\n'))
    }
  }
  for (const [group, [name, purpose]] of Object.entries(groups)) {
    const refs = inventory(join(sourceRoot, group)).filter(path => /\.mdc?$/.test(path))
    let index = `# ${purpose}\n\nRead only the reference relevant to the selected app and task.\n\n`
    for (const ref of refs) {
      const text = read(`${group}/${ref}`).toString('utf8')
      files.set(`skills/${name}/resources/${ref}`, Buffer.from(stripFrontmatter(text)))
      index += `- [${ref.replace(/\.mdc?$/, '')}](${ref}): ${description(text) || ref}\n`
    }
    files.set(`skills/${name}/resources/INDEX.md`, Buffer.from(index))
    files.set(`skills/${name}/SKILL.md`, Buffer.from(`---\nname: ${name}\ndescription: ${purpose}; read the matching bundled reference when designing or extending an app.\n---\n\n# ${purpose}\n\nDiscover the target app and inspect its .unstoppable/project.json, package.json and entrypoints first. For a new app, inspect the installed CLI catalog. Read [the reference index](resources/INDEX.md), then only the matching note. Resources resolve relative to this skill, not the app or workspace. Installed contracts and version-matched SDK types take precedence over generic examples.\n`))
  }
  const manifest = {
    name: 'unstoppable-stack', version,
    description: 'Build and extend local-first P2P apps with maintained Unstoppable Stack workflows.',
    author: { name: 'Unstoppable Stack' }, homepage: 'https://unstoppable.dev', license: 'MIT',
  }
  files.set('README.md', Buffer.from(`# Unstoppable Stack plugin\n\nVersion ${version}. Skills-only local development package; not a published release.\n\nStart with build-with-unstoppable. Bundled references are self-contained and do not require a CLI-generated project pack. App creation requires the separate @unstoppable-stack/cli prerequisite. Use the installed CLI catalog and app profile; installing or updating this plugin does not install native dependencies or migrate apps.\n\nIn Claude Code, load this folder with --plugin-dir and invoke /unstoppable-stack:build-with-unstoppable. In Codex, add this package through the generated local marketplace and invoke the discovered build-with-unstoppable skill. See the source package PLUGIN.md for the full local setup and validation status.\n`))
  validateFiles(files)
  const inventoryData = {
    version, sourceDigest: hash(json(Object.fromEntries([...inputs].sort(([a], [b]) => a.localeCompare(b))))),
    sources: Object.fromEntries([...inputs].sort(([a], [b]) => a.localeCompare(b))),
  }
  function addInventory(target) {
    target.set('content-inventory.json', Buffer.from(json({ ...inventoryData,
      files: Object.fromEntries([...target].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => [path, hash(bytes)])),
    })))
  }
  const portable = new Map(files)
  portable.set('plugin.json', Buffer.from(json({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', ...manifest })))
  addInventory(portable)
  const claude = new Map(files)
  claude.set('.claude-plugin/plugin.json', Buffer.from(json(manifest)))
  addInventory(claude)
  return { portable, claude }
}

export function assembleDistribution(options) {
  const { portable, claude } = assemblePlugin(options)
  const output = new Map()
  for (const [target, files] of Object.entries({ portable, claude })) {
    for (const [path, bytes] of files) output.set(`${target}/${path}`, bytes)
  }
  output.set('.agents/plugins/marketplace.json', Buffer.from(json({
    name: 'unstoppable-stack-dev', interface: { displayName: 'Unstoppable Stack development' },
    plugins: [{ name: 'unstoppable-stack', source: { source: 'local', path: './portable' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' }, category: 'Developer tools' }],
  })))
  output.set('.claude-plugin/marketplace.json', Buffer.from(json({
    name: 'unstoppable-stack-dev', owner: { name: 'Unstoppable Stack' },
    metadata: { description: 'Local development packages for Unstoppable Stack workflows' },
    plugins: [{ name: 'unstoppable-stack', source: './claude' }],
  })))
  return output
}

export function writeDistribution(outputRoot, files, { check = false } = {}) {
  if (check) {
    const actual = inventory(outputRoot)
    if (JSON.stringify(actual) !== JSON.stringify([...files.keys()].sort())) throw new Error('Plugin inventory drift; rebuild plugins')
    for (const [path, bytes] of files) {
      if (!readFileSync(join(outputRoot, path)).equals(bytes)) throw new Error(`Plugin content drift: ${path}`)
    }
    return
  }
  // Only replace owned output subtrees. Never recursively remove the caller's output root.
  for (const name of ['portable', 'claude']) rmSync(join(outputRoot, name), { recursive: true, force: true })
  for (const [path, bytes] of files) {
    mkdirSync(dirname(join(outputRoot, path)), { recursive: true })
    writeFileSync(join(outputRoot, path), bytes)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-plugin.mjs [--check]')
  const output = assembleDistribution()
  writeDistribution(join(packageRoot, 'dist'), output, { check: args.includes('--check') })
  console.log(`${args.includes('--check') ? 'Verified' : 'Built'} Codex/Claude local plugin packages (${output.size} files)`)
}
