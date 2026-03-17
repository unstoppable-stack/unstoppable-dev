import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, gitignore, readme, planningReadme } from './common.js'

export function generateExpoMobile(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    appJson(opts),
    metroConfig(opts),
    emptyMock(),
    appLayout(),
    appIndex(opts),
    pluginNdkVersion(),
    pluginArchitecture(),
  ]

  if (has(opts, 'p2p')) {
    files.push(bareWorklet(opts))
  }

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const deps: Record<string, string> = {
    expo: '~54.0.33',
    'expo-file-system': '^19.0.15',
    'expo-router': '~6.0.23',
    'expo-splash-screen': '~31.0.10',
    'expo-status-bar': '~3.0.8',
    react: '19.1.0',
    'react-native': '0.81.5',
    'react-native-safe-area-context': '~5.6.0',
    'react-native-screens': '~4.16.0',
    'react-native-bare-kit': '0.11.5',
  }

  const devDeps: Record<string, string> = {
    '@types/react': '~19.1.10',
    typescript: '~5.9.2',
  }

  const scripts: Record<string, string> = {
    start: 'expo start',
    ios: 'expo run:ios',
    'ios:clean': 'rm -rf ios android && npm run postinstall && expo run:ios',
    android: 'expo run:android',
  }

  const overrides: Record<string, string> = {
    'bare-fs': '4.5.1',
  }

  if (has(opts, 'p2p')) {
    Object.assign(deps, { 'bare-rpc': '^1.1.0' })
    Object.assign(devDeps, { 'bare-pack': '^1.5.1' })
    scripts['build:bare'] = 'npx bare-pack --target ios-arm64 --target ios-arm64-simulator --target ios-x64-simulator --target android-arm64 --linked --out bare/app.bundle.js bare/index.js'
    scripts.postinstall = 'npm run build:bare && npx expo prebuild'
  } else {
    scripts.postinstall = 'npx expo prebuild'
  }

  if (has(opts, 'qvac')) {
    Object.assign(deps, {
      '@qvac/sdk': '^0.7.0',
      'expo-device': '~8.0.10',
    })
  }

  return {
    path: 'package.json',
    content: JSON.stringify({
      name: opts.projectName,
      version: '0.1.0',
      private: true,
      main: 'expo-router/entry',
      scripts,
      dependencies: deps,
      devDependencies: devDeps,
      overrides,
    }, null, 2),
  }
}

function appJson(opts: GeneratorOptions): GeneratedFile {
  const plugins: any[] = [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 29,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    ['./plugins/withAndroidNdkVersion.js', '29.0.14206865'],
    ['./plugins/withAndroidArchitecture.js', ['arm64-v8a']],
  ]

  if (has(opts, 'qvac')) {
    plugins.unshift('@qvac/sdk/expo-plugin')
  }

  return {
    path: 'app.json',
    content: JSON.stringify({
      expo: {
        name: opts.projectName,
        slug: opts.projectName,
        version: '1.0.0',
        orientation: 'portrait',
        scheme: opts.projectName,
        newArchEnabled: true,
        plugins,
        ios: {
          bundleIdentifier: `com.unstoppable.${opts.projectName.replace(/-/g, '')}`,
          entitlements: {
            'com.apple.developer.kernel.increased-memory-limit': true,
          },
        },
        android: {
          package: `com.unstoppable.${opts.projectName.replace(/-/g, '')}`,
          edgeToEdgeEnabled: true,
        },
      },
    }, null, 2),
  }
}

function metroConfig(opts: GeneratorOptions): GeneratedFile {
  const nativeMocks = [
    'sodium-native', 'sodium-universal', 'corestore', 'hypercore',
    'hyperbee', 'hyperswarm', 'autobase', 'bare-fs', 'bare-path', 'bare-os',
  ]

  return {
    path: 'metro.config.js',
    content: `const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

config.resolver.unstable_enablePackageExports = true

const emptyModule = require.resolve('./mocks/empty.js')
const nativeModuleMocks = ${JSON.stringify(nativeMocks, null, 2)}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (nativeModuleMocks.includes(moduleName)) {
    return { filePath: emptyModule, type: 'sourceFile' }
  }
  return context.resolveRequest(context, moduleName, platform)
}

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bundle', 'bin', 'model', 'onnx',
]

module.exports = config
`
  }
}

function emptyMock(): GeneratedFile {
  return { path: 'mocks/empty.js', content: 'module.exports = {}\n' }
}

function pluginNdkVersion(): GeneratedFile {
  return {
    path: 'plugins/withAndroidNdkVersion.js',
    content: `const { withProjectBuildGradle } = require('@expo/config-plugins')

module.exports = function withAndroidNdkVersion(config, ndkVersion) {
  if (!ndkVersion) {
    console.warn('[withAndroidNdkVersion] No NDK version provided, skipping')
    return config
  }

  return withProjectBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents
    const extBlock = \`\\next {\\n    ndkVersion = "\${ndkVersion}"\\n}\\n\\n\`

    if (buildGradle.includes('ext {') && buildGradle.includes('ndkVersion')) {
      buildGradle = buildGradle.replace(
        /ndkVersion\\s*=\\s*["'][^"']*["']/,
        \`ndkVersion = "\${ndkVersion}"\`
      )
    } else if (buildGradle.includes('ext {')) {
      buildGradle = buildGradle.replace(
        /ext\\s*\\{/,
        \`ext {\\n    ndkVersion = "\${ndkVersion}"\`
      )
    } else {
      buildGradle = buildGradle.replace(
        /apply plugin: "expo-root-project"/,
        \`\${extBlock}apply plugin: "expo-root-project"\`
      )
    }

    config.modResults.contents = buildGradle
    console.log(\`[withAndroidNdkVersion] Set NDK version to \${ndkVersion}\`)
    return config
  })
}
`
  }
}

