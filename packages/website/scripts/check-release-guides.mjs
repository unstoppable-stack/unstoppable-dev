import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const release = JSON.parse(readFileSync(new URL('../agent-pack/release.json', root)))
const download = JSON.parse(readFileSync(new URL('src/lib/plugin-download.json', root)))
// Published setup stays pinned while the source package advances to a candidate.
assert.match(release.cliInstallVersion, /^\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?$/, 'Setup must target an explicit CLI install version')

function decode(text) {
  return text.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
for (const host of ['claude', 'codex']) {
  const path = new URL(`out/docs/start/${host}.html`, root)
  const html = readFileSync(path, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  const blocks = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)].map(match => decode(match[1]))
  assert(blocks.length, `Missing rendered setup commands: ${fileURLToPath(path)}`)
  const setup = blocks[0]
  if (release.cliRegistryPublished) {
    assert(setup.includes(`npm install -g @unstoppable-stack/cli@${release.cliInstallVersion}`), 'Published setup must use the exact registry version')
    assert(!setup.includes('git clone'), 'Published setup must not lead with a source build')
  } else {
    assert(setup.includes(`git checkout ${release.cliSourceRef}`), 'Unpublished setup must pin an immutable source commit')
    assert(setup.includes(`unstoppable-stack-cli-${release.cliInstallVersion}.tgz`), 'Source setup must install the matching tarball')
    assert(!blocks.some(block => /npm install (?:-g|--global) @unstoppable-stack\/cli@/.test(block)), 'Do not tell users to install an unpublished npm version')
  }
  assert(blocks[1]?.includes(`us plugin install ${host}`), 'CLI plugin install must be the primary plugin setup')
  assert(blocks[1]?.includes(`us plugin status ${host}`), 'Setup must include host status')
  assert(blocks.some(block => block.includes(`${host} plugin marketplace add unstoppable-stack/unstoppable-dev`)), 'Keep the public native-install fallback')
  assert(html.includes(`/downloads/${download.filename}`), 'Keep the versioned archive fallback')
  assert(decode(html).includes('unstoppable-stack:build-with-unstoppable'), 'Setup must explain fresh-session activation')
}
console.log('Rendered Claude/Codex guides match the CLI release state and plugin installation flow.')
