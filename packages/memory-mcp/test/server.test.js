import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { startMemoryMcpServer } from '../src/server.js'

describe('Unstoppable Memory MCP server', () => {
  let dir
  let server

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'unstoppable-memory-mcp-'))
    server = await startMemoryMcpServer({ storagePath: dir, port: 0 })
  })

  afterEach(async () => {
    await server.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('lists the memory, recall, whoAmI, and listProjects tools', async () => {
    const response = await rpc(server.url, 'tools/list')

    assert.deepEqual(response.result.tools.map((t) => t.name), [
      'memory',
      'recall',
      'whoAmI',
      'listProjects'
    ])
    assert.equal(response.result.tools[0].inputSchema.type, 'object')
    assert.ok(response.result.tools[0].inputSchema.properties.content)
  })

  it('saves and recalls memory through tool calls', async () => {
    const saved = await rpc(server.url, 'tools/call', {
      name: 'memory',
      arguments: {
        content: 'The user prefers local-first sync.',
        containerTag: 'project:memory'
      }
    })

    assert.match(saved.result.content[0].text, /Saved memory/)

    const recalled = await rpc(server.url, 'tools/call', {
      name: 'recall',
      arguments: {
        query: 'sync preference',
        containerTag: 'project:memory',
        includeProfile: true
      }
    })

    assert.match(recalled.result.content[0].text, /Relevant Memories/)
    assert.match(recalled.result.content[0].text, /local-first sync/)
  })

  it('returns profile and projects resources', async () => {
    await rpc(server.url, 'tools/call', {
      name: 'memory',
      arguments: {
        content: 'Simon is testing the MCP resource surface.',
        containerTag: 'project:mcp'
      }
    })

    const profile = await rpc(server.url, 'resources/read', {
      uri: 'unstoppable-memory://profile',
      arguments: { containerTag: 'project:mcp' }
    })
    const projects = await rpc(server.url, 'resources/read', {
      uri: 'unstoppable-memory://projects'
    })

    assert.match(profile.result.contents[0].text, /Recent Activity/)
    assert.deepEqual(JSON.parse(projects.result.contents[0].text).projects, ['project:mcp'])
  })

  it('formats the context prompt with save-memory instructions', async () => {
    const result = await rpc(server.url, 'prompts/get', {
      name: 'context',
      arguments: { containerTag: 'default' }
    })

    assert.match(result.result.messages[0].content.text, /use the `memory` tool/)
  })
})

async function rpc (baseUrl, method, params = {}) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params })
  })
  assert.equal(response.status, 200)
  return response.json()
}
