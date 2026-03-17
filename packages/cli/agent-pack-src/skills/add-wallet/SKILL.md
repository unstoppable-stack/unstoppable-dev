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
   npm i @tetherto/wdk @tetherto/wdk-wallet-evm
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

## Critical Rules
- **NEVER log or print seed phrases** — not to console, not to files, not to replicated data. A leaked seed means total loss of funds.
- **Always verify transaction details before signing** — confirm recipient address, amount, and network. There is no undo for on-chain transactions.
- **Handle network errors gracefully** — provider URLs go down, RPC calls timeout. Wrap all chain interactions in try/catch with retries and user feedback.
- **WDK SDK maturity is limited** — expect rough edges, missing documentation, and API changes. Pin your WDK version and test thoroughly before upgrading.
- **Never hardcode provider URLs in production** — use configuration or environment variables. Public RPC endpoints have rate limits.
- **Store seed phrases in OS keychain or secure storage** — never in `.env`, `localStorage`, config files, or any replicated data structure.

## Validation
1. WDK initializes without errors (`new WDK(seedPhrase)` succeeds)
2. Wallet module registers for the target chain (`.registerWallet()` doesn't throw)
3. Account derivation returns a valid address (`getAccount()` + `getAddress()`)
4. Balance query returns a number (even if 0 on testnet)
5. Transaction signing completes without error (test on testnet first)
6. Seed phrase is not present in any log output, config file, or version-controlled file

## Deep Dive
- Full example with transactions: read `resources/full-example.md`
