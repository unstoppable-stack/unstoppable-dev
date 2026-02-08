# Wallet Integration — Full Example

```js
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const seedPhrase = WDK.getRandomSeedPhrase()
const wdk = new WDK(seedPhrase)
  .registerWallet('ethereum', WalletManagerEvm, {
    provider: 'https://eth.drpc.org'
  })

const account = await wdk.getAccount('ethereum', 0)
const address = await account.getAddress()
console.log('address:', address)

const balance = await account.getBalance()
console.log('balance:', balance.toString())

// Send a transaction
// const tx = await account.sendTransaction({ to: address, value: 1000000000000000000n })
// console.log(tx.hash)
```

## Variations

- Register multiple wallet modules (BTC, TRON, Solana) on the same seed phrase
- Use ERC-4337 modules for gasless flows
- Combine with P2P for decentralized payment channels
