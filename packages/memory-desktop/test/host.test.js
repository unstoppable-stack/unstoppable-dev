import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createMemoryHost } from '../lib/memory-host.js'

describe('memory desktop host', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'unstoppable-memory-desktop-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('starts the engine and publishes ready/status messages', async () => {
    const messages = []
    const host = createMemoryHost({ storagePath: dir, mcpPort: 0, send: (msg) => messages.push(msg), nodeSync: false })

    await host.start()
    await host.cleanup()

    assert.equal(messages[0].type, 'workerReady')
    assert.equal(messages[1].type, 'ready')
    assert.equal(messages[1].sync.status, 'disabled')
    assert.ok(messages.some((msg) => msg.type === 'status' && msg.mcp.url.startsWith('http://127.0.0.1:')))
  })

  it('handles save, search, profile, projects, and MCP config commands', async () => {
    const messages = []
    const host = createMemoryHost({ storagePath: dir, mcpPort: 0, send: (msg) => messages.push(msg), nodeSync: false })
    await host.start()

    await host.handleCommand({
      type: 'memory-save',
      content: 'The desktop companion shows MCP setup snippets.',
      containerTag: 'project:desktop'
    })
    await host.handleCommand({
      type: 'memory-search',
      query: 'MCP setup',
      containerTag: 'project:desktop'
    })
    await host.handleCommand({ type: 'profile', containerTag: 'project:desktop' })
    await host.handleCommand({ type: 'projects' })
    await host.handleCommand({ type: 'mcp-config', client: 'cursor' })
    await host.cleanup()

    assert.ok(messages.some((msg) => msg.type === 'memorySaved'))
    assert.ok(messages.some((msg) => msg.type === 'searchResult' && msg.results.total === 1))
    assert.ok(messages.some((msg) => msg.type === 'profile' && msg.profile.dynamic.length === 1))
    assert.ok(messages.some((msg) => msg.type === 'projects' && msg.projects.includes('project:desktop')))
    assert.ok(messages.some((msg) => msg.type === 'mcpConfig' && msg.config.mcpServers['unstoppable-memory']))
  })

  it('reports connected sync when the memory feed registers with Node', async () => {
    const messages = []
    const host = createMemoryHost({
      storagePath: dir,
      mcpPort: 0,
      send: (msg) => messages.push(msg),
      connectToNode: async () => ({ services: { data: true }, close: async () => {} })
    })

    await host.start()
    await host.cleanup()

    assert.ok(messages.some((msg) => msg.type === 'sync' && msg.status === 'connected'))
    assert.ok(messages.some((msg) => msg.type === 'status' && msg.sync.status === 'connected'))
  })
})
