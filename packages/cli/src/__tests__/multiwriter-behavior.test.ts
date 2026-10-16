import { describe, expect, it } from 'vitest'
import b4a from 'b4a'
import { multiWriterStoreSource } from '../generators/common.js'

// Execute the actual generated reducer with a small view, so these tests check
// malicious immutable operations and winner semantics rather than source text.
const source = multiWriterStoreSource('./schema', false)
const reducer = source.slice(source.indexOf('async function apply('), source.indexOf('export async function createStore'))
const apply = new Function('b4a', `const decode = buf => JSON.parse(b4a.toString(buf)); ${reducer}; return apply`)(b4a)
const owner = Buffer.alloc(32, 1)
const writer = Buffer.alloc(32, 2)
const third = Buffer.alloc(32, 3)
const op = (value: unknown, key = writer, length = 1) => ({ key, length, value: Buffer.from(JSON.stringify({ version: 1, ...value as object })) })
function fixture () {
  const rows = new Map<string, any>()
  const additions: string[] = []
  const removals: string[] = []
  const view = { db: { async insert(_collection: string, doc: any) { rows.set(doc.key, doc) }, async flush() {} } }
  const host = { key: owner, async addWriter(key: Buffer, options: any) { additions.push(key.toString('hex')); expect(options.isIndexer).toBe(false) }, async removeWriter(key: Buffer) { removals.push(key.toString('hex')) } }
  return { rows, additions, removals, view, host }
}

describe('generated multiwriter reducer', () => {
  it('replays valid unversioned history and legacy tombstones alongside new operations', async () => {
    const f = fixture()
    const legacy = (value: unknown, key = writer) => ({ key, length: 1, value: Buffer.from(JSON.stringify(value)) })
    await apply([
      legacy({ type: 'upsert', doc: { key: 'kept', value: '"old"', authorId: 'untrusted', updatedAt: 123 } }),
      legacy({ type: 'upsert', doc: { key: 'removed', value: '"old"', deletedAt: 123 } }),
      legacy({ type: 'add-writer', key: third.toString('hex') }, owner),
      legacy({ type: 'add-writer', key: '04'.repeat(32) }),
      op({ type: 'upsert', doc: { key: 'new', value: '"current"' } })
    ], f.view, f.host)
    expect(f.rows.get('kept').value).toBe('"old"')
    expect(f.rows.get('kept').authorId).toBe(writer.toString('hex'))
    expect(f.rows.get('removed').deletedAt).toBe(1)
    expect(f.rows.get('new').value).toBe('"current"')
    expect(f.additions).toEqual([third.toString('hex')])
  })

  it('allows only the founding writer to manage membership', async () => {
    const f = fixture()
    await apply([op({ type: 'add-writer', key: third.toString('hex') }), op({ type: 'add-writer', key: third.toString('hex') }, owner)], f.view, f.host)
    expect(f.additions).toEqual([third.toString('hex')])
    await apply([op({ type: 'remove-writer', key: third.toString('hex') }), op({ type: 'remove-writer', key: owner.toString('hex') }, owner), op({ type: 'remove-writer', key: third.toString('hex') }, owner)], f.view, f.host)
    expect(f.removals).toEqual([third.toString('hex')])
  })

  it('ignores malformed log entries and attributes writes to authenticated writers', async () => {
    const f = fixture()
    await apply([{ key: writer, value: Buffer.from('{') }, op({ type: 'upsert', doc: { key: 'bad', value: 'invalid json' } }), op({ type: 'upsert', doc: { key: 'ok', value: '"valid"', authorId: 'forged' } })], f.view, f.host)
    expect([...f.rows.keys()]).toEqual(['ok'])
    expect(f.rows.get('ok').authorId).toBe(writer.toString('hex'))
  })

  it('uses deterministic log order despite skewed clocks and deletes without reading stale state', async () => {
    const f = fixture()
    await apply([op({ type: 'upsert', doc: { key: 'item', value: '"future"', updatedAt: Number.MAX_SAFE_INTEGER } }), op({ type: 'upsert', doc: { key: 'item', value: '"later"', updatedAt: 1 } }, third, 2)], f.view, f.host)
    expect(f.rows.get('item').value).toBe('"later"')
    await apply([op({ type: 'delete', doc: { key: 'item' } }, writer, 3)], f.view, f.host)
    expect(f.rows.get('item').deletedAt).toBe(1)
  })
})
