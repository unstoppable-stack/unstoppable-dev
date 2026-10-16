import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const directory = resolve(process.argv[2] || '.')
const files = readdirSync(directory).filter(name => name.endsWith('.tgz')).sort()
if (!files.length) throw new Error('No release tarballs found')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const dirty = git('status', '--porcelain').length > 0
const record = {
  recordedAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  workingTree: dirty ? 'dirty' : 'clean',
  frozen: false,
  note: 'Artifact identity only. A clean tree does not by itself approve publication.',
  artifacts: files.map(file => {
    const path = join(directory, file)
    const bytes = readFileSync(path)
    const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).split(/\r?\n/)
    for (const required of ['package/package.json', 'package/README.md', 'package/LICENSE']) {
      if (!entries.includes(required)) throw new Error(`${file} is missing ${required}`)
    }
    const manifest = JSON.parse(execFileSync('tar', ['-xOzf', path, 'package/package.json'], { encoding: 'utf8' }))
    for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
      if (/^(file:|link:|workspace:|\.\.?\/|\/)/.test(version)) {
        throw new Error(`${file} has unresolved local production dependency ${name}: ${version}`)
      }
    }
    return { file, name: manifest.name, version: manifest.version, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  }),
}
writeFileSync(join(directory, 'artifact-manifest.json'), JSON.stringify(record, null, 2) + '\n')
console.log(`Recorded ${files.length} artifact checksum(s); source tree ${record.workingTree}`)
