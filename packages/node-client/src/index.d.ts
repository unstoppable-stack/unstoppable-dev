import EventEmitter from 'bare-events'

export type NodeService = 'data' | 'files' | 'ai'
export type CapabilityGrants = Record<string, string[]>

export interface CoreResource {
  key: Uint8Array | string
  type?: 'hypercore' | 'hyperbee' | string
  name?: string
}

export interface DriveResource {
  key: Uint8Array | string
  name?: string
}

export interface NodeStatus {
  protocolVersion: string
  nodePublicKey: string
  services: Record<NodeService, boolean>
  capabilities: Record<string, unknown>
  apps: Array<Record<string, unknown>>
  pairedApps: number
  cores: Array<Record<string, unknown>>
  drives: Array<Record<string, unknown>>
  connectedPeers: number
  storagePath: null
  storage: Record<string, unknown>
  ai: Record<string, unknown> | null
}

export interface ConnectToNodeOptions {
  appId: string
  appName?: string
  cores?: CoreResource[]
  drives?: DriveResource[]
  swarm?: Record<string, unknown>
  topic?: Uint8Array
  timeout?: number
  requireServices?: NodeService[]
  deviceName?: string
  reconnect?: boolean | {
    initialDelayMs?: number
    maxDelayMs?: number
    factor?: number
    maxAttempts?: number
  }
  requestedCapabilities?: CapabilityGrants
}

export interface InferenceRequest {
  messages: Array<{ role: string; content: string }>
  timeout?: number
  signal?: AbortSignal
}

export class NodeClient extends EventEmitter {
  constructor(options: Omit<ConnectToNodeOptions, 'timeout' | 'requireServices'>)
  readonly appId: string
  readonly appName?: string
  readonly nodePublicKey: string | null
  readonly services: Record<NodeService, boolean> | null
  readonly capabilities: Record<string, unknown> | null
  readonly grants: CapabilityGrants | null
  readonly paired: boolean
  readonly registered: boolean
  lastStatus: NodeStatus | null
  connect(): Promise<void>
  getNodeStatus(opts?: { timeout?: number }): Promise<NodeStatus>
  getDiskUsage(opts?: { timeout?: number }): Promise<{ bytes: number; files: null; path: null; scope: 'self' }>
  peekCore(key: string, opts?: { limit?: number; timeout?: number }): Promise<unknown>
  peekDrive(key: string, opts?: { dir?: string; limit?: number; timeout?: number }): Promise<unknown>
  requestInference(req: InferenceRequest): AsyncGenerator<string>
  sendHeartbeat(): void
  close(): Promise<void>
}

export function connectToNode(options: ConnectToNodeOptions): Promise<NodeClient>

export class NodeClientError extends Error { code: string }
export class NodeNotFoundError extends NodeClientError {}
export class NodeDeniedError extends NodeClientError { reason: string }
export class NodeMissingServiceError extends NodeClientError { missing: string[]; services: Record<string, boolean> }
export class InvalidOptionError extends NodeClientError {}
export class ClientClosedError extends NodeClientError {}
export class InferenceError extends NodeClientError {}
