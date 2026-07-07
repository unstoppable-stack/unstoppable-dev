import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'fs/promises'

describe('memory desktop package structure', () => {
  it('ships an index.html that loads the renderer', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
    assert.match(html, /id="app"/)
    assert.match(html, /app\/index\.js/)
  })

  it('uses pear-run to spawn the worker from the renderer bridge', async () => {
    const bridge = await readFile(new URL('../app/bridge.js', import.meta.url), 'utf8')
    assert.match(bridge, /pear-run/)
    assert.match(bridge, /worker\.js/)
  })
})
