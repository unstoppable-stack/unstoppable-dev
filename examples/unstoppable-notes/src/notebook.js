import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
import { createNode, AbortControllerImpl } from '@unstoppable-stack/p2p'
import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

const { join } =
  typeof Bare === 'undefined'
    ? await import('node:path')
    : await import('bare-path')

const GRANTS = { notebook: ['exchange'] }
const MAX_NOTES = 100
const MAX_BYTES = 240 * 1024

// A notebook has exactly one writer. Exchanged snapshots contain originals only;
// received copies and device identities never get forwarded to a third device.
export function parseSnapshot(value) {
  if (
    value?.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !Array.isArray(value.notes) ||
    value.notes.length > MAX_NOTES
  )
    throw new Error('Invalid notebook snapshot')
  const ids = new Set()
  const notes = value.notes
    .map((note) => {
      if (
        !note ||
        !/^[a-f0-9]{32}$/.test(note.id) ||
        ids.has(note.id) ||
        typeof note.title !== 'string' ||
        !note.title.trim() ||
        note.title.length > 120 ||
        typeof note.text !== 'string' ||
        !note.text.trim() ||
        note.text.length > 10000 ||
        ![note.createdAt, note.updatedAt].every(
          (time) =>
            typeof time === 'string' &&
            time.length <= 40 &&
            Number.isFinite(Date.parse(time)),
        )
      ) {
        throw new Error(
          'Invalid note: expected a title, text and valid timestamps',
        )
      }
      ids.add(note.id)
      return {
        id: note.id,
        title: note.title,
        text: note.text,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
  const snapshot = { schemaVersion: 1, revision: value.revision, notes }
  if (b4a.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_BYTES)
    throw new Error('Notebook exceeds the example’s 240 KB sharing limit')
  return snapshot
}

export async function openNotebook({ directory, swarm, onChange = () => {} }) {
  const store = new Corestore(join(directory, 'local-data'))
  const db = new Hyperbee(store.get({ name: 'notebook-v1' }), {
    keyEncoding: 'utf-8',
    valueEncoding: 'json',
  })
  const received = new Map()
  let node,
    local,
    active,
    closed = false,
    queue = Promise.resolve(),
    lastNetworkError = null,
    invitationId
  const emit = () => {
    if (!closed) onChange()
  }
  // The queue covers only durable local mutations; it never holds a network wait.
  const mutate = (task) => {
    const work = queue.then(task)
    queue = work.catch(() => {})
    return work
  }
  const check = (signal) => {
    if (signal?.aborted) throw signal.reason || new Error('Operation cancelled')
    if (closed) throw new Error('Notebook is closed')
  }
  async function accept(owner, snapshot, signal) {
    snapshot = parseSnapshot(snapshot)
    if (!/^[a-f0-9]{64}$/.test(owner))
      throw new Error('Invalid device identity')
    return mutate(async () => {
      check(signal)
      const previous = received.get(owner)
      if (previous?.snapshot.revision > snapshot.revision) return
      if (
        previous?.snapshot.revision === snapshot.revision &&
        JSON.stringify(previous.snapshot) !== JSON.stringify(snapshot)
      ) {
        throw new Error(
          'Device changed a notebook without advancing its revision',
        )
      }
      const entry = { snapshot, checkedAt: new Date().toISOString() }
      await db.put(`received/${owner}`, entry)
      received.set(owner, entry)
      emit()
    })
  }
  const capability = defineCapability({
    name: 'notebook',
    version: 1,
    defaultGrants: [],
    methods: {
      exchange: procedure
        .input(parseSnapshot)
        .mutation(async ({ input, peer, signal }) => {
          // Transport identity owns the incoming snapshot; the payload cannot name
          // another device. Repeating the same revision is explicitly idempotent.
          await accept(peer.remotePublicKey, input, signal)
          check(signal)
          return { receivedRevision: input.revision, snapshot: local }
        }),
    },
  })
  try {
    await db.ready()
    local = parseSnapshot(
      (await db.get('local', { wait: false }))?.value || {
        schemaVersion: 1,
        revision: 0,
        notes: [],
      },
    )
    for await (const entry of db.createReadStream({
      gte: 'received/',
      lt: 'received0',
      wait: false,
    })) {
      const owner = entry.key.slice('received/'.length)
      if (!/^[a-f0-9]{64}$/.test(owner))
        throw new Error('Invalid saved device identity')
      if (!Number.isFinite(Date.parse(entry.value.checkedAt)))
        throw new Error('Invalid saved sync timestamp')
      received.set(owner, {
        ...entry.value,
        snapshot: parseSnapshot(entry.value.snapshot),
      })
    }
    node = createNode({
      storage: join(directory, 'identity'),
      swarm,
      profile: {
        appId: 'public-notes-example-v1',
        appName: 'Notes desktop example',
        deviceName: 'Notes desktop',
      },
      capabilities: [capability],
      pairing: {
        request: GRANTS,
        approve: async ({ publicKey }) => {
          // The invitation redeemer is recorded as a direct peer. It must also
          // accept the inviter dialing back after restart, with the exact saved
          // identity and grant ceiling. Unknown peers still require a new code.
          const known = node.peerRegistry.get(publicKey)
          return known?.appId === 'public-notes-example-v1' &&
            known.grantsGiven?.notebook?.includes('exchange')
            ? 'approve-remember'
            : 'deny'
        },
      },
      reconnect: { enabled: true, initialDelayMs: 250, maxDelayMs: 3000 },
    })
    node.on('error', (error) => {
      lastNetworkError = error.error || error.message || 'Network unavailable'
      emit()
    })
    for (const event of [
      'peer',
      'peerDisconnected',
      'listening',
      'inviteRedeemed',
      'inviteRevoked',
    ])
      node.on(event, emit)
    await node.ready()
    // Local startup and editing do not await public discovery or an online peer.
    node.listen().catch((error) => {
      lastNetworkError = error.message
      emit()
    })
  } catch (error) {
    await node?.close().catch(() => {})
    await db.close().catch(() => {})
    await store.close().catch(() => {})
    throw error
  }

  function state() {
    const own = local.notes.map((note) => ({
      ...note,
      owner: node.publicKey,
      local: true,
    }))
    const copies = [...received].flatMap(([owner, entry]) =>
      entry.snapshot.notes.map((note) => ({
        ...note,
        owner,
        local: false,
        checkedAt: entry.checkedAt,
      })),
    )
    return {
      publicKey: node.publicKey,
      revision: local.revision,
      busy: active?.label || null,
      invitationActive:
        !!invitationId &&
        node.listInvites().some((invite) => invite.id === invitationId),
      notes: [...own, ...copies].sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
      ),
      peers: node.peerRegistry.list().map((peer) => ({
        publicKey: peer.publicKey,
        connected:
          !!node.peer(peer.publicKey)?.paired &&
          !node.peer(peer.publicKey)?.closed,
        checkedAt: received.get(peer.publicKey)?.checkedAt || null,
        receivedCount: received.get(peer.publicKey)?.snapshot.notes.length ?? 0,
      })),
      lastNetworkError,
    }
  }
  async function operation(label, task) {
    if (active) throw new Error('Another device operation is running')
    check()
    const controller = new AbortControllerImpl()
    const deadline = Date.now() + 45000
    const timer = setTimeout(
      () =>
        controller.abort(
          new Error(
            'Connection timed out. Your saved notes are still available.',
          ),
        ),
      45000,
    )
    active = { controller, label }
    emit()
    try {
      return await task(controller.signal, () =>
        Math.max(1, deadline - Date.now()),
      )
    } finally {
      clearTimeout(timer)
      active = null
      emit()
    }
  }
  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer)
        reject(signal.reason || new Error('Cancelled'))
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort)
        resolve()
      }, ms)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
  }
  async function exchange(key, signal, remaining) {
    while (true) {
      check(signal)
      let peer
      try {
        peer = node.peer(key)
        if (!peer?.paired || peer.closed)
          peer = await node.connect(key, {
            requested: GRANTS,
            signal,
            timeout: Math.min(10000, remaining()),
          })
        const sent = local
        const reply = await peer
          .client(capability.contract)
          .exchange(sent, { signal, timeout: Math.min(10000, remaining()) })
        if (reply?.receivedRevision !== sent.revision)
          throw new Error('Device did not acknowledge the notebook revision')
        await accept(key, reply.snapshot, signal)
        return
      } catch (error) {
        check(signal)
        const transient =
          [
            'PEER_NOT_FOUND',
            'REQUEST_TIMEOUT',
            'PEER_DISCONNECTED',
            'CLOSED',
          ].includes(error.code) ||
          /disconnected|connection closed|no peer|timed out/i.test(
            error.message,
          )
        if (!transient || remaining() < 500) throw error
        await peer?.close().catch(() => {})
        await wait(Math.min(300, remaining()), signal)
      }
    }
  }
  return {
    node,
    state,
    save(input) {
      return mutate(async () => {
        check()
        const text = input?.text
        if (typeof text !== 'string' || !text.trim() || text.length > 10000)
          throw new Error('Write a note of 1–10,000 characters before saving')
        if (input.title !== undefined && typeof input.title !== 'string')
          throw new Error('Invalid note title')
        const previous = input.id
          ? local.notes.find((note) => note.id === input.id)
          : null
        if (input.id && !previous)
          throw new Error('Only notes written on this desktop can be edited')
        const now = new Date().toISOString()
        const note = {
          id: previous?.id || b4a.toString(crypto.randomBytes(16), 'hex'),
          title: input.title?.trim() || text.trim().split('\n')[0].slice(0, 80),
          text,
          createdAt: previous?.createdAt || now,
          updatedAt: now,
        }
        const next = parseSnapshot({
          schemaVersion: 1,
          revision: local.revision + 1,
          notes: [...local.notes.filter((item) => item.id !== note.id), note],
        })
        await db.put('local', next)
        local = next
        emit()
        return note
      })
    },
    invite() {
      return operation('Creating pairing code', async (signal) => {
        if (invitationId) await node.revokeInvite(invitationId)
        const issued = node.createInvite({
          grants: GRANTS,
          uses: 1,
          expiresIn: 15 * 60_000,
        })
        // createInvite has no native signal. A cancelled late result is revoked
        // rather than leaving an unseen invitation active.
        issued
          .then((invite) => {
            if (signal.aborted) node.revokeInvite(invite.id).catch(() => {})
          })
          .catch(() => {})
        const invite = await new Promise((resolve, reject) => {
          const abort = () => reject(signal.reason || new Error('Cancelled'))
          signal.addEventListener('abort', abort, { once: true })
          issued
            .then(resolve, reject)
            .finally(() => signal.removeEventListener('abort', abort))
          if (signal.aborted) abort()
        })
        check(signal)
        invitationId = invite.id
        return { code: invite.code, expiresAt: invite.expiresAt }
      })
    },
    pair(code) {
      return operation(
        'Pairing and exchanging notes',
        async (signal, remaining) => {
          if (typeof code !== 'string' || !code.trim() || code.length > 4096)
            throw new Error('Paste a pairing code from another Notes desktop')
          const peer = await node.pair(code.trim(), {
            signal,
            timeout: Math.min(30000, remaining()),
            requested: GRANTS,
          })
          if (peer.appId !== 'public-notes-example-v1') {
            await node.unpair(peer.publicKey)
            throw new Error('That code belongs to a different application')
          }
          await node.setPeerGrants(peer.publicKey, GRANTS)
          await exchange(peer.publicKey, signal, remaining)
          return { checked: 1, failed: [] }
        },
      )
    },
    sync() {
      return operation('Exchanging saved notes', async (signal, remaining) => {
        const peers = node.peerRegistry.list()
        if (!peers.length) throw new Error('Pair another Notes desktop first')
        let checked = 0
        const failed = []
        for (const peer of peers) {
          check(signal)
          try {
            await exchange(peer.publicKey, signal, remaining)
            checked++
          } catch (error) {
            check(signal)
            failed.push({ publicKey: peer.publicKey, error: error.message })
          }
        }
        if (!checked)
          throw new Error(
            failed[0]?.error ||
              'No device answered. Keep both apps open and try again.',
          )
        return { checked, failed }
      })
    },
    cancel() {
      active?.controller.abort(
        new Error('Device operation cancelled. Local notes remain available.'),
      )
    },
    async close() {
      if (closed) return
      closed = true
      active?.controller.abort(new Error('Notebook closed'))
      try {
        await node.close()
      } finally {
        await queue
        try {
          await db.close()
        } finally {
          await store.close()
        }
      }
    },
  }
}
