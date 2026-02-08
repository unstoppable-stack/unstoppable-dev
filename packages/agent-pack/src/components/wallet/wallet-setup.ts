/**
 * Wallet Setup — Initialize WDK wallet with chain registration.
 *
 * Handles: seed generation, chain registration, account management.
 *
 * IMPORTANT: Store mnemonics securely — use platform keychains in production.
 *
 * CUSTOMIZE: Register the chains your app needs and set provider URLs.
 */

import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

export interface WalletSetupOptions {
  /** Existing seed phrase. If not provided, generates a new one. */
  seedPhrase?: string
  /** EVM provider URL. Default: Sepolia testnet */
  evmProvider?: string
}

/**
 * Create and configure a WDK wallet instance.
 *
 * Usage:
 *   const { wdk, seedPhrase } = createWallet()
 *   const account = await wdk.getAccount('ethereum', 0)
 *   console.log(await account.getAddress())
 */
export function createWallet(opts: WalletSetupOptions = {}): {
  wdk: any
  seedPhrase: string
} {
  const seedPhrase = opts.seedPhrase ?? WDK.getRandomSeedPhrase()

  const wdk = new WDK(seedPhrase)
    .registerWallet('ethereum', WalletManagerEvm, {
      provider: opts.evmProvider ?? 'https://rpc.sepolia.org',
    })

  // CUSTOMIZE: Register additional chains as needed:
  // .registerWallet('tron', WalletManagerTron, { provider: 'https://api.trongrid.io' })
  // .registerWallet('btc', WalletManagerBtc, { ... })

  return { wdk, seedPhrase }
}

/**
 * Get an account address for a chain.
 */
export async function getAddress(
  wdk: any,
  chain: string = 'ethereum',
  index: number = 0
): Promise<string> {
  const account = await wdk.getAccount(chain, index)
  return account.getAddress()
}

/**
 * Get balance for an account.
 */
export async function getBalance(
  wdk: any,
  chain: string = 'ethereum',
  index: number = 0
): Promise<any> {
  const account = await wdk.getAccount(chain, index)
  return account.getBalance()
}

/**
 * Estimate fees before sending a transaction.
 * Always show the user a fee quote before broadcasting.
 */
export async function quoteSend(
  wdk: any,
  chain: string,
  index: number,
  to: string,
  value: string
): Promise<any> {
  const account = await wdk.getAccount(chain, index)
  return account.quoteSendTransaction({ to, value })
}
