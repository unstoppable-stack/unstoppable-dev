/* global Pear */
// Worker for the Unstoppable Node dashboard.
//
// This is the *real* node daemon, just embedded inside a Pear Desktop app so
// the user gets a visual dashboard alongside the P2P runtime. The worker
// process lives in Bare; NodeDaemon happens to run fine there because:
//   1. protocol.js lazily loads `os` (Bare has no `os` module by default)
//   2. ai-provider.js only imports `@qvac/sdk` dynamically when --ai is on
//   3. Hyperswarm/Corestore/Hyperdrive are all Bare-native
//
// Communication with the renderer uses the standard Pear worker pipe with
// newline-delimited JSON. We don't hand-roll request/response framing for
// this dashboard because all messages are either status snapshots (node →
// UI) or simple commands (UI → node: unpair, toggle-ai).

import pearPipe from 'pear-pipe'
import { runDaemonWorker } from './lib/run-daemon-worker.js'

// `pear-pipe` is the post-deprecation replacement for `Pear.worker.pipe()`.
// Same underlying fd-3 duplex; importing directly avoids the deprecation
// warnings and won't break when Pear removes the legacy accessor.
const pipe = pearPipe()
const storagePath = Pear.config.storage

runDaemonWorker({
  pipe,
  storagePath,
  args: Pear.config.args || [],
  exit: () => Pear.exit()
})
