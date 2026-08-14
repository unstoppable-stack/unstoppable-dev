import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'

const makeDir = resolve(import.meta.dirname, '..', 'out', 'make')
const extensions = new Set(['.dmg', '.zip', '.exe', '.nupkg', '.deb', '.AppImage'])

async function files (directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else result.push(path)
  }
  return result
}

const artifacts = (await files(makeDir)).filter((file) => {
  if (basename(file) === 'RELEASES') return true
  return [...extensions].some((extension) => file.endsWith(extension))
})
if (artifacts.length === 0) throw new Error(`No release artifacts found under ${makeDir}`)

const lines = []
for (const artifact of artifacts.sort()) {
  const digest = createHash('sha256').update(await readFile(artifact)).digest('hex')
  lines.push(`${digest}  ${relative(makeDir, artifact)}`)
}
await writeFile(join(makeDir, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`)
console.log(lines.join('\n'))
