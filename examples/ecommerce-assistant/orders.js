import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

export function orderReference(value) {
  if (typeof value?.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(value.id)) {
    throw new Error('Use an order reference of 1–80 letters, numbers or hyphens')
  }
  return { id: value.id }
}

// Allowlist the receipt shape before it crosses the wire. Never expose raw DB
// entries or let the caller select arbitrary keys such as the private _cart.
export function orderReceipt(value) {
  if (value === null) return null
  const id = orderReference(value).id
  if (!Array.isArray(value.items) || value.items.length > 6 ||
      value.currency !== 'USD' || !Number.isSafeInteger(value.total) || value.total < 0 ||
      value.status !== 'demo — no payment or fulfillment' ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new Error('Invalid demo receipt')
  }
  const items = value.items.map(item => {
    if (typeof item.productId !== 'string' || typeof item.name !== 'string' ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
        !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 ||
        !Number.isSafeInteger(item.subtotal) || item.subtotal !== item.quantity * item.unitPrice) {
      throw new Error('Invalid receipt item')
    }
    return { productId: item.productId, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal }
  })
  if (items.reduce((sum, item) => sum + item.subtotal, 0) !== value.total) throw new Error('Invalid receipt total')
  return { id, items, total: value.total, currency: 'USD', status: value.status, createdAt: value.createdAt }
}

export function createOrdersCapability(readOrder) {
  return defineCapability({
    name: 'orders', version: 1, defaultGrants: [],
    methods: {
      get: procedure.input(orderReference).output(orderReceipt).query(({ input }) => readOrder(input.id)),
    },
  })
}

export const ordersContract = createOrdersCapability().contract
