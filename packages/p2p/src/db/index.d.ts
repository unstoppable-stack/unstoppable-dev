import type { UnstoppableNode, PublicKey } from '../index.js'

export interface DatabaseState {
  experimental: true
  closed: boolean
  writable: boolean
  indexer: boolean
  localLength: number
  checkpoint: { scope: 'autobase-system'; key: string; fork: number; length: number; signedLength: number } | null
  error: string | null
  connectionError: string | null
}
export interface AppendReceipt { scope: 'local-applied'; writerKey: string; length: number }
export interface DatabaseOperationOptions { signal?: AbortSignal }
export interface DatabaseWaitOptions extends DatabaseOperationOptions { timeoutMs?: number }
export interface ViewStore { get(name: string | { name: string; valueEncoding?: unknown }): any }
export interface DatabaseWriterContext { writerKey: string; length: number }
export interface AutobaseAdapter<View, Operation> {
  readonly kind: 'autobase-v1'
  readonly openView: (views: ViewStore) => View
  readonly apply: (operation: Operation, view: View, context: DatabaseWriterContext) => void | Promise<void>
  readonly validate: (operation: unknown) => boolean
  readonly closeView: (view: View) => void | Promise<void>
}
export function autobaseAdapter<View, Operation = unknown>(options: {
  openView(views: ViewStore): View
  apply(operation: Operation, view: View, context: DatabaseWriterContext): void | Promise<void>
  validate?(operation: unknown): boolean
  closeView?(view: View): void | Promise<void>
}): AutobaseAdapter<View, Operation>
export interface ExperimentalDatabase<View, Operation> {
  readonly experimental: true
  readonly key: string
  readonly writerKey: string
  readonly writable: boolean
  /** Read-only by contract; mutate the derived view only inside the reducer. */
  readonly view: View
  state(): DatabaseState
  append(operation: Operation, options?: DatabaseOperationOptions): Promise<AppendReceipt>
  update(options?: DatabaseOperationOptions): Promise<DatabaseState>
  members: {
    add(writerKey: PublicKey, options?: DatabaseOperationOptions): Promise<AppendReceipt>
    remove(writerKey: PublicKey, options?: DatabaseOperationOptions): Promise<AppendReceipt>
  }
  watch(callback: (state: DatabaseState) => void): () => void
  waitFor(predicate: (state: DatabaseState) => boolean, options?: DatabaseWaitOptions): Promise<DatabaseState>
  close(): Promise<void>
}
export function openDatabase<View, Operation>(options: {
  node: UnstoppableNode
  store: { session(): any }
  adapter: AutobaseAdapter<View, Operation>
  key?: PublicKey | null
  encryptionKey?: PublicKey
  discovery?: boolean
  signal?: AbortSignal
}): Promise<ExperimentalDatabase<View, Operation>>
