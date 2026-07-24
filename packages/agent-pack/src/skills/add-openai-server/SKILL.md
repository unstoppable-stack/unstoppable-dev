---
name: add-openai-server
description: Expose QVAC locally via an OpenAI-compatible HTTP server (`qvac serve openai`) so existing OpenAI SDKs Just Work.
when_to_use: User wants an OpenAI-compatible REST endpoint backed by local QVAC inference — drop-in for OpenAI SDKs, Ollama-style local server, LM Studio replacement, or multi-client sharing of one loaded model.
paths: ["qvac.config.*", "scripts/**", "src/server/**"]
version: "2026-05-21"
---

# Add OpenAI-Compatible Server (QVAC CLI)

## When to Use
- User wants a local HTTP endpoint for `@openai/openai` / `openai-node` /
  `langchain` / any OpenAI-compatible client
- User mentions "OpenAI API", "Ollama", "LM Studio", "local server", "REST",
  "OpenAI-compatible", "`/v1/chat/completions`"
- User needs **multiple processes / clients** hitting one in-memory model
  instead of each spawning its own Bare worker
- User wants a language-agnostic way to call QVAC (Python, Go, cURL)

## What ships in the box

`@qvac/cli` (the companion CLI to `@qvac/sdk`) provides `qvac serve openai`,
which starts a REST server at `http://localhost:11434/v1/` that speaks the
OpenAI API surface. It reuses the same Bare worker and SDK plugins as the
in-process SDK — there is **no separate implementation**, so everything you
can do via `completion()` / `embed()` / `transcribe()` you can do via HTTP.

Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/v1/models` | List configured models |
| `POST` | `/v1/chat/completions` | Chat (SSE streaming + tool calls) |
| `POST` | `/v1/embeddings` | Embeddings |
| `POST` | `/v1/audio/transcriptions` | Whisper/Parakeet transcription |

Default port is `11434` (same as Ollama) — most OpenAI clients can point at it
with just a `baseURL` override.

## Prerequisites
- `@qvac/sdk` (`^0.15.0`) installed
- `@qvac/cli` (`^0.8.1`) installed as a dev dep
- A `qvac.config.json` at the project root — **required** for the server

## Steps

1. **Install the CLI**:
   ```bash
   # @qvac/sdk@0.15 no longer declares @qvac/cli as a peer dependency,
   # so the latest CLI line installs cleanly — no --legacy-peer-deps
   # workaround needed. `qvac verify bundle` (auto-run during Expo
   # prebuild) ships on all current CLI lines.
   npm install -D '@qvac/cli@^0.8.1'
   ```

2. **Define `serve.models` in `qvac.config.json`** — each key is the name the
   OpenAI client will use; the value wires it to a QVAC model constant and
   its load-time config:

   ```json
   {
     "cacheDirectory": "./.qvac/models",
     "loggerLevel": "info",
     "plugins": ["llm-llamacpp", "embed-llamacpp", "transcription-whispercpp"],
     "serve": {
       "models": {
         "qwen-tool": {
           "model": "QWEN_3_1_7B_INST_Q4",
           "default": true,
           "preload": true,
           "config": {
             "ctx_size": 8192,
             "tools": true,
             "system_prompt": "You are a concise assistant."
           }
         },
         "embed": {
           "model": "GTE_LARGE_FP16",
           "type": "embeddings"
         },
         "whisper": {
           "model": "WHISPER_LARGE_V3_TURBO",
           "type": "transcription"
         }
       }
     }
   }
   ```

   Key fields:
   - `default: true` picks the model used when the client doesn't specify one
   - `preload: true` loads the weights at server startup instead of on first
     request — pay the download/load cost once
   - `config.tools: true` must be set at load time for tool calling (see
     `add-ai-chat`)
   - `type` defaults to `llm`; use `embeddings` or `transcription` for those
     endpoints

3. **Start the server**:
   ```bash
   npx qvac serve openai
   # → http://localhost:11434/v1/
   ```

   Flags you'll commonly use:
   - `--port 4000` — change the port
   - `--host 0.0.0.0` — expose on the network (otherwise bound to localhost)
   - `--config path/to/qvac.config.json` — non-default config path

4. **Point an OpenAI client at it** (Node example):

   ```ts
   import OpenAI from 'openai'

   const openai = new OpenAI({
     baseURL: 'http://localhost:11434/v1',
     apiKey: 'local', // required by the SDK but ignored by QVAC
   })

   const stream = await openai.chat.completions.create({
     model: 'qwen-tool',
     messages: [{ role: 'user', content: 'Hello' }],
     stream: true,
   })

   for await (const chunk of stream) {
     process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
   }
   ```

   Python, Go, LangChain, etc. work the same way — only `base_url` changes.

5. **(Optional) Run in production** — behind `pm2` / `systemd`:
   ```bash
   pm2 start "npx qvac serve openai" --name qvac-openai
   ```

## Tool calling over HTTP

Tools are passed the OpenAI way; QVAC translates them to its internal format
and back:

```ts
const res = await openai.chat.completions.create({
  model: 'qwen-tool',
  messages: [{ role: 'user', content: "What's the weather in Rome?" }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  }],
})
```

Execute the tool in your client, append the result as a `tool` message, and
call again. Streaming + tool calls work together (same as the OpenAI API).

## Embeddings over HTTP

```ts
const res = await openai.embeddings.create({
  model: 'embed',
  input: ['First document.', 'Second document.'],
})
```

## Audio transcriptions over HTTP

```ts
import fs from 'node:fs'

