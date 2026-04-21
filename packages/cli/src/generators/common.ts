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

  return {
    path: 'README.md',
    content: `# ${opts.projectName}

Built with the **Unstoppable Stack** — P2P, local-first, no servers.

## Platform

${platformName}

## Features

${features}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`${nodeSyncSection}

## Project Structure

See \`planning/\` for architecture decisions and feature plans.
`
  }
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
