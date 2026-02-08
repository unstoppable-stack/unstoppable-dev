/**
 * Unstoppable App - Entry Point
 *
 * This is a Pear desktop app built on the Unstoppable Stack.
 * https://unstoppable.dev
 */

import { App } from './app/index.js'

async function main() {
  console.log('Starting Unstoppable App...')

  const app = new App()
  await app.start()

  console.log('App started successfully!')
}

main().catch((err) => {
  console.error('Failed to start app:', err)
  process.exit(1)
})
