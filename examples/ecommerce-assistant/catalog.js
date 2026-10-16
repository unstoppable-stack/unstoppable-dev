// App-owned catalog shared by the renderer and worker. Prices are integer cents.
export const products = [
  { id: 'daypack', name: 'Everyday Daypack', category: 'Carry', price: 6800, symbol: '🎒', description: 'A compact 18 L pack with a padded laptop sleeve.' },
  { id: 'tote', name: 'Canvas Tote', category: 'Carry', price: 2400, symbol: '👜', description: 'A reusable cotton tote for everyday essentials.' },
  { id: 'bottle', name: 'Trail Bottle', category: 'Essentials', price: 2800, symbol: '🧴', description: 'A 750 ml insulated stainless steel bottle.' },
  { id: 'notebook', name: 'Field Notebook', category: 'Essentials', price: 1200, symbol: '📓', description: 'A pocket notebook with 160 dotted pages.' },
  { id: 'lamp', name: 'Desk Lamp', category: 'Home', price: 4600, symbol: '💡', description: 'An adjustable reading lamp with warm light.' },
  { id: 'headphones', name: 'Studio Headphones', category: 'Tech', price: 8900, symbol: '🎧', description: 'Wired over-ear headphones with a detachable cable.' },
]

export const money = cents => '$' + (cents / 100).toFixed(2)

export function cartSummary(cart) {
  if (!Array.isArray(cart) || cart.length > products.length) throw new Error('Invalid cart')
  const seen = new Set()
  const items = cart.map(({ productId, quantity }) => {
    const product = products.find(item => item.id === productId)
    if (!product || seen.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error('Choose a catalog product and a quantity between 1 and 99')
    }
    seen.add(productId)
    return { productId, name: product.name, quantity, unitPrice: product.price, subtotal: product.price * quantity }
  })
  return { items, total: items.reduce((sum, item) => sum + item.subtotal, 0), currency: 'USD' }
}

export const shoppingPrompt = 'You are the shopping assistant for Local Goods, a demo store. Recommend only these catalog products: ' +
  products.map(p => `${p.name}: ${money(p.price)}. ${p.description}`).join(' ') +
  ' Prices are USD demo prices. Do not invent discounts, availability, shipping, or payment services. You cannot modify the cart or place orders; direct users to the cart controls. Checkout saves a local demo order only, with no payment or fulfillment.'
