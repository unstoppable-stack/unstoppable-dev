import { test } from 'node:test'
import assert from 'node:assert/strict'
import { environment } from './helpers.mjs'

test('local originals survive restart; scoped sync exchanges copies and fresh revisions without forwarding other devices', async () => {
  const env = await environment()
  try {
    let left = await env.open('left')
    let right = await env.open('right')
    const leftNote = await left.save({
      title: 'Coffee with Maya',
      text: 'Bring the prototype on Tuesday.',
    })
    const rightNote = await right.save({
      title: 'Garden ideas',
      text: 'Rosemary by the kitchen window.',
    })
    await assert.rejects(left.save({ text: '   ' }), /Write a note/)
    const ownKey = left.state().publicKey
    await env.close(left)
    left = await env.open('left')
    assert.equal(left.state().publicKey, ownKey)
    assert.equal(left.state().notes[0].text, leftNote.text)
    const invitation = await right.invite()
    await left.pair(invitation.code)
    assert.equal(left.state().notes.length, 2)
    assert.equal(right.state().notes.length, 2)
    assert.equal(
      left.state().notes.find((note) => note.id === rightNote.id).local,
      false,
    )
    await assert.rejects(
      left.save({ id: rightNote.id, text: 'Changing another device' }),
      /Only notes written/,
    )
    const peer = left.node.peer(right.state().publicKey)
    await assert.rejects(peer.call('notebook', 'delete', {}), {
      code: 'NOT_GRANTED',
    })
    await assert.rejects(
      peer.call('notebook', 'exchange', {
        schemaVersion: 1,
        revision: 3,
        notes: [{ text: 'bad' }],
      }),
      { code: 'INVALID_INPUT' },
    )
    const update = await left.save({
      id: leftNote.id,
      title: leftNote.title,
      text: 'Bring the updated prototype on Wednesday.',
    })
    assert.equal(update.createdAt, leftNote.createdAt)
    await right.sync()
    assert.equal(
      right.state().notes.find((note) => note.id === leftNote.id).text,
      update.text,
    )
    assert(right.state().peers[0].checkedAt)
    const third = await env.open('third')
    const thirdInvite = await third.invite()
    await left.pair(thirdInvite.code)
    assert.equal(
      third.state().notes.length,
      1,
      'other devices’ received notes must not be forwarded',
    )
    assert.equal(third.state().notes[0].id, leftNote.id)
    const stranger = await env.open('stranger')
    await assert.rejects(
      stranger.node.connect(right.state().publicKey, { timeout: 3000 }),
      { code: 'PAIR_DENIED' },
    )
    await assert.rejects(stranger.pair(invitation.code), /invite|denied|pair/i)
    await env.close(left)
    await env.close(third)
    const rightIdentity = right.state().publicKey
    await env.close(right)
    right = await env.open('right')
    assert.equal(right.state().publicKey, rightIdentity)
    assert.equal(
      right.state().notes.find((note) => note.id === leftNote.id).text,
      update.text,
    )
    assert.equal(
      right.state().peers.length,
      1,
      'remembered pairing survives restart',
    )
    left = await env.open('left')
    const fresh = await left.save({
      text: 'Both apps reopened; reverse-direction connection.',
    })
    await right.sync()
    assert(
      right.state().notes.some((note) => note.id === fresh.id),
      'inviter can reconnect to the remembered invitation redeemer',
    )
  } finally {
    await env.cleanup()
  }
})

test('one idempotent sync recovers after a real transport loss; cancellation preserves cached notes and reconnect uses saved identity', async () => {
  const env = await environment()
  try {
    const left = await env.open('left')
    let drop = false,
      fresh,
      right
    right = await env.open('right', () => {
      if (drop && right.state().notes.some((note) => note.id === fresh.id)) {
        drop = false
        right.node
          .peer(left.state().publicKey)
          ?.close()
          .catch(() => {})
      }
    })
    await left.save({ text: 'First original' })
    await right.save({ text: 'Other original' })
    await left.pair((await right.invite()).code)
    fresh = await left.save({
      title: 'New while connected',
      text: 'A unique new note after pairing.',
    })
    drop = true // Lose the real transport after the receiver durably accepts it.
    await left.sync()
    assert.equal(drop, false)
    assert.equal(
      right.state().notes.filter((note) => note.id === fresh.id).length,
      1,
    )
    await env.close(right)
    const pending = left.sync()
    const cancel = setTimeout(() => left.cancel(), 100)
    await assert.rejects(pending, /cancel/i)
    clearTimeout(cancel)
    assert(
      left.state().notes.some((note) => note.text === 'Other original'),
      'received copies remain readable',
    )
    right = await env.open('right')
    const final = await right.save({ text: 'Saved after remote restart' })
    await left.sync()
    assert(
      left.state().notes.some((note) => note.id === final.id),
      'fresh content arrives without a new invitation',
    )
    assert.equal(left.state().peers.length, 1)
  } finally {
    await env.cleanup()
  }
})
