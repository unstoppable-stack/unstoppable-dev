import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runScenario } from '../scenario.js'

test('real paired peers converge offline edits after restart and observe writer removal', async () => {
  const result = await runScenario()
  assert.equal(result.receipt, 'local-applied')
  assert.equal(result.alice, 'Written offline by Alice')
  assert.equal(result.bob, 'Written offline by Bob')
  assert.ok(['Alice revision', 'Bob revision'].includes(result.shared.text))
  assert.equal(result.bobWritable, false)
})
