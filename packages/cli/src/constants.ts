export const ASSISTANTS = [
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic CLI with skills & hooks'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI-powered IDE'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open source terminal agent'
  },
  {
    id: 'none',
    name: 'None',
    description: 'Skip AI assistant setup'
  }
] as const

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Minimal setup - you decide what to build',
    modules: []
  }
] as const

export const MODULES = [
  {
    id: 'hyperdb',
    name: 'HyperDB',
    description: 'P2P database',
    requires: ['hypercore', 'hyperswarm']
  },
  {
    id: 'hyperdrive',
    name: 'Hyperdrive',
    description: 'P2P file storage',
    requires: ['hypercore', 'hyperswarm']
  },
  {
    id: 'qvac',
    name: 'QVAC',
    description: 'Local AI inference',
    requires: []
  },
  {
    id: 'wdk',
    name: 'WDK Wallet',
    description: 'Crypto payments',
    requires: []
  }
] as const

export const MODULE_DEPS: Record<string, string[]> = {
  hyperdb: ['hypercore', 'hyperswarm'],
  hyperdrive: ['hypercore', 'hyperswarm'],
  pear: ['bare'],
  qvac: [],
  wdk: []
}

export type AssistantId = (typeof ASSISTANTS)[number]['id']
export type TemplateId = (typeof TEMPLATES)[number]['id']
export type ModuleId = (typeof MODULES)[number]['id']
