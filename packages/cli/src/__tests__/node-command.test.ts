import { describe, it, expect } from 'vitest'
import { isAlive, STATE_DIR, PID_FILE, LOG_FILE, META_FILE } from '../commands/node.js'

describe('us node — pid liveness', () => {
  it('treats invalid pids as not alive', () => {
    expect(isAlive(0)).toBe(false)
    expect(isAlive(-1)).toBe(false)
    expect(isAlive(NaN)).toBe(false)
    expect(isAlive(1.5)).toBe(false)
  })

  it('reports the current process as alive (signal 0 round-trip)', () => {
    expect(isAlive(process.pid)).toBe(true)
  })

  it('reports a fabricated unused-looking pid as not alive', () => {
    // PID 999999 is well above any realistic kernel max; if it is taken,
    // this assertion will flake, but in practice that's wildly improbable.
    expect(isAlive(999_999)).toBe(false)
  })
})

describe('us node — state paths are derived from $HOME', () => {
  it('STATE_DIR sits inside the user home', () => {
    expect(STATE_DIR).toMatch(/\.unstoppable[/\\]node$/)
  })
  it('pid, log, and meta files live in STATE_DIR', () => {
    expect(PID_FILE.startsWith(STATE_DIR)).toBe(true)
    expect(LOG_FILE.startsWith(STATE_DIR)).toBe(true)
    expect(META_FILE.startsWith(STATE_DIR)).toBe(true)
  })
})
