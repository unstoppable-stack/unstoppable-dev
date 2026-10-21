import { test } from 'node:test'
import assert from 'node:assert/strict'
import { savedDataHtml } from '../app/saved-data.js'

test('saved records render readable nested values and escape app content', () => {
  const html = savedDataHtml({ entries: [{ key: 'report', value: { items: [{ title: '<script>bad</script>', excerpt: 'A useful note' }] } }], more: true }, 'core')
  assert.match(html, /A useful note/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /limited preview/)
})

test('unavailable and unsupported data are not presented as empty collections', () => {
  assert.match(savedDataHtml(null, 'core'), /not available/)
  assert.match(savedDataHtml({ blocks: [] }, 'core'), /cannot be previewed/)
  assert.match(savedDataHtml({ entries: [] }, 'core'), /No items saved/)
  assert.match(savedDataHtml({ error: 'Copy incomplete' }, 'core'), /Copy incomplete/)
})

test('notes and reports are cards without metadata or storage keys', () => {
  const html = savedDataHtml({ entries: [
    { key: 'internal-storage-key', value: { id: 'private-id', schemaVersion: 1, title: 'My note', body: 'Full note text' } },
    { key: 'report', value: { schemaVersion: 1, source: { key: 'private-source-key' }, items: [{ id: 'private-item-id', title: 'My note', excerpt: 'Short text' }] } },
    { key: 'source', value: { publicKey: 'private-peer-key', descriptor: {} } },
  ] }, 'core')
  assert.match(html, /saved-note/)
  assert.match(html, /saved-report/)
  assert.match(html, /Full note text/)
  assert.match(html, /Short text/)
  assert.match(html, /Report · 1 note/)
  assert.doesNotMatch(html, /private-|internal-storage-key|schemaVersion|publicKey|<details/)
})

test('generic nested records hide technical fields and empty reports remain understandable', () => {
  const html = savedDataHtml({ entries: [{ key: 'opaque-key', value: { label: 'Visible', nested: { source_key: 'hidden-source', itemId: 'hidden-id', text: 'Readable' } } }] }, 'core')
  assert.match(html, /Readable/)
  assert.doesNotMatch(html, /hidden-|opaque-key/)
  assert.match(savedDataHtml({ entries: [{ key: 'report', value: { items: [] } }] }, 'core'), /No notes in this report yet/)
})
