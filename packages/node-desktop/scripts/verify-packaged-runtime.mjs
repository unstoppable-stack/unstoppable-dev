import assert from 'node:assert/strict'
import { stat, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses'
import { files, findPackagedExecutable, normalizedPath } from './packaged-paths.mjs'

const packageRoot = resolve(import.meta.dirname, '..')
const out = join(packageRoot, 'out')
const MAX_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024

const packagedFiles = await files(out)
const appPackage = packagedFiles.find((file) => /\/Resources\/app\/package\.json$|\/resources\/app\/package\.json$/.test(normalizedPath(file)))
assert.ok(appPackage, `Could not find packaged app under ${out}`)

const appRoot = resolve(appPackage, '..')
const appFiles = await files(appRoot)
const qvacPackage = JSON.parse(await readFile(join(appRoot, 'node_modules', '@qvac', 'inference', 'package.json'), 'utf8'))
assert.equal(qvacPackage.version, '0.21.0', 'Packaged QVAC inference engine version is not pinned to 0.21.0')

const forbiddenRuntimePackages = [
  /\/node_modules\/@electron-forge\/[^/]+\/package\.json$/,
  /\/node_modules\/@electron\/rebuild\/package\.json$/,
  /\/node_modules\/@electron\/packager\/package\.json$/,
  /\/node_modules\/(?:brace-expansion|minimatch|glob|tmp|tar|cacache|rimraf)\/package\.json$/
]
for (const file of appFiles) {
  assert.equal(
    forbiddenRuntimePackages.some((pattern) => pattern.test(normalizedPath(file))),
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

const executable = findPackagedExecutable(packagedFiles, process.platform)
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
