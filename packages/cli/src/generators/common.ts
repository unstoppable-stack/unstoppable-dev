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
  const features = opts.features.map(f => {
    switch (f) {
      case 'p2p': return '- **P2P Networking** — Hyperswarm for peer discovery and connections'
      case 'kv-storage': return '- **KV Storage** — Hyperbee for persistent key-value data'
      case 'qvac': return '- **Local AI** — QVAC SDK for offline inference'
      case 'autobase': return '- **Multi-writer Sync** — Autobase for collaborative data'
    }
  }).join('\n')

  const platformName = {
    'pear-desktop': 'Pear Desktop',
    'expo-mobile': 'Expo Mobile (iOS/Android)',
    'node-cli': 'Node.js CLI',
  }[opts.platform]

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
\`\`\`

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
