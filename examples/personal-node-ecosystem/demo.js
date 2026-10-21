import { runScenario } from './scenario.js'

try {
  await runScenario(console.log)
  console.log('PASS — real local replication and RPC; no AI model or Electron UI exercised.')
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
