---
name: add-wallet
description: Add crypto wallet and payment capabilities using Tether WDK.
  Use when the user needs send/receive payments, balance queries, or
  transaction history in their app.
---

# Wallet Integration

## When to Use
- User wants to add crypto payments or wallet functionality
- User mentions "wallet", "payment", "bitcoin", "ethereum", or "token"
- User needs self-custodial wallet capabilities

## Prerequisites
- WDK core and at least one chain wallet module installed

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add @tetherto/wdk @tetherto/wdk-wallet-evm
   ```

2. **Create wallet module** in `src/wallet/index.ts`:
   - Initialize WDK with seed phrase
   - Register chain-specific wallet modules
   - Derive accounts and get addresses

3. **Add transaction capabilities**:
   - Get balance, send transactions
   - Handle chain-specific configuration

4. **Secure the seed phrase** — store in OS keychain, never in plain text files

## Quick Implementation

```ts
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const seedPhrase = WDK.getRandomSeedPhrase()
const wdk = new WDK(seedPhrase)
  .registerWallet('ethereum', WalletManagerEvm, { provider: 'https://eth.drpc.org' })

const account = await wdk.getAccount('ethereum', 0)
const address = await account.getAddress()
console.log('address:', address)
```

## Key Gotchas
- NEVER store seed phrases in code, .env files, or replicated data
- Use OS keychain or secure storage for seed persistence
- Confirm correct network/provider URL before transactions
- Check chain-specific API keys or paymaster settings

## Deep Dive
- Full example with transactions: read `resources/full-example.md`
