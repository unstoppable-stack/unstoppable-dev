// Discovery runs independently of local storage. A failed network must never
// prevent opening an app or reading the data already on disk.
export function dataNetwork (swarm, topic, { retryMs = 2000, maxRetryMs = 30000 } = {}) {
  const discovery = swarm.join(topic)
  let closed = false, announced = false, timer, closing, delay = retryMs
  const waits = new Set()

  function status () {
    return { closed, announced, connections: swarm.connections.size, dhtPeers: swarm.dht.toArray().length }
  }
  function timeoutError (operation) {
    const network = status()
    const error = new Error(network.dhtPeers === 0
      ? `${operation}: no DHT nodes are reachable. Check internet access, VPN/firewall UDP rules and the configured bootstrap servers.`
      : network.connections === 0
        ? `${operation}: DHT is reachable but no data peer connected. Check the shared dataset key, keep the other app running, and check both networks allow peer connections.`
        : `${operation}: connected, but the requested data or writer permission has not arrived. Check the writer version or founder approval.`)
    error.code = 'DATA_NETWORK_TIMEOUT'
    error.network = network
    return error
  }
  async function refresh (first = false) {
    try {
      const success = await (first ? discovery.flushed() : discovery.refresh())
      if (!closed && success && swarm.dht.toArray().length > 0) {
        announced = true
        for (const resolve of waits) resolve()
      }
    } catch { /* Retry connectivity; local data remains usable. */ }
    if (closed) return
    timer = setTimeout(() => {
      if (swarm.connections.size > 0) { delay = retryMs; scheduleConnected() }
      else { void refresh() }
    }, delay)
    timer.unref?.()
    delay = Math.min(delay * 2, maxRetryMs)
  }
  function scheduleConnected () {
    if (closed) return
    timer = setTimeout(() => {
      if (swarm.connections.size > 0) scheduleConnected()
      else void refresh()
    }, retryMs)
    timer.unref?.()
  }
  void refresh(true)

  return {
    status,
    timeoutError,
    ready ({ timeoutMs = 60000, signal } = {}) {
      if (closed) return Promise.reject(new Error('Data network is closed'))
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) return Promise.reject(new TypeError('timeoutMs must be between 0 and 120000'))
      if (signal?.aborted) return Promise.reject(signal.reason || new Error('Network wait aborted'))
      if (announced) return Promise.resolve()
      return new Promise((resolve, reject) => {
        const finish = error => {
          clearTimeout(deadline)
          waits.delete(finish)
          signal?.removeEventListener('abort', onAbort)
          if (error) reject(error); else resolve()
        }
        const onAbort = () => finish(signal.reason || new Error('Network wait aborted'))
        const deadline = setTimeout(() => finish(timeoutError('Discovery timed out')), timeoutMs)
        waits.add(finish)
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    },
    close () {
      if (closing) return closing
      closed = true
      clearTimeout(timer)
      for (const finish of waits) finish(new Error('Data network is closed'))
      closing = discovery.destroy()
      return closing
    }
  }
}
