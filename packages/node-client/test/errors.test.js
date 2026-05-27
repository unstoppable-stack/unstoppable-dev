import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  NodeClientError,
  NodeNotFoundError,
  NodeDeniedError,
  NodeMissingServiceError,
  InvalidOptionError,
  ClientClosedError,
  InferenceError,
  connectToNode
} from '../src/index.js'

describe('typed errors', () => {
  it('all error classes extend NodeClientError', () => {
    assert.ok(new NodeNotFoundError() instanceof NodeClientError)
    assert.ok(new NodeDeniedError('x') instanceof NodeClientError)
    assert.ok(new NodeMissingServiceError(['ai'], {}) instanceof NodeClientError)
    assert.ok(new InvalidOptionError('x') instanceof NodeClientError)
    assert.ok(new ClientClosedError() instanceof NodeClientError)
    assert.ok(new InferenceError('x') instanceof NodeClientError)
  })

  it('each error has a stable code', () => {
    assert.equal(new NodeNotFoundError().code, 'NODE_NOT_FOUND')
    assert.equal(new NodeDeniedError('r').code, 'NODE_DENIED')
    assert.equal(new NodeMissingServiceError(['ai'], {}).code, 'NODE_MISSING_SERVICE')
    assert.equal(new InvalidOptionError('').code, 'INVALID_OPTION')
    assert.equal(new ClientClosedError().code, 'CLOSED')
    assert.equal(new InferenceError('').code, 'INFERENCE_ERROR')
  })

  it('NodeDeniedError preserves reason', () => {
    const err = new NodeDeniedError('quota-exceeded')
    assert.equal(err.reason, 'quota-exceeded')
    assert.match(err.message, /quota-exceeded/)
  })

  it('NodeMissingServiceError preserves missing[] and advertised services', () => {
    const err = new NodeMissingServiceError(['ai', 'files'], { data: true })
    assert.deepEqual(err.missing, ['ai', 'files'])
    assert.deepEqual(err.services, { data: true })
  })

  it('connectToNode throws InvalidOptionError synchronously for an unknown service', async () => {
    await assert.rejects(
      () => connectToNode({ appId: 'a', appName: 'A', requireServices: ['bogus'] }),
      (err) => err.code === 'INVALID_OPTION' && err instanceof NodeClientError
    )
  })
})
