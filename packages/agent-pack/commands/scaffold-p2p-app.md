---
name: scaffold-p2p-app
description: Scaffold a new P2P application with Hyperswarm networking,
  Corestore data management, and proper project structure
---

# Scaffold P2P App

Create a new P2P application with the Unstoppable Stack.

## Steps

1. Ask the user for:
   - Project name
   - Runtime: Pear Desktop, Pear Terminal, Node.js CLI, or Expo Mobile
   - Data layer: HyperDB, Hyperbee, Hyperdrive, or none
   - Whether they need AI inference (QVAC)

2. Create the project directory with this structure:
   ```
   <project-name>/
   ├── src/
   │   ├── index.ts
   │   ├── p2p/
   │   │   └── swarm.ts
   │   ├── data/
   │   │   └── store.ts
   │   └── app/
   │       └── main.ts
   ├── package.json
   ├── tsconfig.json
   └── README.md
   ```

3. Use the verified package versions from the `verified-versions` rule

4. Set up Hyperswarm with topic-based discovery and Corestore replication

5. Add proper error handling for peer disconnection

6. Include a README with prerequisites, install steps, and how to run

7. If Pear Desktop: set up the worker pattern for native modules
