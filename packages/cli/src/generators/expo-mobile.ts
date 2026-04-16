import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, gitignore, readme, planningReadme } from './common.js'

export function generateExpoMobile(opts: GeneratorOptions): GeneratedFile[] {
  // Bare worklet is needed whenever p2p or qvac is selected
  const needsWorklet = has(opts, 'p2p') || has(opts, 'qvac')

  const files: GeneratedFile[] = [
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    appJson(opts),
    metroConfig(opts),
    emptyMock(),
    appLayout(opts),
    appIndex(opts),
    pluginNdkVersion(),
    pluginArchitecture(),
  ]

  if (needsWorklet) {
    files.push(bareWorklet(opts))
    files.push(workletContext(opts))
  }

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const needsWorklet = has(opts, 'p2p') || has(opts, 'qvac')

  const deps: Record<string, string> = {
    expo: '~54.0.33',
    'expo-build-properties': '~1.0.9',
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

  if (needsWorklet) {
    Object.assign(deps, {
      'bare-pack': '^1.5.1',
      'bare-rpc': '^1.1.0',
    })
    scripts['build:bare'] =
      'npx bare-pack --target ios-arm64 --target ios-arm64-simulator --target ios-x64-simulator --target android-arm64 --linked --out bare/app.bundle.js bare/index.js'
    scripts.postinstall = 'npm run build:bare && npx expo prebuild'
  } else {
    scripts.postinstall = 'npx expo prebuild'
  }

  if (has(opts, 'qvac')) {
    Object.assign(deps, {
      '@qvac/sdk': '^0.8.0',
      'bare-pack': '^1.5.1',
      'expo-device': '~8.0.10',
    })
    Object.assign(devDeps, {
      '@qvac/cli': '^0.1.2',
    })
  }

  return {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: opts.projectName,
        version: '0.1.0',
        private: true,
        main: 'expo-router/entry',
        scripts,
        dependencies: deps,
        devDependencies: devDeps,
        overrides,
      },
      null,
      2,
    ),
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
    content: JSON.stringify(
      {
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
      },
      null,
      2,
    ),
  }
}

