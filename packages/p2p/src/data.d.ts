import type { SessionNodeOptions } from './service.js'
import type { ExperimentalDatabase, AppendReceipt, DatabaseOperationOptions } from './db/index.js'
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export interface DataOptions {
  /** Dedicated directory for this dataset and this device. */
  storage: string
  /** Omit to create or reopen the dataset already saved in this directory. */
  key?: string
  nodeOptions?: SessionNodeOptions
}
export interface DataNetwork {
  /** Wait for a successful announcement, not a peer connection or remote durability. */
  ready(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<void>
  status(): { closed: boolean; announced: boolean; connections: number; dhtPeers: number }
}
export interface Collection {
  readonly network: DataNetwork
  readonly key: string
  readonly version: number
  readonly writable: boolean
  get(key: string): Promise<JsonValue | null>
  put(key: string, value: JsonValue): Promise<void>
  del(key: string): Promise<void>
  sync(options: { version: number; timeoutMs?: number; signal?: AbortSignal }): Promise<{ scope: 'local-downloaded'; version: number }>
  close(): Promise<void>
}
export function openCollection(options: DataOptions): Promise<Collection>
export interface CollaborativeDatabase extends Pick<ExperimentalDatabase<unknown, unknown>, 'experimental' | 'key' | 'writerKey' | 'writable' | 'members' | 'update' | 'watch' | 'waitFor' | 'state' | 'close'> {
  readonly network: DataNetwork
  get(key: string): Promise<JsonValue | null>
  put(key: string, value: JsonValue, options?: DatabaseOperationOptions): Promise<AppendReceipt>
  del(key: string, options?: DatabaseOperationOptions): Promise<AppendReceipt>
}
export function openCollaborativeDatabase(options: DataOptions & {
  encryptionKey?: import('./index.js').PublicKey
  signal?: AbortSignal
}): Promise<CollaborativeDatabase>