const res = await openai.audio.transcriptions.create({
  model: 'whisper',
  file: fs.createReadStream('./recording.wav'),
})
```

## Critical Rules
- **`qvac.config.json` is mandatory** for the HTTP server. Without it, the
  command exits immediately.
- **`serve.models` keys are what the HTTP client sees** — not the QVAC
  constants. You can name them `gpt-4o-mini` if you need to match a hardcoded
  client string.
- **`tools: true` still has to go in `config`** (load-time `modelConfig`) —
  this is a server-side load option, not a request option. Without it, the
  model silently will not emit tool calls.
- **One model per Bare worker** — the server shares one worker across all HTTP
  clients. Loading a second LLM model via `preload` is fine, but every
  additional model adds RAM.
- **Request auth is out of scope** — the server trusts `Bearer` tokens (the
  `apiKey` field) but does not validate them. Put it behind a reverse proxy
  if you expose it beyond localhost.
- **Streaming uses SSE, not the old OpenAI JSON-stream format** — all modern
  OpenAI SDKs handle this automatically.
- **Models in `serve.models` must be compatible with your `plugins` list** —
  e.g., add `transcription-whispercpp` to `plugins` before using a Whisper
  model through `/v1/audio/transcriptions`.

## Validation
1. `qvac.config.json` loads (no `CONFIG_FILE_NOT_FOUND` error)
2. `npx qvac serve openai` binds to `http://localhost:11434` and logs the
   configured models
3. `curl http://localhost:11434/v1/models` returns the keys from
   `serve.models`
4. `/v1/chat/completions` returns SSE chunks with `delta.content`
5. Tool calls round-trip: the client sends `tools`, the server returns a
   `tool_calls` choice, the client replies with a `tool` message and gets a
   final answer
6. Embeddings endpoint returns vectors of the expected dimension
7. Audio endpoint transcribes a 16kHz mono WAV without errors

## Key Gotchas
- `/v1/chat/completions` chunks **don't** include the final `stop` sentinel of
  some older OpenAI clients — use any 2024+ SDK version
- If you set `preload: true` on several large models, startup time scales
  linearly — consider lazy load (`preload: false`) for rarely-used models
- Running the server and an in-process `@qvac/sdk` call in the same Node
  process will collide on the Bare worker singleton — use one or the other in
  any given process
- `qvac bundle sdk` (SDK bundler) is **separate** from `qvac serve openai`.
  Bundling is for tree-shaking Bare worker builds; it does not start a server.

## Relationship to other skills
- **`add-ai-chat`** — the in-process API. Use it when you have a single client
  in the same process. Use the HTTP server when you have multiple clients,
  non-JS clients, or want to share one hot model across processes.
- **`add-ai-rag`** — RAG runs alongside; you can combine the server for
  `/v1/chat/completions` with in-process `ragSearch()` and inject retrieved
  context as a system message in the HTTP request.
- **`add-ai-plugin`** — custom plugins defined with `definePlugin()` are
  exposed automatically once they're in `qvac.config.plugins` and a model
  from that plugin is listed in `serve.models`.

## Resources
- `research/qvac-llms-full.txt` — CLI + HTTP server sections
- `@qvac/cli` README once installed (`npx qvac --help`, `npx qvac serve openai --help`)
- https://docs.qvac.tether.io/ — CLI docs

> **Status**: Docs only. Based on 0.9 release notes and the `@qvac/cli`
> consolidated docs in `research/qvac-llms-full.txt`. Not yet validated with a
> battle-tested reference app.