function metroConfig(opts: GeneratorOptions): GeneratedFile {
  const nativeMocks = [
    'sodium-native',
    'sodium-universal',
    'corestore',
    'hypercore',
    'hyperbee',
    'hyperswarm',
    'autobase',
    'bare-fs',
    'bare-path',
    'bare-os',
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
`,
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
`,
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
`,
  }
}

function appLayout(opts: GeneratorOptions): GeneratedFile {
  const needsWorklet = has(opts, 'p2p') || has(opts, 'qvac')

  if (needsWorklet) {
    return {
      path: 'app/_layout.tsx',
      content: `import { Stack } from 'expo-router'
import { WorkletProvider } from '../src/contexts/WorkletContext'

export default function Layout() {
  return (
    <WorkletProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WorkletProvider>
  )
}
`,
    }
  }

  return {
    path: 'app/_layout.tsx',
    content: `import { Stack } from 'expo-router'

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
`,
  }
}

// ---------------------------------------------------------------------------
// Home screen — feature-specific sections with testIDs for E2E tests
// ---------------------------------------------------------------------------

function appIndex(opts: GeneratorOptions): GeneratedFile {
  const hasP2p = has(opts, 'p2p')
  const hasQvac = has(opts, 'qvac')
  const hasKv = has(opts, 'kv-storage')
  const needsWorklet = hasP2p || hasQvac

  // Build React Native import list
  const rnComponents = [
    'Text',
    'View',
    'StyleSheet',
    'SafeAreaView',
    'ScrollView',
    'TouchableOpacity',
    'Linking',
  ]
  if (hasKv || hasQvac) rnComponents.push('TextInput')
  if (hasQvac) rnComponents.push('ActivityIndicator')

  const topImports: string[] = [
    `import React, { useState } from 'react'`,
    `import { ${rnComponents.join(', ')} } from 'react-native'`,
  ]
  if (needsWorklet) {
    topImports.push(`import { useWorklet } from '../src/contexts/WorkletContext'`)
  }

  // State hooks
  const hooks: string[] = []
  if (needsWorklet) hooks.push(`const { ready, rpcRequest } = useWorklet()`)
  if (hasKv) {
    hooks.push(`const [kvStore, setKvStore] = useState<Record<string, string>>({})`)
    hooks.push(`const [kvKey, setKvKey] = useState('')`)
    hooks.push(`const [kvValue, setKvValue] = useState('')`)
    hooks.push(`const [kvResult, setKvResult] = useState<string | null>(null)`)
  }
  if (hasQvac) {
    hooks.push(
      `const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')`,
    )
    hooks.push(
      `const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])`,
    )
    hooks.push(`const [chatInput, setChatInput] = useState('')`)
    hooks.push(`const [thinking, setThinking] = useState(false)`)
  }

  // Handler functions
  const handlers: string[] = []

  if (hasKv) {
    handlers.push(`
  function kvSave() {
    if (!kvKey.trim()) return
    setKvStore((s) => ({ ...s, [kvKey]: kvValue }))
    setKvResult('Saved "' + kvKey + '"')
  }

  function kvFetch() {
    if (!kvKey.trim()) return
    const val = kvStore[kvKey]
    setKvResult(val !== undefined ? '"' + kvKey + '" → ' + val : '"' + kvKey + '" not found')
  }`)
  }

  if (hasQvac) {
    // Worklet commands: 2 = load-model, 3 = chat
    handlers.push(`
  async function loadAI() {
    if (!ready) return
    setAiStatus('loading')
    try {
      const res = await rpcRequest(2)
      setAiStatus(res.ok ? 'ready' : 'error')
    } catch {
      setAiStatus('error')
    }
  }

  async function sendMessage() {
    if (!chatInput.trim() || thinking || aiStatus !== 'ready') return
    const userMsg = { role: 'user' as const, content: chatInput.trim() }
    setChatInput('')
    const next = [...messages, userMsg]
    setMessages(next)
    setThinking(true)
    try {
      const res = await rpcRequest(3, { messages: next })
      if (res.ok) setMessages([...next, { role: 'assistant' as const, content: res.text }])
    } finally {
      setThinking(false)
    }
  }`)
  }

  // Build JSX sections
  const sections: string[] = []

  if (hasP2p) {
    sections.push(`
        <View style={styles.section} testID="p2p-section">
          <Text style={styles.sectionTitle}>P2P Network</Text>
          <Text style={styles.mono}>
            Worklet: {ready ? '✅ Connected' : '⏳ Starting...'}
          </Text>
          {ready && <Text style={styles.mono}>Discovery active</Text>}
        </View>`)
  }

  if (hasKv) {
    sections.push(`
        <View style={styles.section} testID="kv-section">
          <Text style={styles.sectionTitle}>KV Storage</Text>
          <TextInput
            style={styles.input}
            placeholder="Key"
            placeholderTextColor="#555"
            value={kvKey}
            onChangeText={setKvKey}
            testID="kv-key-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Value"
            placeholderTextColor="#555"
            value={kvValue}
            onChangeText={setKvValue}
            testID="kv-value-input"
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={kvSave} testID="kv-save-btn">
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={kvFetch} testID="kv-fetch-btn">
              <Text style={styles.btnText}>Fetch</Text>
            </TouchableOpacity>
          </View>
          {kvResult !== null && (
            <Text style={styles.result} testID="kv-result">{kvResult}</Text>
          )}
        </View>`)
  }

  if (hasQvac) {
    sections.push(`
        <View style={styles.section} testID="ai-section">
          <Text style={styles.sectionTitle}>AI Assistant</Text>
          {aiStatus === 'idle' && (
            <TouchableOpacity
              style={[styles.btn, styles.btnFull, !ready && styles.btnDisabled]}
              onPress={loadAI}
              disabled={!ready}
              testID="load-ai-btn"
              accessibilityLabel="Load Assistant"
            >
              <Text style={styles.btnText}>
                {ready ? 'Load Assistant' : 'Waiting for worklet...'}
              </Text>
            </TouchableOpacity>
          )}
          {aiStatus === 'loading' && (
            <View style={styles.row}>
              <ActivityIndicator color="#58a6ff" />
              <Text style={[styles.mono, { marginLeft: 8 }]}>Loading model...</Text>
            </View>
          )}
          {aiStatus === 'error' && (
            <Text style={{ color: '#f85149', fontSize: 14 }}>Failed to load model</Text>
          )}
          {aiStatus === 'ready' && (
            <>
              <ScrollView style={styles.chatList} keyboardShouldPersistTaps="handled">
                {messages.length === 0 && (
                  <Text style={styles.chatHint}>Ask me anything...</Text>
                )}
                {messages.map((msg, i) => (
                  <View
                    key={i}
                    style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}
                  >
                    <Text style={styles.bubbleText}>{msg.content}</Text>
                  </View>
                ))}
                {thinking && (
                  <View style={[styles.bubble, styles.bubbleBot]}>
                    <ActivityIndicator size="small" color="#58a6ff" />
                  </View>
                )}
              </ScrollView>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Type a message..."
                  placeholderTextColor="#555"
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={sendMessage}
                  editable={!thinking}
                  returnKeyType="send"
                  testID="chat-input"
                />
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnSend,
                    (thinking || !chatInput.trim()) && styles.btnDisabled,
                  ]}
                  onPress={sendMessage}
                  disabled={thinking || !chatInput.trim()}
                  testID="chat-send-btn"
                >
                  <Text style={styles.btnText}>→</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>`)
  }

  const docsSection = `
        <View style={styles.section} testID="docs-section">
          <Text style={styles.sectionTitle}>Resources</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://unstoppable.dev')}>
            <Text style={styles.link}>Docs — unstoppable.dev</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://github.com/holepunchto')}>
            <Text style={styles.link}>Holepunch on GitHub</Text>
          </TouchableOpacity>
        </View>`

  return {
    path: 'app/index.tsx',
    content: `${topImports.join('\n')}

export default function Home() {
  ${hooks.join('\n  ')}
  ${handlers.join('\n')}

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} testID="home-screen">
        <View style={styles.header} testID="app-header">
          <Text style={styles.title}>${opts.projectName}</Text>
          <Text style={styles.subtitle}>Unstoppable Stack · Expo Mobile</Text>
        </View>
        ${sections.join('\n        ')}
        ${docsSection}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#58a6ff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8b949e', marginBottom: 4 },
  section: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e6edf3', marginBottom: 12 },
  mono: { fontSize: 13, color: '#8b949e', fontFamily: 'monospace', marginBottom: 4 },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 10,
    color: '#e6edf3',
    marginBottom: 8,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: {
    flex: 1,
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  btnOutline: { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
  btnFull: { flex: 0, paddingHorizontal: 24, alignSelf: 'flex-start' },
  btnSend: { flex: 0, paddingHorizontal: 16, paddingVertical: 10 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  result: { marginTop: 8, fontSize: 13, color: '#3fb950', fontFamily: 'monospace' },
  chatList: { maxHeight: 220, marginBottom: 10 },
  chatHint: { color: '#555', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 16 },
  bubble: { borderRadius: 10, padding: 10, marginBottom: 6, maxWidth: '85%' },
  bubbleUser: { backgroundColor: '#1f6feb', alignSelf: 'flex-end' },
  bubbleBot: {
    backgroundColor: '#21262d',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  bubbleText: { color: '#e6edf3', fontSize: 14 },
  link: { color: '#58a6ff', fontSize: 14, marginBottom: 8 },
})
`,
  }
}

