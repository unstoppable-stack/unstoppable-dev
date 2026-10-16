import type { CapabilityPack } from '../index.js'
export type ResourceKind = 'hypercore' | 'hyperbee' | 'hyperdrive'
export type ProtectionMode = 'mirror' | 'metadata-only'
export interface ResourceDescriptor {
  id: string; kind: ResourceKind; key: string; name: string
  metadata?: Record<string, string>
  protection?: { mode: ProtectionMode }
}
export interface ResourceManifest { schemaVersion: 1; resources: ResourceDescriptor[] }
export interface ProtectionState {
  mode: ProtectionMode; state: 'metadata-only' | 'pending' | 'syncing' | 'protected' | 'error'
  caughtUpAt: string | null; lastError: string | null
  targetLength?: number; localContiguousLength?: number; blocksRemaining?: number
  targetVersion?: number; totalBytes?: number; protectedBytes?: number; bytesRemaining?: number
}
export interface ResourceStats {
  key: string; resourceId: string | null; type: ResourceKind; name: string
  metadata: Record<string, string>; owner: string; paused: boolean; lastSync: number | null
  byteLength: number; peers: number; protection: ProtectionState
  length?: number; version?: number; blobsByteLength?: number
}
export class ReplicationEngine {
  constructor(store: any, swarm: any, options?: { admit?(owner: string): void | Promise<void> })
  addCore(options: { key: string; type: ResourceKind; name: string; owner: string; resourceId?: string | null; metadata?: Record<string, string>; protection?: { mode: ProtectionMode }; paused?: boolean }): Promise<{ key: string; length: number; byteLength: number }>
  addDrive(options: { key: string; name: string; owner: string; resourceId?: string | null; metadata?: Record<string, string>; protection?: { mode: ProtectionMode }; paused?: boolean }): Promise<{ key: string; version: number }>
  reconcileOwnerResources(owner: string, keys: { coreKeys?: string[]; driveKeys?: string[] }): Promise<void>
  removeCore(key: string): Promise<void>
  removeDrive(key: string): Promise<void>
  removeOwnerCores(owner: string): Promise<void>
  pauseOwner(owner: string): Promise<number>
  resumeOwner(owner: string): Promise<number>
  onPeerConnection(): void
  getStats(): ResourceStats[]
  getDriveStats(): ResourceStats[]
  getDrive(key: string): any | null
  getCore(key: string): any | null
  peekCore(key: string, options?: { limit?: number }): Promise<any>
  peekDrive(key: string, options?: { dir?: string; limit?: number }): Promise<any>
  getReplicatedBytes(): { totalCores: number; totalDrives: number; total: number; perOwner: Record<string, number> }
  close(): Promise<void>
}
export interface SyncPack extends CapabilityPack {
  readonly engine: ReplicationEngine | null
  /** Persist discovery/download intent; established transport may still replicate. */
  pauseOwner(owner: string): Promise<number>
  resumeOwner(owner: string): Promise<number>
}
export function syncPack(options: { store?: any; storage?: string; admit?(owner: string): void | Promise<void> }): SyncPack
export function validateResourceManifest(value: unknown): ResourceManifest
