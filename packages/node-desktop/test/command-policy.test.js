import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sanitizeLaunchArgs, validateRendererCommand } from '../electron/command-policy.js'

describe('Electron renderer command policy', () => {
  it('accepts and clones supported daemon commands', () => {
    const message = { type: 'pause-app', appId: 'notes' }
    const validated = validateRendererCommand(message)
    assert.deepEqual(validated, message)
    assert.notEqual(validated, message)
  })

  it('rejects unknown, inherited, and oversized commands', () => {
    assert.throws(() => validateRendererCommand({ type: 'open-shell' }), /not allowed/)
    assert.throws(() => validateRendererCommand(Object.create({ type: 'shutdown' })), /plain object/)
    assert.throws(
      () => validateRendererCommand({ type: 'update-config', value: 'x'.repeat(70_000) }),
      /exceeds/
    )
  })

  it('only forwards supported daemon launch flags', () => {
    assert.deepEqual(
      sanitizeLaunchArgs(['electron', '--inspect', '--ai', '--ai-model', 'local.gguf', '--unsafe']),
      ['--ai', '--ai-model', 'local.gguf']
    )
  })
})
