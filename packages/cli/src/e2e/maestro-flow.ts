/**
 * Generates Maestro YAML flows for the scaffolded Expo Mobile app.
 *
 * Lives in `src/` (not `e2e/`) so it can be unit-tested via Vitest —
 * `vitest.config.ts` excludes the `e2e/**` runtime runner. The runner
 * (`packages/cli/e2e/test-scaffold.ts`) imports `generateMaestroFlow`
 * from here.
 *
 * Two modes:
 *   - 'simulator' — iOS simulator. Toggles the device switch to CPU
 *      and asserts no TurboModule/BareKit red-box surfaces after
 *      tapping Load Assistant. Catches missing native-module linkage
 *      without depending on real model loading (which doesn't work on
 *      the simulator per QVAC docs).
 *   - 'device' — connected iPhone. Drives the full real path:
 *      ~400MB Qwen3-0.6B download → load → send chat → assert reply.
 *      The only mode that exercises the full QVAC SDK end-to-end.
 *
 * The simulator mode also has a `qvacMock` variant used when the e2e
 * runner is invoked with `QVAC_MOCK=1`, which short-circuits the SDK
 * to a deterministic echo for fast UI smoke tests in CI.
 */

export type AiFlowMode = 'simulator' | 'device'

export interface MaestroFlowOptions {
  mode?: AiFlowMode
  /**
   * When true, the simulator flow assumes the scaffolded app is running
   * with `EXPO_PUBLIC_QVAC_MOCK=1` and uses the mocked chat round-trip
   * instead of the real-mode BareKit smoke. Ignored in 'device' mode.
   */
  qvacMock?: boolean
}

