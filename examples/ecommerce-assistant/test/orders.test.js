import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cartSummary } from '../catalog.js'
import { createOrdersCapability } from '../orders.js'

test('order RPC rejects private storage keys before reading and strips non-receipt data', async () => {
  const reads = []
  const receipt = {
    ...cartSummary([{ productId: 'daypack', quantity: 1 }]),
    id: 'order-001', createdAt: '2026-10-16T12:00:00.000Z',
    status: 'demo — no payment or fulfillment', privateCustomerNote: 'must stay local',
  }
  receipt.items[0].privateCost = 100
  const orders = createOrdersCapability(async id => { reads.push(id); return id === receipt.id ? receipt : null })
  await assert.rejects(orders.methods.get({ id: '_cart' }), { code: 'INVALID_INPUT' })
  await assert.rejects(orders.methods.get({ id: 'x'.repeat(81) }), { code: 'INVALID_INPUT' })
  assert.deepEqual(reads, [])
  const result = await orders.methods.get({ id: 'order-001' })
  assert.equal(result.total, 6800)
  assert.equal('privateCustomerNote' in result, false)
  assert.equal('privateCost' in result.items[0], false)
  assert.equal(await orders.methods.get({ id: 'missing' }), null)
  assert.deepEqual(orders.defaultGrants, [])
  assert.deepEqual(Object.keys(orders.methods), ['get'])
})

test('order RPC refuses malformed stored receipts instead of returning arbitrary records', async () => {
  const orders = createOrdersCapability(async () => ({ id: 'order-001', secret: 'local only' }))
  await assert.rejects(orders.methods.get({ id: 'order-001' }), { code: 'INVALID_OUTPUT' })
})
