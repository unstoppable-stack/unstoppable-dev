import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APP_ENTRY_URL, resolveAppRequest } from '../electron/app-protocol.js'

describe('Electron application protocol', () => {
  it('resolves same-origin application assets inside the package root', () => {
    assert.equal(APP_ENTRY_URL, 'unstoppable-node://app/index.html')
    assert.equal(
      resolveAppRequest('unstoppable-node://app/app/index.js', '/opt/personal-node'),
      '/opt/personal-node/app/index.js'
    )
  })

  it('rejects foreign origins and path traversal', () => {
    assert.throws(
      () => resolveAppRequest('https://example.com/index.js', '/opt/personal-node'),
      /Untrusted/
    )
    assert.throws(
      () => resolveAppRequest('unstoppable-node://other/index.js', '/opt/personal-node'),
      /Untrusted/
    )
    assert.throws(
      () => resolveAppRequest('unstoppable-node://app/%2e%2e/secret', '/opt/personal-node'),
      /escapes/
    )
    assert.throws(
      () => resolveAppRequest('unstoppable-node://app/%00', '/opt/personal-node'),
      /Invalid/
    )
  })
})
