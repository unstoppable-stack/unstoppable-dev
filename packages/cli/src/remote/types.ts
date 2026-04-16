export interface DeviceInfo {
  publicKey: string
  name: string
  pairedAt: string
}

export interface RemoteConfig {
  deviceName: string
  keypair: { publicKey: string; secretKey: string } | null
  trustedDevices: DeviceInfo[]
}

export interface SessionInfo {
  id: string
  command: string
  startedAt: string
  pid: number
}

export const REMOTE_DIR = '.unstoppable/remote'
export const CONFIG_FILE = 'config.json'
export const PROTOCOL_VERSION = 1

export const MSG = {
  PAIR_REQUEST: 'pair:request',
  PAIR_ACCEPT: 'pair:accept',
  SESSION_OUTPUT: 'session:output',
  SESSION_INPUT: 'session:input',
  SESSION_INFO: 'session:info',
  SESSION_END: 'session:end',
  HEARTBEAT: 'heartbeat',
  SESSIONS_LIST: 'sessions:list',
  SESSIONS_LIST_RESPONSE: 'sessions:list:response',
  TERMINAL_RESIZE: 'terminal:resize',
} as const

export interface ProtocolMessage {
  type: string
  version: number
  payload: Record<string, unknown>
}
