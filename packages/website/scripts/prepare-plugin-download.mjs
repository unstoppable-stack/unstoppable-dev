import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleDistribution, writeDistribution } from '../../agent-pack/scripts/build-plugin.mjs'

const website = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(website, 'src/lib/plugin-download.json'), 'utf8'))
const downloads = join(website, 'public/downloads')
const temporary = mkdtempSync(join(tmpdir(), 'unstoppable-plugin-download-'))

try {
  const files = assembleDistribution()
  const manifest = JSON.parse(files.get('portable/plugin.json').toString())
  if (manifest.version !== config.version) throw new Error('Update plugin-download.json to match the plugin version')
  const distribution = join(temporary, config.directory)
  writeDistribution(distribution, files)
  writeDistribution(distribution, files, { check: true })
  // Fixed timestamps keep repeated builds of the same content byte-identical.
  // Use a system archive tool so the static site needs no extra dependencies.
  const { utimesSync, readdirSync } = await import('node:fs')
  const stamp = new Date('2026-01-01T00:00:00Z')
  function normalize(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) normalize(path)
      utimesSync(path, stamp, stamp)
    }
    utimesSync(directory, stamp, stamp)
  }
  normalize(distribution)
  const archive = join(temporary, config.filename)
  execFileSync('tar', ['--format=ustar', '-czf', archive, '-C', temporary, config.directory], {
    env: { ...process.env, COPYFILE_DISABLE: '1', GZIP: '-n' },
  })
  const bytes = readFileSync(archive)
  const inventory = JSON.parse(files.get('portable/content-inventory.json').toString())
  mkdirSync(downloads, { recursive: true })
  const stagedArchive = join(downloads, `${config.filename}.tmp`)
  copyFileSync(archive, stagedArchive)
  renameSync(stagedArchive, join(downloads, config.filename))
  writeFileSync(join(downloads, 'plugin-release.json'), JSON.stringify({
    version: config.version,
    status: 'local-preview',
    filename: config.filename,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourceDigest: inventory.sourceDigest,
    hosts: ['claude', 'codex'],
    files: files.size,
    scope: 'Skills and references only. Host parsing checked; full session workflows remain unverified.',
  }, null, 2) + '\n')
  console.log(`Prepared plugin preview download (${files.size} files, ${bytes.length} bytes)`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
