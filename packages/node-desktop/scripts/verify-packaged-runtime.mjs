import assert from 'node:assert/strict'
import { stat, readFile, readdir } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses'

const packageRoot = resolve(import.meta.dirname, '..')
const out = join(packageRoot, 'out')
const MAX_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024

async function files (directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(target))
    else result.push(target)
  }
  return result
}

const packagedFiles = await files(out)
const normalized = (file) => file.split(sep).join('/')
const appPackage = packagedFiles.find((file) => /\/Resources\/app\/package\.json$|\/resources\/app\/package\.json$/.test(normalized(file)))
assert.ok(appPackage, `Could not find packaged app under ${out}`)

const appRoot = resolve(appPackage, '..')
const appFiles = await files(appRoot)
const qvacPackage = JSON.parse(await readFile(join(appRoot, 'node_modules', '@qvac', 'sdk', 'package.json'), 'utf8'))
assert.equal(qvacPackage.version, '0.15.0', 'Packaged QVAC SDK version is not pinned to 0.15.0')

const forbiddenRuntimePackages = [
  /\/node_modules\/@electron-forge\/[^/]+\/package\.json$/,
  /\/node_modules\/@electron\/rebuild\/package\.json$/,
  /\/node_modules\/@electron\/packager\/package\.json$/,
  /\/node_modules\/(?:brace-expansion|minimatch|glob|tmp|tar|cacache|rimraf)\/package\.json$/
]
for (const file of appFiles) {
  assert.equal(
    forbiddenRuntimePackages.some((pattern) => pattern.test(normalized(file))),
    false,
    `Build-only dependency leaked into packaged runtime: ${file}`
  )
}

let totalBytes = 0
for (const file of appFiles) totalBytes += (await stat(file)).size
assert.ok(
  totalBytes <= MAX_UNPACKED_BYTES,
  `Packaged application is ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GiB; expected at most 2 GiB`
)

const executable = packagedFiles.find((file) => {
  const path = normalized(file)
  if (process.platform === 'darwin') return path.endsWith('.app/Contents/MacOS/unstoppable-personal-node')
  // forge sets executableName, so the binary is unstoppable-personal-node.exe;
  // the productName spelling is accepted too in case that config changes.
  if (process.platform === 'win32') {
    return path.endsWith('/unstoppable-personal-node.exe') ||
      path.endsWith('/Unstoppable Personal Node.exe')
  }
  return path.endsWith('/unstoppable-personal-node')
})
assert.ok(executable, 'Could not find packaged Electron executable')

const wire = await getCurrentFuseWire(executable)
const disabled = 48
const enabled = 49
assert.equal(wire[FuseV1Options.RunAsNode], disabled, 'RunAsNode fuse must be disabled')
assert.equal(wire[FuseV1Options.EnableCookieEncryption], enabled, 'Cookie encryption fuse must be enabled')
assert.equal(wire[FuseV1Options.EnableNodeOptionsEnvironmentVariable], disabled, 'NODE_OPTIONS fuse must be disabled')
assert.equal(wire[FuseV1Options.EnableNodeCliInspectArguments], disabled, 'CLI inspect fuse must be disabled')
assert.equal(wire[FuseV1Options.GrantFileProtocolExtraPrivileges], disabled, 'file:// extra privileges fuse must be disabled')

console.log(`Packaged runtime verified: QVAC ${qvacPackage.version}, fuses hardened, ${(totalBytes / 1024 / 1024).toFixed(0)} MiB`)
