import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sanitizeLaunchArgs, validateRendererCommand } from '../electron/command-policy.js'

describe('Electron renderer command policy', () => {
  it('accepts and clones supported daemon commands', () => {
    const message = { type: 'pause-peer', publicKey: 'a'.repeat(64) }
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

describe('renderer commands match the allowlist', () => {
  // A command the renderer sends that the main process does not allow is
  // dropped silently — the button just does nothing. Assert the two agree.
  it('accepts every command the dashboard can build', async () => {
    const { commands } = await import('../app/render.js')
    const built = [
      commands.unpair('a'.repeat(64), 'Notes'),
      commands.pausePeer('a'.repeat(64)),
      commands.resumePeer('a'.repeat(64)),
      commands.setPeerQuota('a'.repeat(64), 1024),
      commands.setPeerGrant('a'.repeat(64), 'ai', []),
      commands.promoteTrust('a'.repeat(64), 'Notes'),
      commands.createInvite({ expiresIn: 900000, uses: 1 }),
      commands.revokeInvite('i1')
    ]
    for (const message of built) {
      assert.doesNotThrow(
        () => validateRendererCommand(message),
        `renderer builds "${message.type}" but the main process rejects it`
      )
    }
  })

  it('still rejects a command the dashboard cannot build', () => {
    assert.throws(() => validateRendererCommand({ type: 'pause-app', appId: 'notes' }), /not allowed/)
  })
})
