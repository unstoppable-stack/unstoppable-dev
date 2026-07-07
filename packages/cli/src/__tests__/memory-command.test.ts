import { describe, it, expect } from 'vitest'
import { STATE_DIR, PID_FILE, LOG_FILE, META_FILE, buildMcpConfig, isAlive } from '../commands/memory.js'

describe('us memory — state paths are derived from $HOME', () => {
  it('STATE_DIR sits inside the user home', () => {
    expect(STATE_DIR).toMatch(/\.unstoppable[/\\]memory$/)
  })

  it('pid, log, and meta files live in STATE_DIR', () => {
    expect(PID_FILE.startsWith(STATE_DIR)).toBe(true)
    expect(LOG_FILE.startsWith(STATE_DIR)).toBe(true)
    expect(META_FILE.startsWith(STATE_DIR)).toBe(true)
  })
})

describe('us memory — MCP config', () => {
  it('builds a Cursor-compatible local MCP config', () => {
    expect(buildMcpConfig({ port: 8787 })).toEqual({
      mcpServers: {
        'unstoppable-memory': {
          url: 'http://127.0.0.1:8787/mcp'
        }
      }
    })
  })
})

describe('us memory — pid liveness', () => {
  it('treats invalid pids as not alive', () => {
    expect(isAlive(0)).toBe(false)
    expect(isAlive(-1)).toBe(false)
    expect(isAlive(NaN)).toBe(false)
  })
})
