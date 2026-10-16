import type { Peer, CapabilityDescriptor } from './peer.js'
export { Peer, AsyncQueue } from './peer.js'
export type { CallOptions, CapabilityDescriptor } from './peer.js'
export type PublicKey = string | Uint8Array
export type Grants = Record<string, readonly string[]>
export interface Profile { appId?: string | null; appName?: string | null; deviceName?: string | null }
export interface Limits { maxPeers: number; maxFrameBytes: number; maxRequestsPerPeer: number; maxRequests: number; requestTimeoutMs: number; maxBufferedChunks: number; maxBufferedBytes: number; maxStreamBytes: number }
export interface HandlerContext { peer: Peer; appId: string | null; grants: Grants; signal: AbortSignal }
// Legacy packs intentionally accept application-specific params without a schema.
export interface CapabilityPack {
  name: string; version?: number
  methods: Record<string, (params: any, context: HandlerContext) => unknown>
  defaultGrants?: readonly string[]
  onAttach?(node: UnstoppableNode): void | Promise<void>
  onPeer?(peer: Peer): void | Promise<void>
  onDetach?(): void | Promise<void>
}
export interface ReconnectOptions { enabled?: boolean; initialDelayMs?: number; maxDelayMs?: number; factor?: number; maxAttempts?: number | null; dialTimeoutMs?: number }
export interface ConnectOptions { requested?: Grants | null; timeout?: number; reconnect?: boolean; signal?: AbortSignal }
export interface ApprovalRequest { publicKey: string; profile: Profile; capabilities: Record<string, CapabilityDescriptor>; requested: Grants | null; [key: string]: unknown }
export type Approve = (request: ApprovalRequest) => string | Promise<string>
export interface NodeOptions {
  storage: string; profile?: Profile; nodeType?: string; capabilities?: readonly CapabilityPack[]
  limits?: Partial<Limits>; topic?: Uint8Array; handshakeTimeoutMs?: number; inviteWatchMs?: number
  pairing?: { autoApprove?: boolean; approve?: Approve; request?: Grants; isDenied?: (publicKey: string) => boolean | Promise<boolean> }
  reconnect?: boolean | ReconnectOptions
  swarm?: { bootstrap?: readonly (string | { host: string; port: number })[]; dht?: unknown; maxPeers?: number; keyPair?: Identity['keyPair']; [option: string]: unknown }
}
export class UnstoppableNode {
  constructor(options: NodeOptions)
  readonly storage: string; readonly profile: Profile; readonly nodeType: string
  readonly publicKey: string | null; readonly peers: Peer[]; readonly networks: string[]
  readonly listening: boolean; readonly closed: boolean; readonly identity: Identity | null
  readonly capabilities: CapabilityRegistry; readonly peerRegistry: PeerRegistry; readonly invites: InviteStore; readonly limits: Limits
  readonly swarm: unknown
  ready(): Promise<void>
  peer(key: PublicKey): Peer | null
  listen(options?: { topic?: Uint8Array }): Promise<this>
  connect(key: PublicKey, options?: ConnectOptions): Promise<Peer>
  discover(options?: ConnectOptions & { topic?: Uint8Array }): Promise<Peer>
  pair(code: string, options?: ConnectOptions): Promise<Peer>
  createInvite(options?: InviteOptions): Promise<IssuedInvite>
  listInvites(): Omit<InviteRecord, 'secret'>[]
  revokeInvite(id: string): Promise<boolean>
  joinNetwork(id: string, options?: { grants?: Grants | null; requested?: Grants | null; approve?: Approve | null }): Promise<{ id: string; topic: string }>
  leaveNetwork(id: string): Promise<boolean>
  setPeerGrants(key: PublicKey, grants: Grants): Promise<Grants>
  setPeerPolicy(key: PublicKey, policy: Record<string, unknown>): Promise<PeerRecord>
  unpair(key: PublicKey): Promise<boolean>
  close(): Promise<void>
  on(event: string, listener: (...args: any[]) => void): this
  once(event: string, listener: (...args: any[]) => void): this
  emit(event: string, ...args: unknown[]): boolean
  removeListener(event: string, listener: (...args: any[]) => void): this
}
export function createNode(options: NodeOptions): UnstoppableNode
export class CapabilityRegistry {
  constructor(packs?: readonly CapabilityPack[])
  readonly packs: Map<string, CapabilityPack>
  add(pack: CapabilityPack): this
  get(name: string): CapabilityPack | null
  has(name: string): boolean
  describe(): Record<string, CapabilityDescriptor>
  resolve(capability: string, method: string): { pack: CapabilityPack; handler: CapabilityPack['methods'][string]; streaming: boolean }
  defaultGrants(): Grants
  grantsFor(requested?: Grants | null): Grants
  isGranted(grants: Grants | null, capability: string, method: string): boolean
  attach(node: UnstoppableNode): Promise<void>
  onPeer(peer: Peer): Promise<void>
  detach(): Promise<void>
}
export function validatePack<T extends CapabilityPack>(pack: T): T
export function isAsyncGeneratorFunction(value: unknown): boolean
export interface Identity { seed: Uint8Array; keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }; publicKey: string }
export function loadIdentity(storage: string): Promise<Identity>
export function createIdentity(): Identity
export function fromSeed(seed: Uint8Array): Identity
export interface PeerRecord extends Profile { publicKey: string; nodeType?: string; grantsGiven?: Grants; grantsReceived?: Grants; pairingMethod?: string; inviteId?: string | null; network?: string | null; policy?: Record<string, unknown>; [key: string]: unknown }
export class PeerRegistry {
  constructor(storage: string)
  ready(): Promise<void>
  put(record: PeerRecord): Promise<PeerRecord>
  get(key: PublicKey): PeerRecord | null
  has(key: PublicKey): boolean
  list(): PeerRecord[]
  remove(key: PublicKey): Promise<boolean>
  isDenied(key: PublicKey): boolean
  deny(key: PublicKey): Promise<void>
  forgetDenial(key: PublicKey): Promise<void>
  flushed(): Promise<void>
}
export interface InviteOptions { grants?: Grants | null; uses?: number | null; expiresIn?: number | null; label?: string | null }
export interface IssuedInvite { id: string; code: string; publicKey: string; expiresAt: string | null; uses: number | null; label: string | null }
export interface InviteRecord extends Omit<IssuedInvite, 'code' | 'publicKey'> { secret: string; grants: Grants | null; used: number; createdAt: string; lastUsedAt: string | null }
export class InviteStore {
  constructor(storage: string)
  ready(): Promise<void>
  reload(): Promise<void>
  flushed(): Promise<void>
  put(record: InviteRecord): Promise<unknown>
  get(id: string): InviteRecord | null
  list(): InviteRecord[]
  listAll(): InviteRecord[]
  consume(id: string): Promise<unknown>
  revoke(id: string): Promise<boolean>
  prune(): Promise<unknown>
}
export function encodeInvite(options: { publicKey: PublicKey; secret: Uint8Array }): string
export function decodeInvite(code: string): { version: number; publicKey: string; publicKeyBuffer: Uint8Array; secret: Uint8Array; id: string; topic: Uint8Array }
export function inviteTopic(secret: Uint8Array): Uint8Array
export function inviteId(secret: Uint8Array): string
export function inviteProof(secret: Uint8Array, joinerPublicKey: PublicKey, hostPublicKey: PublicKey): string
export function createSecret(): Uint8Array
export function issueInvite(options: InviteOptions & { storage: string }): Promise<IssuedInvite>
export const INVITE_VERSION: number
export const PROTOCOL_VERSION: number
export const CONTROL_PROTOCOL: string
export const MESSAGE: Readonly<Record<'HELLO' | 'PAIR_REQUEST' | 'PAIR_ACCEPTED' | 'PAIR_CONFIRM' | 'PAIR_DENIED' | 'CALL' | 'RESULT' | 'CHUNK' | 'END' | 'ERROR' | 'CANCEL', string>>
export const NODE_TYPES: Readonly<{ APP: 'app'; PERSONAL_NODE: 'personal-node' }>
export const ROLES: Readonly<{ HOST: 'host'; CLIENT: 'client' }>
export function localDiscoveryTopic(): Uint8Array
export function networkTopic(id: string): Uint8Array
export function toPublicKeyBuffer(key: PublicKey): Uint8Array | null
export function toPublicKeyHex(key: PublicKey): string
export class NodeError extends Error { constructor(code: string, message: string, extra?: Record<string, unknown>); code: string; [key: string]: unknown }
export class PeerNotFoundError extends NodeError { constructor(publicKey: PublicKey) }
export class PairDeniedError extends NodeError { constructor(reason: string) }
export class NotGrantedError extends NodeError { constructor(capability: string, method: string) }
export class UnknownCapabilityError extends NodeError { constructor(capability: string) }
export class UnknownMethodError extends NodeError { constructor(capability: string, method: string) }
export class RequestTimeoutError extends NodeError { constructor(capability: string, method: string, timeout: number) }
export class CancelledError extends NodeError { constructor(message?: string) }
export class InvalidOptionError extends NodeError { constructor(message: string) }
export class ClosedError extends NodeError { constructor(message?: string) }
export function errorFromRemote(frame: { code?: string; message?: string; capability?: string; method?: string }): NodeError
export function normalizeError(error: unknown): NodeError
export const AbortControllerImpl: typeof AbortController
export const DEFAULT_LIMITS: Readonly<Limits>
