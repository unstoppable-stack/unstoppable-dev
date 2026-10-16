import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const output = execFileSync(process.env.BARE_BIN || 'bare', [fileURLToPath(new URL('./smoke-bare.mjs', import.meta.url))], {
  // The embedded bare-sidecar executable expects a live IPC descriptor at 3.
  stdio: ['inherit', 'pipe', 'inherit', process.platform === 'win32' ? 'overlapped' : 'pipe'], encoding: 'utf8', timeout: 30_000,
})
process.stdout.write(output)
if (!output.includes('P2P Bare smoke passed')) throw new Error('Bare exited without completing the smoke')