function pluginArchitecture(): GeneratedFile {
  return {
    path: 'plugins/withAndroidArchitecture.js',
    content: `const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins')

module.exports = function withAndroidArchitecture(config, architectures = ['arm64-v8a']) {
  config = withGradleProperties(config, (config) => {
    const architectureString = architectures.join(',')
    const propIndex = config.modResults.findIndex(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    )

    if (propIndex >= 0) {
      config.modResults[propIndex].value = architectureString
    } else {
      config.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: architectureString,
      })
    }
    return config
  })

  config = withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents
    const abiFiltersArray = architectures.map((arch) => \`"\${arch}"\`).join(', ')
    const ndkBlock = \`\\n        ndk {\\n            abiFilters \${abiFiltersArray}\\n        }\`

    if (!buildGradle.includes('ndk {')) {
      const buildConfigRegex =
        /(buildConfigField\\s+"String",\\s+"REACT_NATIVE_RELEASE_LEVEL"[^\\n]*\\n)/
      if (buildConfigRegex.test(buildGradle)) {
        buildGradle = buildGradle.replace(buildConfigRegex, \`$1\${ndkBlock}\\n\`)
      }
    } else {
      const ndkRegex = /ndk\\s*\\{[^}]*\\}/s
      const newNdkBlock = \`ndk {\\n            abiFilters \${abiFiltersArray}\\n        }\`
      buildGradle = buildGradle.replace(ndkRegex, newNdkBlock)
    }

    config.modResults.contents = buildGradle
    return config
  })

  return config
}
`
  }
}

function appLayout(): GeneratedFile {
  return {
    path: 'app/_layout.tsx',
    content: `import { Stack } from 'expo-router'

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
`
  }
}

function appIndex(opts: GeneratorOptions): GeneratedFile {
  const imports = [`import { useEffect, useState } from 'react'`]
  const importLines = [`import { Text, View, StyleSheet, SafeAreaView } from 'react-native'`]
  const statusChecks: string[] = []
  const statusDisplay: string[] = []

  if (has(opts, 'p2p')) {
    statusChecks.push(`
    try {
      const { Worklet } = require('react-native-bare-kit')
      const RPC = require('bare-rpc')
      const source = require('../bare/app.bundle.js')
      const worklet = new Worklet()
      await worklet.start('/app.bundle', source)
      const rpc = new RPC(worklet.IPC)
      const res = await rpc.request(1, JSON.stringify({ ping: true }))
      const data = JSON.parse(res.toString())
      setP2pStatus(data.ok ? 'ready' : 'error')
    } catch (e: any) {
      setP2pStatus('error: ' + e.message)
    }`)
    statusDisplay.push(`<Text style={styles.status}>P2P Worklet: {p2pStatus}</Text>`)
  }

  if (has(opts, 'qvac')) {
    statusChecks.push(`
    try {
      const sdk = require('@qvac/sdk')
      setQvacStatus(sdk.loadModel ? 'sdk loaded' : 'missing exports')
    } catch (e: any) {
      setQvacStatus('error: ' + e.message)
    }`)
    statusDisplay.push(`<Text style={styles.status}>QVAC: {qvacStatus}</Text>`)
  }

  const stateDecls: string[] = []
  if (has(opts, 'p2p')) stateDecls.push(`const [p2pStatus, setP2pStatus] = useState('checking...')`)
  if (has(opts, 'qvac')) stateDecls.push(`const [qvacStatus, setQvacStatus] = useState('checking...')`)

  return {
    path: 'app/index.tsx',
    content: `${imports.join('\n')}
${importLines.join('\n')}

export default function Home() {
  ${stateDecls.join('\n  ')}

  useEffect(() => {
    ;(async () => {${statusChecks.join('\n')}
    })()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>${opts.projectName}</Text>
        <Text style={styles.subtitle}>Unstoppable Stack — Expo Mobile</Text>
        ${statusDisplay.join('\n        ')}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#58a6ff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8b949e', marginBottom: 24 },
  status: { fontSize: 14, color: '#e6e6e6', fontFamily: 'monospace', marginTop: 8 },
})
`
  }
}

function bareWorklet(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'bare/index.js',
    content: `const RPC = require('bare-rpc')
const { IPC } = BareKit

const rpc = new RPC(IPC, async (request) => {
  try {
    const params = request.data?.length > 0
      ? JSON.parse(request.data.toString())
      : {}
    let response

    if (request.command === 1) {
      response = { ok: true, echo: params }
    } else {
      response = { error: \`Unknown command: \${request.command}\` }
    }

    request.reply(JSON.stringify(response))
  } catch (error) {
    request.reply(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }))
  }
})
`
  }
}
