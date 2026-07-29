---
name: setup-node-cli
description: Node.js CLI application with P2P and AI capabilities.
when_to_use: User is customizing a Node.js CLI app beyond what the scaffold provides, or needs Node-specific patterns.
paths: ["src/index.ts", "src/**/*.ts"]
version: "2026-04-14"
---

# Setup Node.js CLI App

> **Start with the scaffold:** `us scaffold app -p node-cli -n <name> -f <features>`
>
> The scaffold generates a validated TypeScript project with correct dependencies, type declarations
> for untyped P2P modules, and feature-specific managers. This skill covers customization and advanced patterns.

## What the Scaffold Handles (do NOT redo manually)

The `us scaffold app -p node-cli` command generates:

- `package.json` with correct dependency versions and `@types/node`
- `tsconfig.json` with strict mode, ES2022, NodeNext resolution
- `src/index.ts` with graceful startup/shutdown and feature initialization
- `src/types.d.ts` with `declare module` for untyped P2P libraries (hyperswarm, corestore, etc.)
- Feature-specific managers (`swarm-manager.ts`, `storage-manager.ts`, `ai-manager.ts`)

All feature combinations (local-ai, wallet, node-sync, and their combos) are validated to typecheck and run.

## When to Read This Skill
- You already scaffolded and need to **add custom commands or features**
- You need to **understand the architecture** for a Node.js P2P app
- You want to compare **Node.js CLI vs Pear Terminal** tradeoffs

## Prerequisites
- Node.js 20+ with ESM support
- npm (preferred) or bun

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
   npm i hyperswarm

   # Key-value storage
   npm i hypercore hyperbee

   # Local AI
   npm i @qvac/sdk zod@^4
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

## Critical Rules
- **Always handle SIGINT for cleanup** — P2P swarms, database handles, and AI models must be closed on exit. Without cleanup, orphan DHT announcements linger and storage files can corrupt.
- **Use `tsx` for development, not `ts-node`** — `ts-node` has ESM compatibility issues with Hyperswarm and QVAC. `tsx` handles ESM natively.
- **Handle storage paths correctly** — use absolute paths or resolve relative to a known base. Relative paths break when the CLI is invoked from different directories.
- **Don't use `process.exit()` without cleanup** — always destroy swarm, close databases, and unload models before exiting. Use the SIGINT handler pattern from the Steps section.
- **Don't ignore unhandled rejections** — P2P operations fail silently. Add `process.on('unhandledRejection', ...)` during development.
- **Pin dependency versions** — Hyperswarm and QVAC minor versions can introduce breaking changes. Use exact versions in `package.json`.

## Validation
1. CLI starts without errors (`pnpm dev` or `tsx src/index.ts` runs clean)
2. Commands execute and produce expected output
3. SIGINT (Ctrl+C) triggers cleanup — swarm destroyed, DB closed, no orphan processes
4. Data persists across restarts (re-running the CLI reads previously stored data)
5. Storage directory is created in the expected location (not a random relative path)
6. P2P operations work (if using Hyperswarm: peers connect, data replicates)

## Key Gotchas
- Use `tsx` for development (TypeScript execution without build)
- Use `.js` extensions in imports when targeting `NodeNext` module resolution
- Add `.npmrc` with `shamefully-hoist=true` if using `bare-rpc` with pnpm
- `@qvac/sdk` works directly in Node.js — no worker pattern needed
- Hyperswarm works the same in Node.js as in Bare

> **Status**: Battle-tested. The coffee-assistant reference app ran as
> a Node.js CLI and validated Hyperswarm, bare-rpc, Hyperbee, and QVAC.