// ---------------------------------------------------------------------------
// Bare worklet — handles QVAC (cmds 2-3) and P2P (cmd 4) in Bare runtime
// ---------------------------------------------------------------------------

function bareWorklet(opts: GeneratorOptions): GeneratedFile {
  const hasQvac = has(opts, 'qvac')
  const hasP2p = has(opts, 'p2p')

  const imports: string[] = [`const RPC = require('bare-rpc')`, `const { IPC } = BareKit`]
  if (hasQvac) {
    imports.push(
      `const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = require('@qvac/sdk')`,
    )
  }

  const stateVars: string[] = [`let storagePath = null`]
  if (hasQvac) stateVars.push(`let modelId = null`)

  // Build command cases
  const cases: string[] = [
    `case 1: // init — set storage path
      storagePath = params.storagePath
      response = { ok: true }
      break`,
  ]

  if (hasQvac) {
    cases.push(`case 2: // load-model
      if (modelId) { response = { ok: true, modelId, alreadyLoaded: true }; break }
      modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, modelType: 'llm' })
      response = { ok: true, modelId }
      break`)

    cases.push(`case 3: // chat — accumulate tokens, reply when done
      if (!modelId) { response = { error: 'Model not loaded' }; break }
      const result = completion({ modelId, history: params.messages, stream: true })
      let text = ''
      for await (const token of result.tokenStream) {
        text += token
      }
      response = { ok: true, text }
      break`)
  }

  if (hasP2p) {
    cases.push(`case 4: // ping — check worklet is alive
      response = { ok: true, pong: true }
      break`)
  }

  return {
    path: 'bare/index.js',
    content: `// Bare worklet — runs in react-native-bare-kit, not in React Native context
// Commands:
//   1: init(storagePath)${hasQvac ? '\n//   2: load-model() → { ok, modelId }\n//   3: chat({ messages }) → { ok, text }' : ''}${hasP2p ? '\n//   4: ping() → { ok, pong }' : ''}
${imports.join('\n')}

${stateVars.join('\n')}

const rpc = new RPC(IPC, async (request) => {
  try {
    const params = request.data?.length > 0
      ? JSON.parse(request.data.toString())
      : {}
    let response

    switch (request.command) {
      ${cases.join('\n      ')}
      default:
        response = { error: \`Unknown command: \${request.command}\` }
    }

    request.reply(JSON.stringify(response))
  } catch (error) {
    request.reply(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }))
  }
})
`,
  }
}

