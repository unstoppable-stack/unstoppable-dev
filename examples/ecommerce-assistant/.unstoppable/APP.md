# App integration

Read project.json in this directory and the app's package.json/lockfile before changing infrastructure. The profile records selected features and maturity.

Desktop native code belongs in worker.js; the renderer uses app/bridge.js and the preload API. Node managers live in src/. Expo has a separate React Native SDK host and Bare networking worklet. Read the generated entrypoints before importing a helper.

Local AI uses the vendored runtime-ai/index.js session. The app owns history/prompts/UI; the runtime owns loading, streaming, native Stop, context bounds and shutdown. One model supports one active session request. Keep consuming or return the iterator so cancellation can settle. Native acceptance still requires real model and offline tests.

Use us compatibility check -o <app> to inspect upgrade differences. Preserve application edits; do not regenerate an edited app with --force. Read installed types and version-matched upstream docs for advanced SDK APIs.
