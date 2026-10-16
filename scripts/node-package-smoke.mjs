// Compatibility entry for optional Personal Node CI; the canonical release
// gate excludes this application and uses prepare-public-release.mjs.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = mkdtempSync(join(tmpdir(), 'unstoppable-node-package-'))
try {
  for (const script of ['pack-node-release.mjs', 'release-artifacts.mjs', 'test-node-artifacts.mjs']) {
    execFileSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), directory], { stdio: 'inherit' })
  }
} finally { rmSync(directory, { recursive: true, force: true }) }
