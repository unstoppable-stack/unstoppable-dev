import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PortableAbortController } from '../src/abort.js'

// The fallback exists because Bare has no AbortController global — found by
// the headless smoke test, where the daemon runs under Bare and the first
// capability call crashed with `AbortController is not defined`. These tests
// exercise the fallback directly, since under Node the platform class wins.
describe('portable abort controller', () => {
  it('starts unaborted and aborts once', () => {
    const controller = new PortableAbortController()
    assert.equal(controller.signal.aborted, false)
    controller.abort()
    assert.equal(controller.signal.aborted, true)
    controller.abort() // second call is a no-op, no throw
  })

  it('notifies listeners, honouring once', () => {
    const controller = new PortableAbortController()
    let calls = 0
    controller.signal.addEventListener('abort', () => calls++, { once: true })
    controller.abort()
    controller.abort()
    assert.equal(calls, 1)
  })

  it('calls a listener added after abort immediately', () => {
    const controller = new PortableAbortController()
    controller.abort()
    let called = false
    controller.signal.addEventListener('abort', () => { called = true }, { once: true })
    assert.equal(called, true)
  })

  it('supports removeEventListener', () => {
    const controller = new PortableAbortController()
    let called = false
    const listener = () => { called = true }
    controller.signal.addEventListener('abort', listener)
    controller.signal.removeEventListener('abort', listener)
    controller.abort()
    assert.equal(called, false)
  })

  it('throwIfAborted throws the reason', () => {
    const controller = new PortableAbortController()
    controller.signal.throwIfAborted()
    controller.abort(new Error('cancelled by test'))
    assert.throws(() => controller.signal.throwIfAborted(), /cancelled by test/)
  })
})
