import type { Capability, Contract, Procedure, Client } from './rpc.js'
import type { Peer } from './peer.js'

/** Optional advanced configuration; sessions own their identity and capability set. */
export type SessionNodeOptions = Omit<import('./index.js').NodeOptions, 'storage' | 'capabilities' | 'reconnect'>
export interface Service<M> {
  readonly node: import('./index.js').UnstoppableNode
  readonly contract: Contract<M>
  /** Returns a single-use, 15-minute invitation by default. No implicit grants. */
  invite(methods: readonly (keyof M & string)[], options?: Omit<import('./index.js').InviteOptions, 'grants'>): Promise<string>
  close(): Promise<void>
}
export interface Connection<M> {
  readonly node: import('./index.js').UnstoppableNode
  readonly peer: Peer
  readonly api: Client<M>
  close(): Promise<void>
}
export function serve<M extends Record<string, Procedure>>(options: {
  storage: string; capability: Capability<M>; nodeOptions?: SessionNodeOptions
}): Promise<Service<M>>
export type ConnectionTarget = { invite: string; publicKey?: never } | { publicKey: import('./index.js').PublicKey; invite?: never }
export function connect<M>(options: ConnectionTarget & {
  storage: string; contract: Contract<M> | Capability<M>; timeout?: number; signal?: AbortSignal; nodeOptions?: SessionNodeOptions
}): Promise<Connection<M>>
