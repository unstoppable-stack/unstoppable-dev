---
name: setup-node-cli
description: Scaffold a Node.js CLI application with P2P and AI capabilities.
  Use when the user wants a simple terminal tool or script without Pear
  distribution. The simplest and fastest path to a working app.
---

# Setup Node.js CLI App

## When to Use
- User wants a simple terminal tool or script
- User mentions "CLI", "command line", "terminal app", "Node.js app"
- User doesn't need P2P distribution (pear:// links)
- User wants the simplest possible setup

## Prerequisites
- Node.js 20+ with ESM support
- pnpm (or npm/bun)

## Architecture Overview

The simplest setup — a standard Node.js ESM project. All Unstoppable Stack
modules (Hyperswarm, QVAC, Hyperbee, etc.) work directly in Node.js without
any special runtime or worker pattern.

```
my-cli/
├── src/
│   ├── index.ts          # Entry point
│   ├── app/              # Application logic
│   ├── p2p/              # P2P networking (if needed)
│   ├── data/             # Storage (if needed)
│   └── ai/               # AI inference (if needed)
├── package.json
├── tsconfig.json
└── README.md
```

## Steps

1. **Initialize project**:

   ```bash
   mkdir my-cli && cd my-cli
   pnpm init
   ```

2. **Configure `package.json`**:

   ```json
   {
     "name": "my-cli",
     "version": "0.1.0",
     "type": "module",
     "scripts": {
       "dev": "tsx src/index.ts",
       "build": "tsc",
       "start": "node dist/index.js"
     },
     "devDependencies": {
       "tsx": "^4.0.0",
       "typescript": "^5.0.0",
       "@types/node": "^20.0.0"
     }
   }
   ```

3. **Configure TypeScript** (`tsconfig.json`):

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "outDir": "dist",
       "rootDir": "src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true
     },
     "include": ["src"]
   }
   ```

4. **Create entry point** (`src/index.ts`):

   ```ts
   console.log('Hello from my-cli!')

   // Graceful shutdown
   process.on('SIGINT', async () => {
     console.log('Shutting down...')
     // Cleanup: destroy swarm, unload model, close DB
     process.exit(0)
   })
   ```

5. **Add capabilities** as needed:
   ```bash
   # P2P networking
   pnpm add hyperswarm

   # Key-value storage
   pnpm add hypercore hyperbee

   # Local AI
   pnpm add @qvac/sdk zod@^4
   ```

6. **Run in development**:
   ```bash
   pnpm dev
   ```

## vs Pear Terminal

| | Node.js CLI | Pear Terminal |
|---|------------|--------------|
| Distribution | npm | pear:// links |
| Runtime | Node.js | Bare |
| Setup complexity | Lowest | Low |
| API compatibility | Full Node.js | Bare subset |
| Best for | Scripts, tools, POCs | P2P-distributed services |

**Choose Node.js CLI** for the fastest path. **Choose Pear Terminal** if you
need P2P distribution or plan to run alongside Pear desktop apps.

## Key Gotchas
- Use `tsx` for development (TypeScript execution without build)
- Use `.js` extensions in imports when targeting `NodeNext` module resolution
- Add `.npmrc` with `shamefully-hoist=true` if using `bare-rpc` with pnpm
- `@qvac/sdk` works directly in Node.js — no worker pattern needed
- Hyperswarm works the same in Node.js as in Bare

> **Status**: Battle-tested. The coffee-assistant reference app ran as
> a Node.js CLI and validated Hyperswarm, bare-rpc, Hyperbee, and QVAC.
