---
name: add-ai-plugin
description: Extend QVAC with a custom plugin — new model type + typed handlers via `definePlugin()` and `defineHandler()`.
when_to_use: User wants to add a model type QVAC doesn't ship (custom ONNX/GGUF/JS logic), wrap a native addon, or ship reusable handler(s) as an npm package.
paths: ["plugins/**", "src/plugins/**", "*-plugin/**"]
version: "2026-04-20"
---

# Add a Custom QVAC Plugin

## When to Use
- User wants to integrate a model architecture QVAC doesn't ship
  (custom ONNX, a new quantization format, an entirely new modality)
- User wants to wrap a native C/C++ addon as a model type
- User wants to package reusable inference logic as a shared npm module for
  other apps / peers
- User mentions "plugin", "definePlugin", "custom model type", "native addon",
  or wants to add `invokePlugin()` / `invokePluginStream()` handlers

## Prerequisites
- `@qvac/sdk` (`^0.9.0`) installed
- `zod` (`^4.0.0`) — request/response schemas are Zod v4
- Bare-compatible code for the worker-side entrypoint (no Node-only APIs,
  no dynamic imports)

## Plugin Anatomy

A QVAC plugin is an npm package with **two entrypoints**:

| Entrypoint | Runtime | Purpose |
|-----------|---------|---------|
| `.` (package root) | Metro / Node / Bare | Client-side wrappers — what consumers import. Re-exports typed `invokePlugin` calls. |
| `./plugin` | Bare worker only | Plugin definition (`definePlugin(...)`) + handler implementations. Native addons allowed here. |

Separating them is mandatory: the worker runs in Bare and may load native
addons, while the client side must stay bundler-safe for React Native / Metro
and the browser worker boundary.

## Steps

1. **Create the package** with two entrypoints in `package.json`:

   ```json
   {
     "name": "qvac-my-plugin",
     "type": "module",
     "exports": {
       ".": {
         "types": "./dist/client.d.ts",
         "import": "./dist/client.js"
       },
       "./plugin": {
         "types": "./dist/plugin.d.ts",
         "import": "./dist/plugin.js"
       }
     },
     "dependencies": {
       "@qvac/sdk": "^0.9.0",
       "zod": "^4.0.0"
     }
   }
   ```

2. **Write the worker-side plugin** — the thing that actually runs in Bare:

   ```ts
   // src/plugin/index.ts
   import { z } from 'zod'
   import { definePlugin, defineHandler } from '@qvac/sdk/plugin-utils'
   import type { CreateModelParams, PluginModelResult } from '@qvac/sdk'

   export const echoPlugin = definePlugin({
     modelType: 'echo', // must be unique; cannot shadow built-in types
     displayName: 'Echo Plugin',
     addonPackage: 'none', // or the npm name of a native addon
     loadConfigSchema: z.object({}).catchall(z.unknown()),

     createModel: (params: CreateModelParams): PluginModelResult => {
       // Called when loadModel({ modelType: 'echo', ... }) runs.
       // Return an object with at least { model, loader }.
       const model = {
         id: params.modelId,
         load: async () => {
           // Open files, initialize state, etc.
         },
       }
       return { model, loader: null }
     },

     handlers: {
       echo: defineHandler({
         requestSchema: z.object({ message: z.string() }),
         responseSchema: z.object({ echoed: z.string(), timestamp: z.number() }),
         handler: async (request) => ({
           echoed: `Echo: ${request.message}`,
           timestamp: Date.now(),
         }),
       }),

       // Streaming handler — mark `streaming: true` and yield chunks.
       echoStream: defineHandler({
         streaming: true,
         requestSchema: z.object({ message: z.string() }),
         responseSchema: z.object({
           char: z.string().nullable(),
           done: z.boolean(),
         }),
         handler: async function* (request) {
           for (const char of request.message) {
             yield { char, done: false }
           }
           yield { char: null, done: true }
         },
       }),
     },
   })
   ```

3. **Write the client wrappers** — what end users import from your package:

   ```ts
   // src/client/index.ts
   import { invokePlugin, invokePluginStream } from '@qvac/sdk'

   export async function echo(options: { modelId: string; message: string }) {
     return invokePlugin<{ echoed: string; timestamp: number }>({
       modelId: options.modelId,
       handler: 'echo',
       params: { message: options.message },
     })
   }

   export async function* echoStream(options: {
     modelId: string
     message: string
   }) {
     for await (const chunk of invokePluginStream<{
       char: string | null
       done: boolean
     }>({
       modelId: options.modelId,
       handler: 'echoStream',
       params: { message: options.message },
     })) {
       if (!chunk.done && chunk.char) yield chunk.char
     }
   }
   ```

   Consumers should never have to call `invokePlugin()` directly — your
   wrappers are the public API.

4. **Register the plugin** in the consumer's `qvac.config.json`:

   ```json
   {
     "plugins": [
       "llm-llamacpp",
       "qvac-my-plugin"
     ]
   }
   ```

   The SDK resolves each string as an npm package, imports its `./plugin`
   entrypoint, and registers the exported plugin.

5. **Use the plugin** in consumer code:

   ```ts
   import { loadModel, unloadModel } from '@qvac/sdk'
   import { echo, echoStream } from 'qvac-my-plugin'

   const modelId = await loadModel({
     modelSrc: '/some/path/or/registry/id',
     modelType: 'echo',
     modelConfig: { /* validated by loadConfigSchema */ },
   })

   const result = await echo({ modelId, message: 'hi' })
   for await (const ch of echoStream({ modelId, message: 'hi' })) {
     process.stdout.write(ch)
   }

   await unloadModel({ modelId })
   ```

## Advanced Features

### `resolveConfig` hook

