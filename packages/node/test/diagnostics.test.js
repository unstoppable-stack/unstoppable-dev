import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PersonalNode } from '../src/personal-node.js'

test('forwarded remote diagnostics remain safe and observable without an application error listener', () => {
  // No startup or filesystem mutation is needed to exercise the forwarding bus.
  const host = new PersonalNode('/unused-diagnostic-test')
  const diagnostic = { type: 'message', error: 'Malformed peer input' }
  assert.doesNotThrow(() => host.node.emit('error', diagnostic))
  let observed
  host.on('error', value => { observed = value })
  host.node.emit('error', diagnostic)
  assert.equal(observed, diagnostic)
})