export function generateMaestroFlow(
  projectName: string,
  features: string[],
  opts: MaestroFlowOptions = {},
): string {
  const mode: AiFlowMode = opts.mode ?? 'simulator'
  const qvacMock = !!opts.qvacMock
  const bundleId = `com.unstoppable.${projectName.replace(/-/g, '')}`
  const hasLocalAi = features.includes('local-ai')

  const lines: string[] = [
    `appId: ${bundleId}`,
    '---',
    '',
    '# --- Launch and verify app header ---',
    // NOTE: We intentionally do NOT use `- clearState` here. It wipes
    // AsyncStorage including the Expo dev client's cached Metro packager
    // URL, which then causes the dev client to launch with
    // `unsanitizedScriptURLString = (null)` and a redscreen. The
    // scaffolded app ships with `app/+not-found.tsx` which redirects any
    // unknown route back to `/`, so the "Unmatched Route" cold-start
    // failure mode on iOS simulator is handled app-side instead.
    '- launchApp',
    // Do not auto-dismiss error overlays: they can hide real startup failures.
    `- extendedWaitUntil:`,
    `    visible: "${projectName}"`,
    `    timeout: 30000`,
    `- extendedWaitUntil:`,
    `    visible: "Unstoppable Stack · Expo Mobile"`,
    `    timeout: 10000`,
    '',
    '# --- Docs section (always present) ---',
    `- assertVisible: "Docs — unstoppable-stack.dev"`,
    '',
    '# --- P2P section (always present — base infrastructure) ---',
    `- assertVisible: "P2P Network"`,
    // Wait for worklet readiness before any action that depends on it. The
    // "Discovery active" label only renders once `ready === true` (worklet
    // booted + Bare RPC init completed). Without this gate, later taps race
    // the worklet bootstrap and the `if (!ready) return` guards in the
    // generated handlers silently drop them, which manifests as a missing
    // "Saved …" text and a confusing assertion failure.
    `- extendedWaitUntil:`,
    `    visible: "Discovery active"`,
    `    timeout: 20000`,
    '',
    '# --- KV Storage section ---',
    '# Verify the actual UI → RPC → Hyperbee round trip, not only taps.',
    `- assertVisible: "KV Storage"`,
    `- assertVisible:`,
    `    id: "kv-save-btn"`,
    `- assertVisible:`,
    `    id: "kv-fetch-btn"`,
    `- tapOn:`,
    `    id: "kv-key-input"`,
    `- inputText: "e2e-key"`,
    `- tapOn:`,
    `    id: "kv-value-input"`,
    `- inputText: "hello from e2e"`,
    `- tapOn:`,
    `    id: "kv-save-btn"`,
    `- extendedWaitUntil:`,
    `    visible: 'Saved.*e2e-key.*'`,
    `    timeout: 10000`,
    `- tapOn:`,
    `    id: "kv-fetch-btn"`,
    `- extendedWaitUntil:`,
    `    visible: '.*e2e-key.*hello from e2e.*'`,
    `    timeout: 10000`,
  ]

  if (hasLocalAi) {
    lines.push(
      '',
      '# --- AI Assistant: section + controls visible ---',
      `- assertVisible: "AI Assistant"`,
      `- assertVisible:`,
      `    id: "load-ai-btn"`,
      // The GPU/CPU device toggle (added 2026-05) lets users opt into
      // CPU inference. We assert it's rendered so a future regression
      // that drops the toggle is caught immediately.
      `- assertVisible:`,
      `    id: "ai-device-switch"`,
    )

    if (mode === 'device') {
      // -------------------------------------------------------------------
      // Real-device: full model load + chat round-trip.
      //
      // Stays on GPU mode (the scaffold's default). Tap Load, then wait
      // for the model to download (~400MB Qwen3-0.6B-Q4) and load. The
      // download can take several minutes on a phone hotspot, so we set
      // a 5-minute timeout. Once chat-input appears, send a message and
      // wait for the assistant bubble to populate with at least a few
      // tokens.
      //
      // This is the *only* test mode that exercises the full QVAC SDK
      // path end-to-end on real hardware.
      // -------------------------------------------------------------------
      lines.push(
        '',
        '# --- Device mode: real model download + load + chat ---',
        `- tapOn:`,
        `    id: "load-ai-btn"`,
        // 5-minute window covers cold model download. Once cached, the
        // load step itself is ~15s, well under this budget.
        `- extendedWaitUntil:`,
        `    visible:`,
        `      id: "chat-input"`,
        `    timeout: 300000`,
        // Type a deterministic prompt and verify a streamed reply arrives.
        // We don't assert on content (LLMs are non-deterministic) — only
        // that the assistant bubble renders and that no error overlay
        // appeared during inference.
        `- tapOn:`,
        `    id: "chat-input"`,
        `- inputText: "Say hi in one word."`,
        `- tapOn:`,
        `    id: "chat-send-btn"`,
        // 60s is generous for a 0.6B model on iPhone hardware (typical
        // first-token latency <2s, full 1-2 word reply <10s). The
        // chat-bubble-assistant testID only mounts when real assistant
        // content has streamed in (empty placeholders are filtered).
        `- extendedWaitUntil:`,
        `    visible:`,
        `      id: "chat-bubble-assistant"`,
        `    timeout: 60000`,
        // Same red-box guards as simulator mode — these should never
        // fire on a real device but we re-assert defensively.
        `- assertNotVisible: "TurboModuleRegistry"`,
        `- assertNotVisible: "BareKit"`,
      )
    } else if (qvacMock) {
      lines.push(
        '',
        '# --- QVAC_MOCK=1: exercise the full chat flow ---',
        `- tapOn:`,
        `    id: "load-ai-btn"`,
        `- extendedWaitUntil:`,
        `    visible:`,
        `      id: "chat-input"`,
        `    timeout: 8000`,
        `- tapOn:`,
        `    id: "chat-input"`,
        `- inputText: "hello"`,
        `- tapOn:`,
        `    id: "chat-send-btn"`,
        `- extendedWaitUntil:`,
        `    visible: "Mock:.*"`,
        `    timeout: 8000`,
      )
    } else {
      // ---------------------------------------------------------------------
      // Exercise the real SDK import and the app's explicit simulator
      // refusal. The guard runs before model download or native inference.
      lines.push(
        '',
        '# --- Simulator AI wiring smoke ---',
        `- tapOn:`,
        `    id: "ai-device-switch"`,
        `- assertVisible: "Device: CPU"`,
        `- tapOn:`,
        `    id: "load-ai-btn"`,
        `- extendedWaitUntil:`,
        `    visible: '.*Local AI requires a physical device.*'`,
        `    timeout: 10000`,
        // The device guard prevents inference; if
        // BareKit linkage is broken the red-box would have surfaced at
        // app launch (during worklet RPC init). Asserting these here
        // is cheap and catches that regression.
        `- assertNotVisible: "TurboModuleRegistry"`,
        `- assertNotVisible: "BareKit"`,
      )
    }
  }

  // Device mode does not relaunch the app — the model is loaded into
  // memory and re-launching would force another ~5-min cold load. The
  // simulator flow re-launches to verify state restores cleanly.
  if (mode !== 'device') {
    lines.push(
      '',
      '# --- Relaunch to verify state restores cleanly ---',
      '- stopApp',
      '- launchApp',
      `- extendedWaitUntil:`,
      `    visible: "${projectName}"`,
      `    timeout: 30000`,
      // Use extendedWaitUntil instead of assertVisible: the header renders a
      // moment after the project-name title when the worklet remounts.
      `- extendedWaitUntil:`,
      `    visible: "Unstoppable Stack · Expo Mobile"`,
      `    timeout: 10000`,
      `- extendedWaitUntil:`,
      `    visible: "Discovery active"`,
      `    timeout: 20000`,
      '# Fetch the previous value after process restart to verify persistence.',
      `- tapOn:`,
      `    id: "kv-key-input"`,
      `- inputText: "e2e-key"`,
      `- tapOn:`,
      `    id: "kv-fetch-btn"`,
      `- extendedWaitUntil:`,
      `    visible: '.*e2e-key.*hello from e2e.*'`,
      `    timeout: 10000`,
    )
  }

  return lines.join('\n') + '\n'
}
