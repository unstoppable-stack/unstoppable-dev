import { createNode, type Peer, type CapabilityPack } from '@unstoppable-stack/p2p'
import { defineCapability, procedure, createClient, type StandardSchema } from '@unstoppable-stack/p2p/rpc'

const input = (value: unknown): { id: string } => {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') throw new Error('id')
  return { id: value.id }
}
const cap = defineCapability({ name: 'notes', version: 1, methods: {
  get: procedure.input(input).query(({ input, signal, peer }) => {
    const id: string = input.id
    const aborted: boolean = signal.aborted
    const publicKey: string | null = peer.publicKey
    return { id, aborted, publicKey }
  }),
  create: procedure.input(input).output((v: unknown): string => String(v)).mutation(({ input }) => input.id),
  watch: procedure.input(input).stream(function * ({ input }) { yield input.id })
}, defaultGrants: ['get', 'watch'] })
const pack: CapabilityPack = cap
const node = createNode({ storage: '/tmp/types', capabilities: [pack], reconnect: { maxAttempts: 3 } })
async function check(peer: Peer) {
  const api = peer.client(cap.contract)
  const result = await api.get({ id: 'n' })
  const id: string = result.id
  // @ts-expect-error input requires id
  api.get({ nope: 1 })
  // @ts-expect-error input id must be string
  api.get({ id: 1 })
  // @ts-expect-error no invented method
  api.missing()
  const value: string = await api.create({ id })
  // @ts-expect-error unary results are promises, not async iterables
  const wrong: AsyncIterable<string> = api.create({ id })
  const stream: AsyncIterable<string> = api.watch({ id })
  // @ts-expect-error streaming results are not unary promises
  const wrongPromise: Promise<string> = api.watch({ id })
  const direct = createClient(peer, cap)
  const same: string = await direct.create({ id })
  return { stream, value, same, node }
}
const transformed: StandardSchema<string, number> = { '~standard': {
  version: 1, vendor: 'test', validate: value => typeof value === 'string' ? { value: value.length } : { issues: [{}] }
} }
const transformedCap = defineCapability({ name: 'transform', version: 1, methods: {
  run: procedure.input(transformed).output((value: unknown): number => { if (typeof value !== 'number') throw new Error('number'); return value }).query(({ input }) => {
    const length: number = input
    return length
  })
} })
async function transformedCheck(peer: Peer) {
  const api = peer.client(transformedCap)
  const output: number = await api.run('hello')
  // @ts-expect-error caller sends pre-transform schema input
  api.run(1)
  return output
}
// Builder methods return new builders, preserving the unconstrained base.
procedure.query(() => ({ ok: true }))
// @ts-expect-error get handler input inferred from parser
procedure.input(input).query(({ input }) => input.missing)
void check
void transformedCheck

// Non-JSON result types must not infer values that cannot cross the wire.
// @ts-expect-error Dates serialize into a different wire type
procedure.query(() => new Date())
// @ts-expect-error undefined becomes null in legacy RPC and is forbidden in typed procedures
procedure.query(() => undefined)
// @ts-expect-error Maps cannot cross the JSON wire
procedure.query(() => new Map<string, string>())
interface Note { id: string; text: string }
const note: Note = { id: 'n', text: 'works with interfaces' }
procedure.query(() => note)

// @ts-expect-error output validators must preserve a JSON wire-compatible shape
procedure.output((value: unknown) => new Date())
// @ts-expect-error output schemas must accept their own output, input transformations remain supported
procedure.output(transformed)
