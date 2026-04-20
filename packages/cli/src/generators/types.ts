export type Platform = 'pear-desktop' | 'expo-mobile' | 'node-cli'

/**
 * High-level, user-facing features.
 *
 * Base infrastructure (P2P networking via Hyperswarm + Corestore and local KV
 * storage via Hyperbee) is always included — every Unstoppable app needs it
 * and making them optional creates a misleading UX.
 *
 * Specialized patterns like Autobase (multi-writer sync) are handled via
 * agent-pack skills, not scaffold flags.
 */
export type Feature =
  | 'local-ai' // QVAC SDK + streaming chat UI
  | 'wallet'   // WDK wallet (stub — WDK not yet validated)

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
  { id: 'pear-desktop', name: 'Pear Desktop', description: 'P2P desktop app with worker bridge + HTML UI' },
  { id: 'expo-mobile', name: 'Expo Mobile', description: 'iOS/Android with Bare worklet for native P2P' },
  { id: 'node-cli', name: 'Node.js CLI', description: 'P2P-enabled command line tool' },
]

export const FEATURES: { id: Feature; name: string; description: string; platforms: Platform[] }[] = [
  {
    id: 'local-ai',
    name: 'Local AI',
    description: 'QVAC SDK for offline inference with streaming chat UI',
    platforms: ['pear-desktop', 'expo-mobile', 'node-cli'],
  },
  {
    id: 'wallet',
    name: 'Wallet',
    description: 'WDK wallet integration (stub — coming soon)',
    platforms: ['pear-desktop', 'node-cli'],
  },
]
