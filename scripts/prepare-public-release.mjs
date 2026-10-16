import { execFileSync } from 'node:child_process'
import { closeSync, copyFileSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyPublicRelease } from './public-release.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directory = resolve(process.argv[2] || join(root, 'release-artifacts', new Date().toISOString().replaceAll(':', '-')))
mkdirSync(join(directory, 'logs'), { recursive: true })
const checks = []
function run(name, command, args) {
  console.log(`Checking ${name}…`)
  const log = join(directory, 'logs', `${name}.log`)
  const descriptor = openSync(log, 'w')
  try {
    execFileSync(command, args, { cwd: root, stdio: ['ignore', descriptor, descriptor], shell: process.platform === 'win32' && command === 'npm' })
    checks.push({ name, status: 'passed', log: `logs/${name}.log` })
  } catch (error) {
    console.error(readFileSync(log, 'utf8').split('\n').slice(-40).join('\n'))
    throw error
  } finally { closeSync(descriptor) }
}
const node = (name, args) => run(name, process.execPath, args)

node('assets', ['scripts/sync-stack-assets.mjs', '--check'])
node('guidance', ['scripts/check-agent-pack.mjs'])
run('cli-types', 'npm', ['run', 'typecheck', '--prefix', 'packages/cli'])
run('cli-tests', 'npm', ['test', '--prefix', 'packages/cli'])
run('p2p-tests', 'npm', ['test', '--prefix', 'packages/p2p'])
run('p2p-audit', 'npm', ['audit', '--prefix', 'packages/p2p', '--omit=dev', '--audit-level=high'])
run('cli-audit', 'npm', ['audit', '--prefix', 'packages/cli', '--omit=dev', '--audit-level=high'])
run('notes-example', 'npm', ['test', '--prefix', 'examples/p2p-notes'])
node('runtime-tests', ['--test', 'packages/runtime-ai/test/session.test.js'])
node('plugin-tests', ['--test', 'packages/agent-pack/scripts/build-plugin.test.mjs'])
node('release-tests', ['--test', 'scripts/public-release.test.mjs'])
node('pack', ['scripts/public-release.mjs', 'pack', directory])
node('installed-consumer', ['scripts/test-public-artifacts.mjs', directory])
const record = verifyPublicRelease(directory, { requireTest: true })
for (const artifact of record.artifacts) {
  run(`dry-run-${artifact.tag}`, 'npm', ['publish', join(directory, artifact.file), '--dry-run', '--ignore-scripts', '--access', 'public', '--tag', artifact.tag])
}
node('registry', ['scripts/public-release.mjs', 'preflight', directory])
node('plugin-download', ['packages/website/scripts/prepare-plugin-download.mjs'])
const plugin = JSON.parse(readFileSync(join(root, 'packages/website/public/downloads/plugin-release.json')))
mkdirSync(join(directory, 'plugins'), { recursive: true })
for (const name of [plugin.filename, 'plugin-release.json']) copyFileSync(join(root, 'packages/website/public/downloads', name), join(directory, 'plugins', name))
writeFileSync(join(directory, 'preparation.json'), JSON.stringify({
  checkedAt: new Date().toISOString(), status: 'passed', commit: record.commit, workingTree: record.workingTree,
  artifacts: record.artifacts, plugin, checks,
  note: 'Preparation only. A clean reviewed commit, native acceptance and npm publishing authorization remain separate gates.',
}, null, 2) + '\n')
console.log(`Prepared and tested canonical candidates in ${directory}; source is ${record.workingTree}. Nothing published.`)
