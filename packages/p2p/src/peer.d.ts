import type { Capability, Client, Contract } from './rpc.js'
import type { CapabilityRegistry, Grants, Limits, Profile, UnstoppableNode } from './index.js'
export interface CallOptions { timeout?: number; signal?: AbortSignal; version?: number }
export interface CapabilityDescriptor { version: number; methods: string[]; methodKinds?: Record<string, 'unary' | 'stream'> }
export class Peer {
  constructor(options: { node: UnstoppableNode; mux?: unknown; channel?: unknown; remotePublicKey: string | Uint8Array; initiator?: boolean })
  readonly node: UnstoppableNode
  readonly remotePublicKey: string | Uint8Array
  readonly publicKey: string | null
  readonly profile: Profile | null
  readonly appId: string | null
  readonly appName: string | null
  readonly paired: boolean
  readonly closed: boolean
  readonly capabilities: Record<string, CapabilityDescriptor> | null
  readonly grantsGiven: Grants | null
  readonly grantsReceived: Grants | null
  readonly api: Record<string, Record<string, (params?: unknown, options?: CallOptions) => PromiseLike<unknown> & AsyncIterable<unknown>>>
  client<M>(contract: Contract<M> | Capability<M>): Client<M>
  call(capability: string, method: string, params?: unknown, options?: CallOptions): Promise<unknown>
  stream(capability: string, method: string, params?: unknown, options?: CallOptions): AsyncGenerator<unknown>
  send(message: Record<string, unknown>): boolean
  close(): Promise<void>
  on(event: string, listener: (...args: unknown[]) => void): this
  once(event: string, listener: (...args: unknown[]) => void): this
  removeListener(event: string, listener: (...args: unknown[]) => void): this
}
export class AsyncQueue<T = unknown> implements AsyncIterable<T> {
  constructor(limits?: Pick<Limits, 'maxBufferedChunks' | 'maxBufferedBytes'>)
  push(value: T): boolean
  end(): void
  fail(error: Error): void
  [Symbol.asyncIterator](): AsyncIterator<T>
}
export function deferred<T = unknown>(): { promise: Promise<T>; resolve(value: T): void; reject(reason?: unknown): void }
