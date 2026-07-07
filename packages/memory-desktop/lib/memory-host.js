import { MemoryEngine } from '@unstoppable/memory'
import { connectMemoryToNode } from '@unstoppable/memory-client'
import { startMemoryMcpServer } from '@unstoppable/memory-mcp/server'

const STATUS_INTERVAL_MS = 2_000

export function createMemoryHost ({
  storagePath,
  send,
  mcpPort = 8787,
  nodeSync = true,
  connectToNode,
  engine = null
} = {}) {
  if (!storagePath) throw new Error('createMemoryHost requires storagePath')
  if (typeof send !== 'function') throw new Error('createMemoryHost requires send(msg)')

  const memory = engine || new MemoryEngine(storagePath)
  let mcp = null
  let statusTimer = null
  const sync = {
    status: nodeSync ? 'searching' : 'disabled',
    detail: nodeSync ? 'Looking for local Unstoppable Node' : 'Node sync disabled for this session'
  }
  let nodeClient = null

  async function start () {
    send({ type: 'workerReady' })
    if (!engine) await memory.ready()
    mcp = await startMemoryMcpServer({ storagePath, port: mcpPort, engine: memory })
    if (nodeSync) await connectNodeSync()
    send({ type: 'ready', storagePath, mcp: mcpSnapshot(), sync: { ...sync } })
    await publishStatus()
    statusTimer = setInterval(() => {
      publishStatus().catch((err) => send({ type: 'error', phase: 'status', error: err.message }))
    }, STATUS_INTERVAL_MS)
  }

  async function connectNodeSync () {
    sync.status = 'searching'
    sync.detail = 'Looking for local Unstoppable Node'
    try {
      nodeClient = await connectMemoryToNode({
        engine: memory,
        connectToNode,
        required: false,
        reconnect: true
      })
      if (nodeClient) {
        sync.status = 'connected'
        sync.detail = 'Memory Hyperbee registered with Unstoppable Node'
      } else {
        sync.status = 'unavailable'
        sync.detail = 'Unstoppable Node is not running; memory remains local'
      }
    } catch (err) {
      sync.status = 'error'
      sync.detail = err.message || String(err)
    }
    send({ type: 'sync', ...sync })
  }

  async function handleCommand (msg = {}) {
    switch (msg.type) {
      case 'memory-save': {
        const result = await memory.add({
          content: msg.content,
          containerTag: msg.containerTag,
          customId: msg.customId,
          metadata: { source: 'desktop', ...(msg.metadata || {}) }
        })
        send({ type: 'memorySaved', result })
        await publishStatus()
        break
      }
      case 'memory-search': {
        const results = await memory.search({
          query: msg.query,
          containerTag: msg.containerTag,
          searchMode: msg.searchMode || 'memories',
          limit: msg.limit || 10
        })
        send({ type: 'searchResult', results })
        break
      }
      case 'profile': {
        const result = await memory.profile({ containerTag: msg.containerTag, query: msg.query })
        send({ type: 'profile', ...result })
        break
      }
      case 'projects': {
        send({ type: 'projects', projects: await memory.listProjects() })
        break
      }
      case 'mcp-config': {
        send({ type: 'mcpConfig', client: msg.client || 'cursor', config: buildMcpConfig() })
        break
      }
      case 'refresh-status':
        await publishStatus()
        break
      case 'shutdown':
        await cleanup()
        break
      default:
        send({ type: 'error', phase: 'command', error: `Unknown command: ${msg.type}` })
    }
  }

  async function publishStatus () {
    const [projects, registration] = await Promise.all([
      memory.listProjects(),
      memory.getNodeRegistration()
    ])
    send({
      type: 'status',
      storagePath,
      projects,
      registration,
      mcp: mcpSnapshot(),
      sync: { ...sync }
    })
  }

  function buildMcpConfig () {
    return {
      mcpServers: {
        'unstoppable-memory': {
          url: `${mcpSnapshot().url}/mcp`
        }
      }
    }
  }

  function mcpSnapshot () {
    return { url: mcp?.url || null }
  }

  async function cleanup () {
    if (statusTimer) {
      clearInterval(statusTimer)
      statusTimer = null
    }
    if (mcp) {
      await mcp.close()
      mcp = null
    }
    if (nodeClient && typeof nodeClient.close === 'function') {
      await nodeClient.close()
      nodeClient = null
    }
    if (!engine) await memory.close()
  }

  return { engine: memory, start, handleCommand, cleanup, get sync () { return { ...sync } } }
}
