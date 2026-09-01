import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { ApprovedPathPolicy } from '../electron/path-policy.js'

describe('Electron settings path policy', () => {
  it('accepts only paths selected for the matching operation', () => {
    const policy = new ApprovedPathPolicy()
    const exportPath = policy.approve('./settings.uns', 'export')

    assert.equal(
      policy.authorizeCommand({ type: 'export-state', path: './settings.uns' }).path,
      resolve(exportPath)
    )
    assert.throws(
      () => policy.authorizeCommand({ type: 'export-state', path: './settings.uns' }),
      /system file dialog/
    )

    policy.approve('./incoming.uns', 'import')
    assert.throws(
      () => policy.authorizeCommand({ type: 'export-state', path: './incoming.uns' }),
      /system file dialog/
    )
  })

  it('allows preview then consumes import approval on confirmation', () => {
    const policy = new ApprovedPathPolicy()
    policy.approve('./incoming.uns', 'import')
    assert.doesNotThrow(() => policy.authorizeCommand({ type: 'preview-import', path: './incoming.uns' }))
    assert.doesNotThrow(() => policy.authorizeCommand({ type: 'import-state', path: './incoming.uns' }))
    assert.throws(
      () => policy.authorizeCommand({ type: 'import-state', path: './incoming.uns' }),
      /system file dialog/
    )
  })

  it('expires approvals', () => {
    let now = 100
    const policy = new ApprovedPathPolicy({ ttlMs: 10, now: () => now })
    policy.approve('./settings.uns', 'export')
    now = 111
    assert.throws(
      () => policy.authorizeCommand({ type: 'export-state', path: './settings.uns' }),
      /system file dialog/
    )
  })
})
