import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

// Guards the CLI version wiring. The version must be injected at build time
// from package.json (via the __US_VERSION__ esbuild define) so `us --version`
// can never drift from the published version — which it did once, when
// package.json said 0.3.0 while us.ts hardcoded "0.2.0".

const __dirname = dirname(fileURLToPath(import.meta.url))
const usSource = readFileSync(join(__dirname, '..', 'us.ts'), 'utf8')

describe('us --version wiring', () => {
  it('renders the version from the __US_VERSION__ build constant', () => {
    expect(usSource).toContain('.version(`${__US_VERSION__} (${__US_BUILD_PROFILE__})`)')
  })

  it('does not hardcode a semver literal in the .version() call', () => {
    const versionCall = usSource.match(/\.version\(([^\n]*)\)/)?.[1] ?? ''
    expect(versionCall).not.toMatch(/\d+\.\d+\.\d+/)
  })
})
