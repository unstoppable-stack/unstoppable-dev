import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = resolve(process.argv[2] || join(root, 'release-artifacts'))
const staging = mkdtempSync(join(tmpdir(), 'unstoppable-node-pack-'))
const p2p = JSON.parse(readFileSync(join(root, 'packages/p2p/package.json'), 'utf8'))

// Development uses local links. Only the staged Personal Node manifest is
// rewritten, so the public artifact resolves the matching published library.
// Never edit the checkout or its locks as a side effect of packing a release.
try {
  mkdirSync(destination, { recursive: true })
  for (const directory of ['p2p', 'node']) {
    const source = join(root, 'packages', directory)
    const target = join(staging, directory)
    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
    mkdirSync(target)
    if (directory === 'node') {
      if (manifest.dependencies['@unstoppable-stack/p2p'] !== 'file:../p2p') {
        throw new Error('Unexpected Personal Node P2P dependency; review the release assembly')
      }
      manifest.dependencies['@unstoppable-stack/p2p'] = `^${p2p.version}`
    }
    for (const [name, version] of Object.entries({
      ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies,
    })) {
      if (/^(file:|link:|workspace:|\.\.?\/|\/)/.test(version)) {
        throw new Error(`${manifest.name} has local production dependency ${name}: ${version}`)
      }
    }
    if (manifest.private) throw new Error(`Refusing to pack private package ${manifest.name}`)
    // Use only explicitly shipped content, including internal AI and native
    // helpers. No dependencies, tests, or development state enter the tarball.
    for (const entry of manifest.files) {
      cpSync(join(source, entry), join(target, entry), { recursive: true })
    }
    writeFileSync(join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
    execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', destination], {
      cwd: target,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }
} finally {
  rmSync(staging, { recursive: true, force: true })
}