Run before `createModel` to download / resolve artifacts — e.g., fetch model
files from Hyperdrive and rewrite paths to local files:

```ts
definePlugin({
  // ...
  resolveConfig: async (modelConfig, ctx) => {
    const localPath = await ctx.downloadAsset(modelConfig.modelSrc)
    return {
      config: { ...modelConfig, modelPath: localPath },
      artifacts: [localPath],
    }
  },
})
```

### `skipPrimaryModelPathValidation`

Set to `true` when your plugin derives paths from config fields other than
the main model file (e.g., diffusion plugins that need a UNet + VAE + text
encoder triple).

### `logging`

Attach a named logger so log output is routed through the SDK's logging
stream:

```ts
import { getLogger } from '@qvac/sdk'

definePlugin({
  // ...
  logging: {
    namespace: 'my-plugin',
  },
})
```

Consumers stream these logs with `loggingStream({ id: 'my-plugin' })`.

## Critical Rules
- **Two entrypoints, always** — `.` (Metro-safe) and `./plugin` (Bare-only).
  Mixing them will cause Metro bundling failures on Expo/RN and Node-only
  errors on web/worker targets.
- **Plugin code must be statically bundleable** — no dynamic `import()`, no
  Node-only stdlib in the worker path, no unserializable types in request /
  response payloads.
- **`modelType` must be unique** — you cannot register `llm`, `embeddings`,
  `whisper`, `parakeet`, `nmt`, `tts`, `ocr`, `diffusion` (these are
  reserved). Use a namespaced string (`myco-foo`) to avoid clashes.
- **Request / response payloads must be plain JSON** — no classes, Dates,
  Buffers, Maps, Sets, functions. Validate with Zod; serialize explicitly
  when you need to pass binary.
- **`streaming` is per-handler** — do not mix `streaming: true` and
  non-streaming dispatch. `invokePlugin()` will throw
  `PLUGIN_HANDLER_TYPE_MISMATCH` if you call a streaming handler without the
  stream API (or vice versa).
- **Handler schemas are validated in both directions** — bad requests throw
  `PLUGIN_REQUEST_VALIDATION_FAILED`, bad responses throw
  `PLUGIN_RESPONSE_VALIDATION_FAILED`. This is a feature; embrace it.
- **`loadConfigSchema` is optional but recommended** — without it, any
  `modelConfig` is accepted verbatim. With it, invalid configs fail fast.
- **Expose wrappers, not `invokePlugin` calls** — consumers should import
  `echo()`, not build their own handler strings. This keeps breaking changes
  in the package, not in every consumer.

## Validation
1. `bun link` / `npm link` into a test app that sets `plugins: ['my-plugin']`
   in `qvac.config.json`
2. `loadModel({ modelType: 'my-plugin-type' })` resolves without errors
3. `invokePlugin()` round-trips (request validated → handler runs → response
   validated)
4. Streaming handler: `invokePluginStream()` yields progressively, terminates
   on `done`
5. `getLogger(...)` / `loggingStream({ id })` produces the plugin's log lines
6. Consumers can import your typed wrapper (`import { echo } from '...'`)
   without pulling in Bare-only code
7. Package builds with no `import()` in worker code (static analysis /
   `bare-pack` must succeed)

## Key Gotchas
- **`addonPackage`**: use `"none"` for pure-JS plugins. Otherwise it must
  match the npm name of the native addon so `bare-pack` traces it.
- **Local development**: `bun link` (or `npm link`) into the consumer app,
  then add the plugin to `qvac.config.plugins`.
- **Every consumer must list your plugin in `qvac.config.plugins`** — being
  installed as a dependency is not enough; plugins are explicit opt-in
  (necessary for tree-shaking with `qvac bundle sdk`).
- **Zod v4** is required throughout. Do not ship a plugin that depends on
  Zod v3 — the schemas won't line up with SDK types.
- **Register once, use many** — `PLUGIN_ALREADY_REGISTERED` means the same
  `modelType` was registered twice (duplicate entries in the plugins array).
- Consumers who use the OpenAI-compatible HTTP server can expose plugin
  models through `serve.models` once your plugin is in `plugins`.

## Publishing Checklist
- [ ] `package.json` has both `.` and `./plugin` exports
- [ ] Root entrypoint is Metro-safe (no Node / Bare imports)
- [ ] `./plugin` entrypoint is Bare-compatible (no Node-only stdlib, no
      dynamic imports)
- [ ] All request / response payloads are JSON-serializable
- [ ] Handler schemas are defined with Zod v4
- [ ] `addonPackage` is either a real npm name or `"none"`
- [ ] README documents the `modelType` name and which handlers exist
- [ ] README tells consumers to add the package to `qvac.config.plugins`

## Relationship to other skills
- **`add-ai-image-gen`** — built-in `diffusion-cpp` is itself a plugin.
  Writing a custom image pipeline (different sampler, different model format)
  is a plugin task.
- **`add-openai-server`** — custom model types show up through
  `/v1/models` when you list the plugin's package name in
  `qvac.config.plugins` and a model from the plugin in `serve.models`.

## Resources
- `research/qvac-llms-full.txt` — "Write a custom plugin" section
  (`/sdk/examples/utilities/write-custom-plugin`)
- `@qvac/sdk/plugin-utils` — `definePlugin`, `defineHandler`
- SDK error codes: `PLUGIN_*` for everything the plugin system can throw
- https://docs.qvac.tether.io/sdk/examples/utilities/write-custom-plugin

> **Status**: Docs only. Based on the 0.9 plugin system reference and the
> `qvac-echo-plugin` walkthrough in `research/qvac-llms-full.txt`. Not yet
> validated with a battle-tested reference plugin.
