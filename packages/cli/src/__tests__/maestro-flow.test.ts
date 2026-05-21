import { describe, expect, it } from 'vitest'

import { generateMaestroFlow } from '../e2e/maestro-flow.js'

describe('generateMaestroFlow', () => {
  describe('always-on assertions', () => {
    it('targets the project bundle id derived from the project name', () => {
      // Slug = projectName with `-` removed. Used by Pear's app-name
      // validator and by Expo's bundle id convention. Anything that breaks
      // the slugging here will silently target the wrong app and produce
      // a confusing "appId not running" Maestro error.
      const flow = generateMaestroFlow('e2e-local-ai', ['local-ai'])
      expect(flow).toContain('appId: com.unstoppable.e2elocalai')
    })

    it('asserts the AI section + GPU/CPU device toggle render', () => {
      // The toggle was added 2026-05 to let users opt into CPU inference.
      // A regression that drops it would silently break user-visible
      // functionality without breaking the build — the assertion here is
      // the only thing catching that.
      const flow = generateMaestroFlow('demo', ['local-ai'])
      expect(flow).toContain('"AI Assistant"')
      expect(flow).toContain('id: "load-ai-btn"')
      expect(flow).toContain('id: "ai-device-switch"')
    })

    it('omits AI section entirely when local-ai is not in features', () => {
      // The bare variant has no AI UI at all — asserting on it would
      // produce a confusing "view not found" Maestro failure.
      const flow = generateMaestroFlow('demo', [])
      expect(flow).not.toContain('"AI Assistant"')
      expect(flow).not.toContain('load-ai-btn')
      expect(flow).not.toContain('ai-device-switch')
    })
  })

  describe('simulator mode (real, no QVAC_MOCK) — AI wiring smoke', () => {
    // Context: an earlier iteration tried a full CPU-inference test on
    // the simulator. The 2026-05-21 verification run showed Maestro's
    // tap on Load Assistant doesn't reliably propagate to RN onPress
    // there. We deliberately do NOT tap Load on the simulator now —
    // real inference is verified in --device mode. The simulator flow
    // proves the AI section + toggle render and that no BareKit/
    // TurboModule red-box surfaces at launch.
    it('toggles to CPU and asserts "Device: CPU" is visible', () => {
      const flow = generateMaestroFlow('demo', ['local-ai'])
      const sectionStart = flow.indexOf('# --- Simulator AI wiring smoke')
      expect(sectionStart).toBeGreaterThan(0)
      const switchTapIdx = flow.indexOf('id: "ai-device-switch"', sectionStart)
      const deviceCpuIdx = flow.indexOf('"Device: CPU"', switchTapIdx)
      expect(switchTapIdx).toBeGreaterThan(0)
      expect(deviceCpuIdx).toBeGreaterThan(switchTapIdx)
    })

    it('asserts NO TurboModule/BareKit red-box (the original user pain point)', () => {
      // This is the original failure mode that motivated the whole AI
      // testing effort: missing react-native-bare-kit linkage produces
      // [Invariant Violation: TurboModuleRegistry.getEnforcing(...):
      // 'BareKit' could not be found.] at launch.
      const flow = generateMaestroFlow('demo', ['local-ai'])
      expect(flow).toContain('assertNotVisible: "TurboModuleRegistry"')
      expect(flow).toContain('assertNotVisible: "BareKit"')
    })

    it('does NOT tap Load Assistant on the simulator (Maestro tap unreliable there)', () => {
      // The 2026-05-21 verification run showed the tap on load-ai-btn
      // reported COMPLETED in Maestro but never reached RN's onPress.
      // No download started, no JS logs, button stayed visible past
      // 5min. Removing the tap (rather than papering over with a
      // longer timeout) keeps the simulator test fast and deterministic.
      const flow = generateMaestroFlow('demo', ['local-ai'])
      const sectionStart = flow.indexOf('# --- Simulator AI wiring smoke')
      const sectionEnd = flow.indexOf('# --- Relaunch', sectionStart)
      const section = flow.slice(sectionStart, sectionEnd)
      // load-ai-btn is asserted visible higher up, but never tapped
      // inside the AI wiring smoke section.
      expect(section).not.toContain('tapOn:\n    id: "load-ai-btn"')
      expect(section).not.toContain('id: "chat-input"')
      expect(section).not.toContain('id: "chat-send-btn"')
    })

    it('does NOT include the mocked chat round-trip when qvacMock is false', () => {
      // The mocked path uses "Mock:.*" assertion text — it would always
      // fail in real mode (the real model never says "Mock:").
      const flow = generateMaestroFlow('demo', ['local-ai'], {
        mode: 'simulator',
        qvacMock: false,
      })
      expect(flow).not.toContain('Mock:.*')
      expect(flow).not.toContain('# --- QVAC_MOCK=1')
    })
  })

  describe('simulator mode with qvacMock', () => {
    it('exercises the mocked chat round-trip (load → input → send → assert Mock:)', () => {
      // QVAC_MOCK=1 paves over the SDK with a deterministic echo, so the
      // test can assert exact reply content without flakiness. This is
      // useful for CI smoke tests where real model loading isn't
      // possible.
      const flow = generateMaestroFlow('demo', ['local-ai'], {
        mode: 'simulator',
        qvacMock: true,
      })
      expect(flow).toContain('# --- QVAC_MOCK=1: exercise the full chat flow')
      expect(flow).toContain('id: "chat-input"')
      expect(flow).toContain('id: "chat-send-btn"')
      expect(flow).toContain('"Mock:.*"')
    })

    it('does NOT include the BareKit/TurboModule guards in mock mode', () => {
      // In mock mode we never actually invoke the QVAC SDK, so those
      // guards would just be dead weight. Keeping them out makes the
      // mock path strictly faster.
      const flow = generateMaestroFlow('demo', ['local-ai'], {
        mode: 'simulator',
        qvacMock: true,
      })
      expect(flow).not.toContain('TurboModuleRegistry')
      expect(flow).not.toContain('BareKit')
    })
  })

  describe('device mode (full real-load + chat on iPhone)', () => {
    it('exercises the full flow: load → wait for chat-input → send message → wait for reply', () => {
      const flow = generateMaestroFlow('demo', ['local-ai'], { mode: 'device' })
      expect(flow).toContain('# --- Device mode: real model download + load + chat')
      expect(flow).toContain('id: "load-ai-btn"')
      expect(flow).toContain('id: "chat-input"')
      expect(flow).toContain('id: "chat-send-btn"')
      expect(flow).toContain('Say hi in one word.')
      // Waits for the assistant reply bubble (only mounts when real
      // streamed content arrives — empty placeholders are filtered).
      expect(flow).toContain('id: "chat-bubble-assistant"')
    })

    it('uses a 5-minute timeout for chat-input (covers cold model download)', () => {
      // Qwen3-0.6B-Q4 is ~400MB. On a typical 5G phone connection
      // download takes 30-60s; on hotel/conference wifi, several minutes.
      // We don't want false failures so the budget is generous.
      const flow = generateMaestroFlow('demo', ['local-ai'], { mode: 'device' })
      expect(flow).toMatch(/visible:\s*\n\s*id: "chat-input"\s*\n\s*timeout: 300000/)
    })

    it('skips the relaunch step (would force another cold load)', () => {
      // The simulator flow re-launches the app at the end to verify
      // state restores. In device mode the model is loaded into memory
      // and re-launching forces another ~5min cold load with no added
      // signal. Skipping it keeps device runs sub-7min.
      const flow = generateMaestroFlow('demo', ['local-ai'], { mode: 'device' })
      expect(flow).not.toContain('# --- Relaunch to verify state restores cleanly')
      expect(flow).not.toContain('- stopApp')
    })

    it('still includes BareKit/TurboModule guards as a defensive backstop', () => {
      // These should never trip on a real device (BareKit IS linked into
      // the dev build), but if they ever do, that's a critical native-
      // module regression we want surfaced loudly.
      const flow = generateMaestroFlow('demo', ['local-ai'], { mode: 'device' })
      expect(flow).toContain('assertNotVisible: "TurboModuleRegistry"')
      expect(flow).toContain('assertNotVisible: "BareKit"')
    })
  })

  describe('relaunch step', () => {
    it('is included in simulator mode (state-restore smoke)', () => {
      const flow = generateMaestroFlow('demo', ['local-ai'])
      expect(flow).toContain('# --- Relaunch to verify state restores cleanly')
      expect(flow).toContain('- stopApp')
      expect(flow).toContain('- launchApp')
    })

    it('handles the bare variant (no AI section) without crashing', () => {
      const flow = generateMaestroFlow('demo', [])
      expect(flow).toContain('appId: com.unstoppable.demo')
      expect(flow).toContain('"P2P Network"')
      expect(flow).toContain('"KV Storage"')
      // No AI section
      expect(flow).not.toContain('"AI Assistant"')
    })
  })
})
