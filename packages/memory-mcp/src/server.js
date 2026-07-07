import http from 'node:http'
import { MemoryEngine } from '@unstoppable/memory'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8787

const TOOL_DEFINITIONS = [
  {
    name: 'memory',
    description: 'Save or forget information in Unstoppable Memory.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The memory text to save or forget.' },
        action: { type: 'string', enum: ['save', 'forget'], default: 'save' },
        containerTag: { type: 'string', description: 'Optional project/container scope.' }
      },
      required: ['content']
    }
  },
  {
    name: 'recall',
    description: 'Search memories and optionally include profile context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query.' },
        containerTag: { type: 'string', description: 'Optional project/container scope.' },
        includeProfile: { type: 'boolean', default: true }
      },
      required: ['query']
    }
  },
  {
    name: 'whoAmI',
    description: 'Get local Unstoppable Memory identity and session information.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'listProjects',
    description: 'List available memory projects/container tags.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]

export async function startMemoryMcpServer ({ storagePath, host = DEFAULT_HOST, port = DEFAULT_PORT, engine } = {}) {
  const memory = engine || new MemoryEngine(storagePath)
  if (!engine) await memory.ready()

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return sendJson(res, 200, { ok: true, name: 'unstoppable-memory-mcp' })
      }
      if (req.method !== 'POST' || req.url !== '/mcp') {
        return sendJson(res, 404, { error: 'not found' })
      }

      const body = await readBody(req)
      const rpc = JSON.parse(body || '{}')
      const result = await handleRpc(memory, rpc)
      sendJson(res, 200, result)
    } catch (err) {
      sendJson(res, 200, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: err.message || String(err) }
      })
    }
  })

  await new Promise((resolve) => server.listen(port, host, resolve))
  const address = server.address()
  const actualPort = typeof address === 'object' ? address.port : port
  return {
    url: `http://${host}:${actualPort}`,
    engine: memory,
    async close () {
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
      if (!engine) await memory.close()
    }
  }
}

async function handleRpc (engine, rpc) {
  const id = rpc.id ?? null
  try {
    switch (rpc.method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'unstoppable-memory', version: '0.1.0' },
          capabilities: { tools: {}, resources: {}, prompts: {} }
        })
      case 'tools/list':
        return ok(id, { tools: TOOL_DEFINITIONS })
      case 'tools/call':
        return ok(id, await callTool(engine, rpc.params || {}))
      case 'resources/list':
        return ok(id, {
          resources: [
            { uri: 'unstoppable-memory://profile', name: 'User Profile', mimeType: 'text/plain' },
            { uri: 'unstoppable-memory://projects', name: 'Projects', mimeType: 'application/json' }
          ]
        })
      case 'resources/read':
        return ok(id, await readResource(engine, rpc.params || {}))
      case 'prompts/list':
        return ok(id, {
          prompts: [{ name: 'context', description: 'Profile and memory instructions for system context injection.' }]
        })
      case 'prompts/get':
        return ok(id, await getPrompt(engine, rpc.params || {}))
      default:
        return error(id, -32601, `Unknown method: ${rpc.method}`)
    }
  } catch (err) {
    return error(id, -32000, err.message || String(err))
  }
}

async function callTool (engine, { name, arguments: args = {} }) {
  switch (name) {
    case 'memory':
      return handleMemory(engine, args)
    case 'recall':
      return handleRecall(engine, args)
    case 'whoAmI':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            userId: 'local',
            email: null,
            name: 'Local User',
            client: 'unstoppable-memory-mcp',
            sessionId: 'local-session'
          })
        }]
      }
    case 'listProjects': {
      const projects = await engine.listProjects()
      return {
        content: [{
          type: 'text',
          text: projects.length > 0
            ? `Available projects:\n${projects.map((p) => `- ${p}`).join('\n')}`
            : 'No projects found. Memories will use the default project.'
        }]
      }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function handleMemory (engine, args) {
  const { content, action = 'save', containerTag } = args
  if (action === 'forget') {
    const result = await engine.forget({ content, containerTag })
    return {
      content: [{
        type: 'text',
        text: result.forgotten ? `Forgot memory (${result.id})` : result.message
      }]
    }
  }

  const result = await engine.add({ content, containerTag, metadata: { sm_source: 'mcp' } })
  return {
    content: [{
      type: 'text',
      text: `Saved memory (id: ${result.memories[0].id}) in ${result.memories[0].containerTag} project`
    }]
  }
}

async function handleRecall (engine, args) {
  const { query, includeProfile = true, containerTag } = args
  if (includeProfile) {
    const result = await engine.profile({ containerTag, query })
    const parts = []
    appendProfile(parts, result.profile)
    appendSearchResults(parts, result.searchResults?.results || [])
    return { content: [{ type: 'text', text: parts.length > 0 ? parts.join('\n') : 'No memories or profile found.' }] }
  }

  const result = await engine.search({ query, containerTag, searchMode: 'hybrid' })
  const parts = []
  appendSearchResults(parts, result.results)
  return { content: [{ type: 'text', text: parts.length > 0 ? parts.join('\n') : 'No memories found.' }] }
}

async function readResource (engine, params) {
  if (params.uri === 'unstoppable-memory://profile') {
    const result = await engine.profile({ containerTag: params.arguments?.containerTag })
    const parts = ['# User Profile\n']
    appendProfile(parts, result.profile, { stableTitle: 'Stable Preferences', recentTitle: 'Recent Activity' })
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'text/plain',
        text: parts.length > 1 ? parts.join('\n') : 'No profile yet. Start saving memories.'
      }]
    }
  }
  if (params.uri === 'unstoppable-memory://projects') {
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'application/json',
        text: JSON.stringify({ projects: await engine.listProjects() }, null, 2)
      }]
    }
  }
  throw new Error(`Unknown resource: ${params.uri}`)
}

async function getPrompt (engine, params) {
  if (params.name !== 'context') throw new Error(`Unknown prompt: ${params.name}`)
  const result = await engine.profile({ containerTag: params.arguments?.containerTag })
  const parts = [
    '**Important:** Whenever the user shares informative facts, preferences, personal details, or any memory-worthy information, use the `memory` tool to save it to Unstoppable Memory.',
    ''
  ]
  appendProfile(parts, result.profile)
  if (parts.length === 2) parts.push('No user profile available yet. Start saving memories to build context.')
  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text: parts.join('\n') }
    }]
  }
}

function appendProfile (parts, profile, titles = {}) {
  const stableTitle = titles.stableTitle || 'Stable facts'
  const recentTitle = titles.recentTitle || 'Recent context'
  if (profile.static.length > 0 || profile.dynamic.length > 0) parts.push('## User Profile')
  if (profile.static.length > 0) {
    parts.push(`**${stableTitle}:**`)
    for (const fact of profile.static) parts.push(`- ${fact}`)
  }
  if (profile.dynamic.length > 0) {
    parts.push(`\n**${recentTitle}:**`)
    for (const fact of profile.dynamic) parts.push(`- ${fact}`)
  }
}

function appendSearchResults (parts, results) {
  if (results.length === 0) return
  parts.push('\n## Relevant Memories')
  for (const [index, result] of results.entries()) {
    const text = result.memory || result.chunk || ''
    parts.push(`\n### Memory ${index + 1} (${Math.round(result.similarity * 100)}% match)`)
    parts.push(text)
  }
}

function ok (id, result) {
  return { jsonrpc: '2.0', id, result }
}

function error (id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function sendJson (res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readBody (req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}
