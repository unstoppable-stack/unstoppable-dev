---
id: wdk
name: WDK Wallet
category: module
requires: []
tags: [wallet, payments, crypto]
priority: medium
---

# WDK Wallet (Tether WDK)

## Overview
WDK is Tether's open-source wallet toolkit for building secure, self-custodial, multi-chain wallets across Node.js, Bare, and React Native. It provides a core SDK plus chain-specific wallet modules (EVM, BTC, TRON, etc.) and optional UI kits.

## Version Notes
- WDK package versions not found in local sources; verify against docs or the target app `package.json`.
- npm registry check failed (`@tetherto/wdk` not in public npm); likely hosted on GitHub Packages.

## Installation
```bash
npm install @tetherto/wdk @tetherto/wdk-wallet-evm @tetherto/wdk-wallet-tron @tetherto/wdk-wallet-btc
```

## Quick Start
```js
import WDK from "@tetherto/wdk"
import WalletManagerEvm from "@tetherto/wdk-wallet-evm"

const seedPhrase = WDK.getRandomSeedPhrase()
const wdk = new WDK(seedPhrase).registerWallet("ethereum", WalletManagerEvm, {
  provider: "https://eth.drpc.org"
})

const account = await wdk.getAccount("ethereum", 0)
console.log(await account.getAddress())
```

## Core Concepts
- Seed phrases (BIP-39) generate keys for all chains from a single mnemonic.
- Wallet modules: chain-specific adapters registered with the core WDK instance.
- Account abstraction: optional ERC-4337 and gasless modules for sponsored fees.

## Testing & Sandbox
- Prefer testnets (e.g., Sepolia for EVM) and public faucets for initial flows.
- Some chains require provider, indexer, or paymaster API keys; document required keys per chain.
- Validate addresses and fee quotes in a dry-run UI before broadcasting.

## Supported Chains
- Confirm from docs for the latest list; commonly referenced modules include EVM, BTC, and TRON.

## API Reference
- `WDK.getRandomSeedPhrase()`
- `new WDK(seedPhrase)`
- `wdk.registerWallet(chainId, WalletManager, config)`
- `wdk.getAccount(chainId, index)`
- `account.getAddress()` / `account.getBalance()` / `account.sendTransaction()`

## Integration with Other Modules
- Bare: WDK can run in Bare runtime (Node.js & Bare quickstart).
- Expo/React Native: `@tetherto/wdk-react-native-provider` + `react-native-bare-kit`.
- Pear: run WDK in a Pear terminal engine and expose RPC to a UI.

## Common Patterns
```js
// Multi-chain registration
const wdk = new WDK(seedPhrase)
  .registerWallet("ethereum", WalletManagerEvm, { provider: "https://eth.drpc.org" })
  .registerWallet("tron", WalletManagerTron, { provider: "https://api.trongrid.io" })
```

```js
// Estimate fees before sending
const quote = await account.quoteSendTransaction({ to, value })
```

## Pitfalls & Gotchas
- Some chains require API keys (indexer, bundler, paymaster, or Tron APIs).
- Configure Android minSdkVersion 29+ for React Native (required by bare kit).
- Store mnemonics securely; use platform keychains or WDK secret manager.
- Use testnets (e.g., Sepolia) and faucets for safe testing.

## Resources
- https://docs.wallet.tether.io/
- https://docs.wallet.tether.io/start-building/nodejs-bare-quickstart
- https://docs.wallet.tether.io/start-building/react-native-quickstart
- https://github.com/tetherto/wdk-core
