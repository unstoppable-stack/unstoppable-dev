import { readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')

const CORE_RULES = {
  'src/core/architecture.md': {
    description: 'How Unstoppable Stack modules fit together: runtimes, data layers, AI, and P2P networking',
    alwaysApply: true,
  },
  'src/core/cheatsheet.md': {
    description: 'Quick reference for common imports, APIs, and patterns in the Unstoppable Stack',
    alwaysApply: true,
  },
  'src/core/design-guide.md': {
    description: 'Guidelines for designing desktop and mobile UIs with the Unstoppable Stack',
    alwaysApply: false,
  },
  'src/core/patterns.md': {
    description: 'Common code patterns for P2P apps: scaffolding, worker bridges, NDJSON messaging',
    alwaysApply: false,
  },
  'src/core/principles.md': {
    description: 'Pre-implementation checklist and core development principles for P2P apps',
    alwaysApply: true,
  },
  'src/core/production-readiness.md': {
    description: 'Production readiness checklist for Unstoppable Stack apps',
    alwaysApply: false,
  },
  'src/core/scenarios.md': {
    description: 'App architecture scenarios and decision trees: collaborative notes, AI assistant, file sharing',
    alwaysApply: false,
  },
  'src/core/verified-versions.md': {
    description: 'Battle-tested package versions for all Unstoppable Stack dependencies',
    alwaysApply: true,
  },
}

const MODULE_RULES = {
  'src/modules/bare.md': {
    description: 'Bare runtime: minimal JS runtime for P2P and embedded use',
  },
  'src/modules/corestore.md': {
    description: 'Corestore: manage multiple Hypercores from a single storage backend',
  },
  'src/modules/expo-bare.md': {
    description: 'Expo Bare: React Native with Bare runtime for mobile P2P apps',
  },
  'src/modules/hyperbee.md': {
    description: 'Hyperbee: sorted key-value store built on Hypercore',
  },
  'src/modules/hypercore.md': {
    description: 'Hypercore: append-only log, the foundation of all Holepunch data structures',
  },
  'src/modules/hyperdb.md': {
    description: 'HyperDB: P2P key-value database with schema, indexes, and multi-writer support',
  },
  'src/modules/hyperdht.md': {
    description: 'HyperDHT: distributed hash table for peer discovery and NAT traversal',
  },
  'src/modules/hyperdrive.md': {
    description: 'Hyperdrive: P2P file storage, sharing, and mirroring',
  },
  'src/modules/hyperswarm.md': {
    description: 'Hyperswarm: P2P networking, peer discovery, and connection management via DHT',
  },
  'src/modules/pear.md': {
    description: 'Pear Runtime: desktop and terminal P2P app runtime with built-in distribution',
  },
  'src/modules/qvac.md': {
    description: 'QVAC SDK: local AI model inference for chat, vision, transcription, and tool calling',
  },
  'src/modules/wdk.md': {
    description: 'WDK Wallet: crypto wallet and payments integration from Tether',
  },
}

const RECIPE_RULES = {
  'src/recipes/file-sharing.md': {
    description: 'Recipe: P2P file sharing with Hyperdrive and Hyperswarm',
  },
  'src/recipes/local-inference.md': {
    description: 'Recipe: local AI inference with QVAC SDK streaming output',
  },
  'src/recipes/local-p2p-testing.md': {
    description: 'Recipe: testing P2P apps locally with multiple peer instances',
  },
  'src/recipes/offline-first-app.md': {
    description: 'Recipe: offline-first app with Hypercore storage and automatic sync',
  },
  'src/recipes/p2p-data-sync.md': {
    description: 'Recipe: syncing data between peers with HyperDB replication',
  },
  'src/recipes/p2p-ndjson-messaging.md': {
    description: 'Recipe: NDJSON messaging over Hyperswarm P2P streams',
  },
  'src/recipes/p2p-rpc.md': {
    description: 'Recipe: request/response RPC over Protomux P2P channels',
  },
  'src/recipes/qvac-delegated-inference.md': {
    description: 'Recipe: delegated AI inference with QVAC over P2P connections',
  },
  'src/recipes/qvac-embeddings-rag-sqlite.md': {
    description: 'Recipe: embeddings and RAG with QVAC and SQLite vector search',
  },
  'src/recipes/qvac-kv-cache.md': {
    description: 'Recipe: QVAC KV cache and context management for multi-turn conversations',
  },
  'src/recipes/qvac-logging.md': {
    description: 'Recipe: QVAC inference logging streams for debugging and monitoring',
  },
  'src/recipes/qvac-model-sources.md': {
    description: 'Recipe: loading QVAC models from filesystem, HTTP, and Hyperdrive sources',
  },
  'src/recipes/qvac-multimodal-vision.md': {
    description: 'Recipe: QVAC multimodal vision inference for image analysis',
  },
  'src/recipes/qvac-tool-calling.md': {
    description: 'Recipe: QVAC tool/function calling with Zod schemas and structured output',
  },
  'src/recipes/qvac-transcription.md': {
    description: 'Recipe: audio transcription with QVAC Whisper models',
  },
  'src/recipes/qvac-translation.md': {
    description: 'Recipe: text translation with QVAC LLM and NMT models',
  },
  'src/recipes/secure-communication.md': {
    description: 'Recipe: encrypted P2P communication with Protomux secret streams',
  },
  'src/recipes/wallet-integration.md': {
    description: 'Recipe: WDK wallet integration for crypto payments in P2P apps',
  },
}

function convertFile(relPath, meta) {
  const absPath = join(ROOT, relPath)
  const content = readFileSync(absPath, 'utf8')

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!fmMatch) {
    console.warn(`  SKIP (no frontmatter): ${relPath}`)
    return
  }

  const bodyAfterFm = content.slice(fmMatch[0].length)

  let newFm = `---\ndescription: ${meta.description}\n`
  if (meta.alwaysApply !== undefined) {
    newFm += `alwaysApply: ${meta.alwaysApply}\n`
  } else {
    newFm += `alwaysApply: false\n`
  }
  if (meta.globs) {
    if (Array.isArray(meta.globs)) {
      newFm += `globs:\n${meta.globs.map(g => `  - "${g}"`).join('\n')}\n`
    } else {
      newFm += `globs: "${meta.globs}"\n`
    }
  }
  newFm += `---\n`

  const newContent = newFm + bodyAfterFm
  writeFileSync(absPath, newContent, 'utf8')

  const newPath = absPath.replace(/\.md$/, '.mdc')
  if (newPath !== absPath) {
    renameSync(absPath, newPath)
    console.log(`  CONVERTED + RENAMED: ${relPath} → ${relPath.replace(/\.md$/, '.mdc')}`)
  } else {
    console.log(`  CONVERTED: ${relPath}`)
  }
}

console.log('Converting core rules...')
for (const [path, meta] of Object.entries(CORE_RULES)) {
  convertFile(path, meta)
}

console.log('\nConverting module rules...')
for (const [path, meta] of Object.entries(MODULE_RULES)) {
  convertFile(path, meta)
}

console.log('\nConverting recipe rules...')
for (const [path, meta] of Object.entries(RECIPE_RULES)) {
  convertFile(path, meta)
}

console.log('\nDone! Converted', Object.keys(CORE_RULES).length + Object.keys(MODULE_RULES).length + Object.keys(RECIPE_RULES).length, 'files.')
