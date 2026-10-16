import { runDaemonWorker } from '../../lib/run-daemon-worker.js'

const [storagePath, rawArgs] = Bare.argv.slice(2)
const [bootstrap] = JSON.parse(rawArgs)
runDaemonWorker({
  pipe: Bare.IPC,
  storagePath,
  nodeOptions: { swarm: { bootstrap: JSON.parse(bootstrap) } },
  exit: () => Bare.exit()
})
