'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const { pruneForeignPrebuilds } = require('./scripts/prune-prebuilds.cjs')

function copyLocalNodePackage (buildPath) {
  const source = path.resolve(__dirname, '..', 'node')
  const target = path.join(buildPath, 'node_modules', 'unstoppable-node')
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })

  for (const entry of ['src', 'scripts', 'package.json', 'README.md', 'LICENSE']) {
    const from = path.join(source, entry)
    if (!fs.existsSync(from)) continue
    fs.cpSync(from, path.join(target, entry), { recursive: true })
  }
}

const packagerConfig = {
  asar: false,
  executableName: 'unstoppable-personal-node',
  appBundleId: 'dev.unstoppable.personal-node',
  appCategoryType: 'public.app-category.utilities',
  ignore: [
    /^\/test($|\/)/,
    /^\/test-fixtures($|\/)/,
    /^\/scripts($|\/)/,
    /^\/\.pear($|\/)/,
    /^\/pnpm-lock\.yaml$/
  ],
  ...(process.env.MAC_CODESIGN_IDENTITY
    ? { osxSign: { identity: process.env.MAC_CODESIGN_IDENTITY, continueOnError: false } }
    : {}),
  ...(process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID
    ? {
        osxNotarize: {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_ID_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID
        }
      }
    : {})
}

module.exports = {
  packagerConfig,
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      // The Bare sidecar must remain outside Electron's ASAR virtual
      // filesystem. Signed desktop artifacts still protect these unpacked
      // files; ASAR integrity fuses cannot be enabled until the sidecar can
      // boot from an unpacked-only application layout.
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false
    })
  ],
  hooks: {
    // npm represents the monorepo's file: dependency as a symlink. Replace it
    // after pruning so an installed app never points back to the source tree.
    packageAfterPrune: async (_forgeConfig, buildPath, _electronVersion, platform, arch) => {
      copyLocalNodePackage(buildPath)
      const result = pruneForeignPrebuilds(buildPath, platform, arch)
      console.info(`Pruned ${result.removed} foreign native prebuilds; kept ${result.kept} for ${platform}-${arch}`)
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: { format: 'ULFO' },
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'unstoppable_personal_node',
        ...(process.env.WINDOWS_CERTIFICATE_FILE && process.env.WINDOWS_CERTIFICATE_PASSWORD
          ? {
              certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
              certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD
            }
          : {})
      },
      platforms: ['win32']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Unstoppable Stack',
          homepage: 'https://unstoppable.dev'
        }
      },
      platforms: ['linux']
    }
  ]
}
