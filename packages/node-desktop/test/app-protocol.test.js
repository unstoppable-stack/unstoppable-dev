import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { join, resolve } from 'node:path'
import { APP_ENTRY_URL, resolveAppRequest } from '../electron/app-protocol.js'

// resolveAppRequest returns a native filesystem path, so the expectation has
// to be built the same way: on Windows the root resolves to a drive letter
// and the separators are backslashes. Hard-coding a POSIX string made this
// test Windows-only-broken, which went unnoticed while the suite could not
// run there at all.
const packageRoot = resolve('/opt/personal-node')

describe('Electron application protocol', () => {
  it('resolves same-origin application assets inside the package root', () => {
    assert.equal(APP_ENTRY_URL, 'unstoppable-node://app/index.html')
    assert.equal(
      resolveAppRequest('unstoppable-node://app/app/index.js', packageRoot),
      join(packageRoot, 'app', 'index.js')
    )
  })

  it('rejects foreign origins and path traversal', () => {
    assert.throws(
      () => resolveAppRequest('https://example.com/index.js', packageRoot),
      /Untrusted/
    )
    assert.throws(
      () => resolveAppRequest('unstoppable-node://other/index.js', packageRoot),
      /Untrusted/
    )
    assert.throws(
      () => resolveAppRequest('unstoppable-node://app/%2e%2e/secret', packageRoot),
      /escapes/
    )
    assert.throws(
      () => resolveAppRequest('unstoppable-node://app/%00', packageRoot),
      /Invalid/
    )
  })
})
