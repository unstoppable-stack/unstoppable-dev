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
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI terminal coding agent'
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
  }
] as const

export type AssistantId = (typeof ASSISTANTS)[number]['id']
export type TemplateId = (typeof TEMPLATES)[number]['id']
