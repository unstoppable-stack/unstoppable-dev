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
  | 'local-ai'      // QVAC SDK + streaming chat UI
  | 'wallet'        // WDK wallet (stub — WDK not yet validated)
  | 'node-sync'     // Register cores/drives with the Unstoppable Node for replication + backup
  | 'multi-writer'  // Autobee + HyperDB: every device reads AND writes, converging

export interface GeneratorOptions {
  projectName: string
  platform: Platform
  features: Feature[]
}

export interface GeneratedFile {
  path: string
  content: string
  /** Encoding for the content. Defaults to 'utf8'. Use 'base64' for binary
   *  files (e.g. placeholder PNG icons). */
  encoding?: 'utf8' | 'base64'
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
  {
    id: 'node-sync',
    name: 'Node Sync',
    description: 'Register data with the Unstoppable Node for P2P replication + backup',
    platforms: ['node-cli', 'pear-desktop', 'expo-mobile'],
  },
  {
    id: 'multi-writer',
    name: 'Multi-Writer Sync',
    // Replaces the default single-writer Hyperbee KV with Autobee + HyperDB
    // collections. Not available on expo-mobile: the Bare worklet is
    // bare-pack'd and linking rocksdb-native into it is unvalidated.
    description: 'Autobee + HyperDB — every device reads and writes, converging (replaces the default KV store)',
    platforms: ['node-cli', 'pear-desktop'],
  },
]
