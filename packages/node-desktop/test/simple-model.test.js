import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simpleHomeModel } from '../app/simple-model.js'

const key = 'a'.repeat(64)
const copy = { owner: key, protection: { mode: 'mirror', state: 'protected', caughtUpAt: '2026-10-20T12:00:00Z' } }
function snapshot(resources = [copy], overrides = {}) {
  return { peers: [{ publicKey: key, appName: 'Notebook', online: false, grantsGiven: { sync: ['manifest.replace'] } }], cores: resources, ...overrides }
}

test('loading and empty Home never claim data has been copied', () => {
  assert.match(simpleHomeModel(null).title, /Checking/)
  assert.match(simpleHomeModel({ peers: [] }).title, /home for/)
  assert.equal(simpleHomeModel(snapshot([])).apps[0].state, 'empty')
})

test('an offline app can retain its verified copy, with a real verification time', () => {
  const model = simpleHomeModel(snapshot())
  assert.equal(model.apps[0].state, 'copied')
  assert.match(model.apps[0].detail, /not connected.*still available/)
  assert.equal(model.apps[0].copiedAt, Date.parse('2026-10-20T12:00:00Z'))
  assert.equal(model.apps[0].canShare, true)
  assert.equal(model.apps[0].aiGranted, false)
})

test('a mix of verified and paused resources must not claim the whole app is copied', () => {
  const model = simpleHomeModel(snapshot([copy, { ...copy, paused: true }]))
  assert.equal(model.apps[0].state, 'paused')
  assert.equal(model.apps[0].title, 'Some copying is paused')
  assert.notEqual(model.title, 'Your shared data is copied here')
})

test('partial, metadata-only and failed copies have distinct explanations', () => {
  for (const [protection, state, phrase] of [
    [{ mode: 'mirror', state: 'pending' }, 'waiting', /Open the app/],
    [{ mode: 'metadata-only', state: 'metadata-only' }, 'waiting', /not requested a full copy/],
    [{ mode: 'mirror', state: 'error' }, 'attention', /check the problem/]
  ]) {
    const app = simpleHomeModel(snapshot([{ owner: key, protection }])).apps[0]
    assert.equal(app.state, state)
    assert.match(app.detail, phrase)
    assert.equal(app.copiedAt, null)
  }
})

test('quota problems take priority and distinguish the computer limit', () => {
  const storage = { quotas: { global: { exceeded: true }, perPeer: { [key]: { exceeded: true } } } }
  const model = simpleHomeModel(snapshot([copy], { storage }))
  assert.equal(model.apps[0].state, 'attention')
  assert.match(model.apps[0].detail, /total storage limit/)
  assert.equal(model.needsAttention, true)
})

test('missing verification times are not invented', () => {
  const model = simpleHomeModel(snapshot([{ ...copy, protection: { mode: 'mirror', state: 'protected' } }]))
  assert.equal(model.apps[0].copiedAt, null)
})