// ---------------------------------------------------------------------------
// WorkletContext — generic RPC bridge between React Native and Bare worklet
// ---------------------------------------------------------------------------

function workletContext(opts: GeneratorOptions): GeneratedFile {
  const storageDirName = `${opts.projectName}-storage`
  return {
    path: 'src/contexts/WorkletContext.tsx',
    content: `import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { TurboModuleRegistry, NativeModules } from 'react-native'

interface WorkletContextValue {
  ready: boolean
  rpcRequest: (command: number, data?: any) => Promise<any>
  nativeAvailable: boolean
}

const WorkletContext = createContext<WorkletContextValue | null>(null)

function hasBareKitNativeModule(): boolean {
  return !!(TurboModuleRegistry.get('BareKit') || NativeModules.BareKit)
}

export function WorkletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [nativeAvailable] = useState(hasBareKitNativeModule)
  const workletRef = useRef<any>(null)
  const rpcRef = useRef<any>(null)

  useEffect(() => {
    if (!nativeAvailable) return
    let mounted = true

    async function init() {
      const { Worklet } = require('react-native-bare-kit')
      const RPC = require('bare-rpc')
      const { Paths, Directory } = require('expo-file-system')

      const appDir = new Directory(Paths.document, '${storageDirName}')
      if (!appDir.exists) appDir.create()
      const storagePath = appDir.uri.replace('file://', '')

      const worklet = new Worklet()
      const source = require('../../bare/app.bundle.js')
      await worklet.start('/app.bundle', source)
      workletRef.current = worklet

      const rpc = new RPC(worklet.IPC)
      rpcRef.current = rpc

      await rpc.request(1, JSON.stringify({ storagePath }))

      if (mounted) setReady(true)
    }

    init().catch((err) => console.error('Worklet init error:', err))

    return () => {
      mounted = false
      workletRef.current?.terminate()
    }
  }, [nativeAvailable])

  const rpcRequest = useCallback(async (command: number, data?: any) => {
    if (!rpcRef.current) throw new Error('Worklet not ready')
    const res = await rpcRef.current.request(command, data ? JSON.stringify(data) : undefined)
    return JSON.parse(res.toString())
  }, [])

  return (
    <WorkletContext.Provider value={{ ready, rpcRequest, nativeAvailable }}>
      {children}
    </WorkletContext.Provider>
  )
}

export function useWorklet() {
  const ctx = useContext(WorkletContext)
  if (!ctx) throw new Error('useWorklet must be used within WorkletProvider')
  return ctx
}
`,
  }
}
