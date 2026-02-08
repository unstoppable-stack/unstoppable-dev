---
id: scenarios
name: Scenarios
category: core
priority: high
---

# App Scenarios and Patterns

## 1) Collaborative Notes (Desktop)

**Goal**: Real-time notes with offline support. **Stack**: Pear + Hypercore +
Hyperbee + Hyperswarm. **Pattern**

- Hypercore log for edits.
- Hyperbee for current state (title, tags, resolved content).
- Hyperswarm topic per workspace for replication.

**Sketch**

```js
// On connection: replicate
swarm.on("connection", (conn) => core.replicate(conn));
swarm.join(workspaceTopic);
```

## 2) AI Customer Support (Desktop)

**Goal**: Local LLM with project-based prompts. **Stack**: Pear UI + Pear
terminal engine + QVAC SDK. **Pattern**

- UI holds chat state and settings.
- Engine loads model once, streams tokens.
- Use system prompt per project.

**Sketch**

```js
// Engine receives: { type: "infer", history, modelConfig }
const result = completion({ modelId, history, stream: true });
```

## 3) P2P File Drop (Desktop/Mobile)

**Goal**: Share files between peers without a server. **Stack**: Hyperdrive +
Hyperswarm + Localdrive/MirrorDrive. **Pattern**

- Writer mirrors local folder into a Hyperdrive.
- Reader mirrors Hyperdrive into local folder.

## 4) Mobile Health Logging

**Goal**: Quick log entries processed by local AI, resilient to backgrounding.
**Stack**: Expo + Bare worklet + QVAC SDK + background task queue. **Pattern**

- UI enqueues logs.
- Background processor handles inference and persists results.
- Foreground service for model downloads on Android.

## 5) Local AI Utilities (Mobile)

**Goal**: OCR or TTS on-device. **Stack**: QVAC SDK add-ons (OCR/TTS ONNX).
**Pattern**

- Pre-cache ONNX model assets.
- Run inference in Bare worklet and return results via RPC.

## 6) Payments-Enabled App

**Goal**: Accept/execute payments across chains. **Stack**: WDK + (optional)
Pear for distribution. **Pattern**

- WDK core + chain modules; store seed in secure storage.
- Use Account Abstraction modules for gasless UX.

## 7) P2P AI Delegation

**Goal**: Offload inference to a provider peer when local device is weak.
**Stack**: QVAC delegated inference + Hyperswarm topic. **Pattern**

- Provider: `startQVACProvider({ topic })`.
- Consumer:
  `loadModel({ modelSrc, modelType: "llm", delegate: { topic, providerPublicKey } })`.

## 8) Local-First Analytics

**Goal**: Analyze logs locally, sync selectively. **Stack**: Hypercore event
log + Hyperbee index + optional Hyperdrive for exports. **Pattern**

- Append events to Hypercore.
- Build derived views in Hyperbee for UI.
- Export snapshots via Hyperdrive.
