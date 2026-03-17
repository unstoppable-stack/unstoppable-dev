export type Platform = 'pear-desktop' | 'expo-mobile' | 'node-cli'

export type Feature =
  | 'p2p'        // Hyperswarm + Corestore
  | 'kv-storage' // Hyperbee
  | 'qvac'       // Local AI inference
  | 'autobase'   // Multi-writer sync

export interface GeneratorOptions {
  projectName: string
  platform: Platform
  features: Feature[]
}

export interface GeneratedFile {
  path: string
  content: string
}

export type Generator = (opts: GeneratorOptions) => GeneratedFile[]

export const PLATFORMS: { id: Platform; name: string; description: string }[] = [
  { id: 'pear-desktop', name: 'Pear Desktop', description: 'P2P desktop app with worker bridge + React UI' },
  { id: 'expo-mobile', name: 'Expo Mobile', description: 'iOS/Android with optional Bare worklet' },
  { id: 'node-cli', name: 'Node.js CLI', description: 'P2P-enabled command line tool' },
]

export const FEATURES: { id: Feature; name: string; description: string; platforms: Platform[] }[] = [
  { id: 'p2p', name: 'P2P Networking', description: 'Hyperswarm + Corestore', platforms: ['pear-desktop', 'expo-mobile', 'node-cli'] },
  { id: 'kv-storage', name: 'KV Storage', description: 'Hyperbee key-value database', platforms: ['pear-desktop', 'expo-mobile', 'node-cli'] },
  { id: 'qvac', name: 'Local AI', description: 'QVAC SDK for local inference', platforms: ['pear-desktop', 'expo-mobile', 'node-cli'] },
  { id: 'autobase', name: 'Multi-writer Sync', description: 'Autobase for collaborative data', platforms: ['pear-desktop', 'node-cli'] },
]
