import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cartSummary } from '../catalog.js'

test('checkout derives totals from catalog prices, ignoring supplied prices', () => {
  const order = cartSummary([{ productId: 'daypack', quantity: 1, price: 1 }, { productId: 'notebook', quantity: 2 }])
  assert.equal(order.total, 9200)
  assert.equal(order.currency, 'USD')
  assert.equal(order.items[0].unitPrice, 6800)
  assert.equal(cartSummary([]).total, 0)
})

test('rejects unknown, duplicate and invalid cart quantities', () => {
  for (const cart of [null, [{ productId: 'missing', quantity: 1 }], ...[0, -1, 1.5, 100, '2', NaN].map(quantity => [{ productId: 'tote', quantity }]), [{ productId: 'tote', quantity: 1 }, { productId: 'tote', quantity: 2 }]]) {
    assert.throws(() => cartSummary(cart))
  }
})
