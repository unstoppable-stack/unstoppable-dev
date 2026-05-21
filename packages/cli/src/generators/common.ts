import type { GeneratedFile, GeneratorOptions, Feature } from './types.js'

export function has(opts: GeneratorOptions, feature: Feature): boolean {
  return opts.features.includes(feature)
}

export function tsconfig(): GeneratedFile {
  return {
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        resolveJsonModule: true,
        isolatedModules: true,
      },
      include: ['src'],
      exclude: ['node_modules', 'dist'],
    }, null, 2)
  }
}

export function gitignore(): GeneratedFile {
  return {
    path: '.gitignore',
    content: [
      'node_modules/',
      'dist/',
      '.pear/',
      '*.log',
      '.env',
      '.env.local',
      '.DS_Store',
      '',
    ].join('\n')
  }
}

export function readme(opts: GeneratorOptions): GeneratedFile {
  const baseFeatures = [
    '- **P2P Networking** — Hyperswarm for peer discovery and connections',
    '- **KV Storage** — Hyperbee for persistent local key-value data',
  ]
  const optionalFeatures = opts.features.map((f) => {
    switch (f) {
      case 'local-ai':
        return '- **Local AI** — QVAC SDK for offline inference with streaming chat'
      case 'wallet':
        return '- **Wallet** — WDK wallet integration (stub — coming soon)'
      case 'node-sync':
        return '- **Node Sync** — Replicate data to the Unstoppable Node for backup + seeding'
    }
  })
  const features = [...baseFeatures, ...optionalFeatures].join('\n')

  const platformName = {
    'pear-desktop': 'Pear Desktop',
    'expo-mobile': 'Expo Mobile (iOS/Android)',
    'node-cli': 'Node.js CLI',
  }[opts.platform]

  const nodeSyncSection = opts.features.includes('node-sync')
    ? `

## Connecting to the Unstoppable Node

This app registers its data with a local Unstoppable Node for P2P
replication and backup. To enable sync, run the node in a separate
terminal:

\`\`\`bash
npx unstoppable-node
\`\`\`

The app will attempt to pair automatically on startup and keep working
regardless of whether the Node is running.`
    : ''

  const gettingStarted = gettingStartedFor(opts)

  return {
    path: 'README.md',
    content: `# ${opts.projectName}

Built with the **Unstoppable Stack** — P2P, local-first, no servers.

## Platform

${platformName}

## Features

${features}

${gettingStarted}${nodeSyncSection}

## Project Structure

See \`planning/\` for architecture decisions and feature plans.
`
  }
}

function gettingStartedFor(opts: GeneratorOptions): string {
  if (opts.platform === 'expo-mobile') {
    return `## Getting Started

\`\`\`bash
npm install
npm run ios       # iOS simulator (or: npm run android)
\`\`\`

The first run takes 3–5 minutes — it generates the native \`ios/\` and
\`android/\` projects, runs \`pod install\`, and builds a real binary that
links \`react-native-bare-kit\` and the QVAC SDK's native modules. After
that, you can iterate on JavaScript with \`npm run start\` (Metro only,
~2s reloads). You only need to redo \`npm run ios\` when you change a
native dependency or a config plugin.

### Why not Expo Go?

This app uses **custom native modules** (\`react-native-bare-kit\` for the
P2P worklet, \`@qvac/sdk\` for local AI). Expo Go is a fixed shell app
that only ships Expo's stock modules — it physically cannot load
BareKit. If you open the dev URL in Expo Go you'll see:

\`\`\`
[Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'BareKit'
 could not be found.]
\`\`\`

Always launch via \`npm run ios\` / \`npm run android\` so the native build
includes everything.

### On a physical device

\`\`\`bash
npx expo run:ios --device       # iOS — pick your connected iPhone
npx expo run:android --device   # Android — physical device
\`\`\`

QVAC inference (LLM completion) **only works on physical devices** —
\`llamacpp\` doesn't support iOS Simulator or Android Emulator. The UI
will load on simulators but \`Load Assistant\` blocks GPU mode there.
Toggle to CPU mode to experiment, or set \`EXPO_PUBLIC_QVAC_MOCK=1\` to
test the chat UI flow without real inference.`
  }
  return `## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\``
}

export function planningReadme(): GeneratedFile {
  return {
    path: 'planning/README.md',
    content: `# Planning

Architecture decisions, feature plans, and project documentation.

## What Goes Here

- **Architecture decisions** — Record important technical choices
- **Feature plans** — Break down features before implementing
- **Design docs** — Document system design and data flows
`
  }
}
