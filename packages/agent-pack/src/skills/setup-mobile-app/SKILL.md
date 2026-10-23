---
name: setup-mobile-app
description: Extend an experimental Expo app while preserving its React Native SDK host and Bare networking worklet.
---

# Extend an Expo target

For UI work, read the workspace's `.unstoppable/guidance/core/design-guide.md`
and `ui-tokens.json`. US-related apps use the Personal Node desktop visual
system by default: graphite/cyan tokens, compact functional layouts, truthful
status, and accessible light/dark appearance. Preserve explicit user design
choices and existing workflows; use native controls and touch spacing on mobile.

Read .unstoppable/project.json, app.json, metro.config.js, package scripts, app/index.tsx and bare/index.js. The internal CLI can scaffold Expo; inspect its catalog first. The public desktop preview does not imply mobile support.

Extend UI/domain code in React Native and networking/storage in the separate Bare worklet. QVAC belongs in its React Native host, not inside the app networking worklet. Use the installed SDK types rather than desktop session APIs; Expo does not consume the common local AI runtime yet.

Preserve Metro native-module mocks, generated NDK/architecture plugins, app memory entitlements and worklet bundling scripts. Upgrade the entire Expo/React Native/BareKit/runtime/bundler/addon graph deliberately. Read the generated compatibility table for pins; do not introduce old bare-fs overrides or guess peers from a copied tutorial.

Expo Go cannot load this native graph. Use native build scripts and validate physical-device inference, failure/retry, cancellation/reuse, background/foreground lifecycle and cached offline startup on each claimed platform. Mock/simulator UI evidence does not establish native AI support. See https://docs.qvac.tether.io/sdk/js-ts-sdk/ and installed version-matched types for detailed SDK configuration.

For physical sync, validate serialized suspend/resume, request cancellation and saved-identity recovery using [device sync diagnosis](../diagnose-stack-runtime/resources/device-sync.md). Check linked native addon versions and embedded frameworks after dependency changes; rebuild the worklet and native app as needed. Store persistent file references relative to app storage rather than an installation-specific absolute container path.
