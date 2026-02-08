# OpenCode Capabilities

## Overview

OpenCode is an open-source AI coding agent that runs in the terminal. It has a sophisticated configuration system with agents, skills, and fine-grained permissions.

## Configuration Hierarchy

OpenCode merges configurations with this precedence (later wins):

1. **Remote** - `.well-known/opencode` (organization)
2. **Global** - `~/.config/opencode/opencode.json`
3. **Custom** - `OPENCODE_CONFIG` env var
4. **Project** - `opencode.json` (project root)
5. **Directory** - `.opencode/` contents
6. **Inline** - `OPENCODE_CONFIG_CONTENT` env var

---

## 1. Configuration File (opencode.json)

### Location
```
opencode.json           # Project root
~/.config/opencode/opencode.json  # Global
```

### Core Structure
```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku",
  "instructions": ".opencode/instructions.md",
  "default_agent": "build",
  "agent": { },
  "permission": { },
  "tools": { },
  "mcp": { },
  "formatter": { }
}
```

### Key Options

| Option | Purpose |
|--------|---------|
| `model` | Primary model for conversations |
| `small_model` | Lightweight tasks (titles, summaries) |
| `instructions` | Path to instructions file (like CLAUDE.md) |
| `default_agent` | Which agent runs by default |
| `agent` | Define custom agents |
| `permission` | Control tool access |
| `tools` | Enable/disable specific tools |
| `mcp` | Configure MCP servers |
| `formatter` | Code formatters per file type |

### Variable Substitution
```json
{
  "mcp": {
    "github": {
      "env": {
        "GITHUB_TOKEN": "{env:GITHUB_TOKEN}"
      }
    }
  },
  "instructions": "{file:.opencode/instructions.md}"
}
```

---

## 2. Agents

### Concept
Agents are specialized AI assistants with different capabilities. Users switch between them with `Tab` or invoke subagents with `@`.

### Built-in Agents

| Agent | Type | Purpose |
|-------|------|---------|
| **build** | Primary | Full tool access, default for development |
| **plan** | Primary | Read-only, for analysis and exploration |
| **General** | Subagent | Multi-step tasks with full access |
| **Explore** | Subagent | Read-only codebase exploration |

### Custom Agents

**Via JSON** (`opencode.json`):
```json
{
  "agent": {
    "p2p-expert": {
      "description": "Expert in P2P patterns and Holepunch stack",
      "mode": "primary",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": ".opencode/agents/p2p-expert.md",
      "tools": {
        "bash": true,
        "edit": true
      },
      "permission": {
        "edit": "allow",
        "bash": {
          "npm *": "allow",
          "pear *": "allow"
        }
      }
    }
  }
}
```

**Via Markdown** (`.opencode/agents/<name>.md`):
```markdown
---
description: Expert in P2P patterns and Holepunch stack
mode: primary
model: anthropic/claude-sonnet-4-5
tools:
  bash: true
  edit: true
permission:
  edit: allow
---

# P2P Expert Agent

You are an expert in building P2P applications with the Holepunch stack.

## Your Knowledge
- Hypercore append-only logs
- HyperDB distributed database
- Hyperswarm P2P networking
- Pear desktop runtime

## Guidelines
- Always handle peer disconnection
- Wait for database ready state
- Use proper replication patterns
```

### Agent Options

| Option | Purpose |
|--------|---------|
| `description` | Required - what the agent does |
| `mode` | `primary`, `subagent`, or `all` |
| `model` | Override model for this agent |
| `prompt` | Custom system prompt file |
| `temperature` | Response randomness (0-1) |
| `tools` | Enable/disable tools |
| `permission` | Per-agent permissions |
| `steps` | Max iterations before text-only |
| `hidden` | Hide from `@` autocomplete |

---

## 3. Skills

### Concept
Skills are reusable instructions loaded on-demand. Agents discover available skills and retrieve content when relevant.

### Locations
```
.opencode/skills/<name>/SKILL.md      # Project
~/.config/opencode/skills/<name>/SKILL.md  # Global

# Also compatible with Claude format:
.claude/skills/<name>/SKILL.md
.agents/skills/<name>/SKILL.md
```

### SKILL.md Format
```markdown
---
name: add-hyperdb
description: Add HyperDB P2P database to a feature
license: MIT
metadata:
  version: "1.0"
---

# Add HyperDB

## Overview
This skill adds HyperDB-based data storage to your application.

## When to Use
- You need P2P data synchronization
- You want offline-first storage
- Multiple devices need to share data

## Steps
1. Install HyperDB: `npm install hyperdb`
2. Create store configuration
3. Set up replication
4. Add to app initialization

## Code Template
\`\`\`typescript
import HyperDB from 'hyperdb'
import Hyperswarm from 'hyperswarm'

const db = new HyperDB('./data/mydb')
await db.ready()

// Set up P2P replication
const swarm = new Hyperswarm()
swarm.on('connection', (socket) => {
  db.replicate(socket)
})

// Join the swarm
const topic = Buffer.alloc(32).fill('my-app-topic')
swarm.join(topic)
\`\`\`

## Verification
- Check that data persists across restarts
- Verify sync between two instances
```

### Frontmatter Options

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | 1-64 chars, lowercase with hyphens |
| `description` | Yes | 1-1024 chars, minimum 20 |
| `license` | No | Metadata |
| `allowed-tools` | No | Restrict tools when skill active |
| `metadata` | No | Key-value pairs |

### Skill Permissions
```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

### Invoking Skills
- **Manual**: `/skill-name` in chat
- **Agent-driven**: Agent calls `skill({ name: "skill-name" })`

---

## 4. Permissions

### Structure
```json
{
  "permission": {
    "edit": "allow",
    "bash": {
      "npm *": "allow",
      "pear *": "allow",
      "git push *": "ask",
      "rm -rf *": "deny"
    },
    "skill": {
      "*": "allow"
    },
    "task": {
      "*": "allow"
    }
  }
}
```

### Permission Values
- `allow` - Execute without asking
- `ask` - Require user approval
- `deny` - Block entirely

### Bash Patterns
Supports glob patterns:
```json
{
  "bash": {
    "npm *": "allow",
    "pnpm *": "allow",
    "git commit *": "allow",
    "git push *": "ask"
  }
}
```

---

## 5. MCP Servers

### Configuration
```json
{
  "mcp": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-github"],
      "env": {
        "GITHUB_TOKEN": "{env:GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem", "/path/to/allow"]
    }
  }
}
```

---

## 6. Tools Configuration

Enable/disable tools globally or per-agent:
```json
{
  "tools": {
    "bash": true,
    "edit": true,
    "write": true,
    "read": true,
    "glob": true,
    "grep": true,
    "skill": true,
    "task": true
  }
}
```

---

## 7. Recommended Output Structure

For an Unstoppable Stack project scaffolded with OpenCode:

```
my-unstoppable-app/
├── opencode.json                    # Main config
├── .opencode/
│   ├── instructions.md              # Project instructions (like CLAUDE.md)
│   ├── agents/
│   │   ├── p2p-expert.md           # P2P specialist agent
│   │   └── inference.md            # QVAC specialist (if selected)
│   └── skills/
│       ├── add-hyperdb/
│       │   └── SKILL.md
│       ├── add-p2p-sync/
│       │   └── SKILL.md
│       ├── add-inference/
│       │   └── SKILL.md
│       └── explain-architecture/
│           └── SKILL.md
└── .gitignore
```

### Example opencode.json
```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "instructions": ".opencode/instructions.md",
  "default_agent": "build",
  "agent": {
    "p2p-expert": {
      "description": "Expert in P2P patterns, Hypercore, HyperDB, Hyperswarm",
      "mode": "subagent",
      "prompt": ".opencode/agents/p2p-expert.md"
    }
  },
  "permission": {
    "edit": "allow",
    "bash": {
      "npm *": "allow",
      "pnpm *": "allow",
      "pear *": "allow",
      "git commit *": "allow",
      "git push *": "ask"
    },
    "skill": {
      "*": "allow"
    }
  },
  "formatter": {
    "*.ts": "npx prettier --write",
    "*.tsx": "npx prettier --write",
    "*.js": "npx prettier --write"
  }
}
```

### Example instructions.md
```markdown
# Unstoppable Stack Project

## Overview
This is a [Starter/QVAC AI] project built on the Unstoppable Stack.

## Tech Stack
- **Runtime**: Pear (P2P desktop apps)
- **Data**: HyperDB (P2P key-value store)
- **Network**: Hyperswarm (P2P discovery)
[- **AI**: QVAC SDK (local inference)]

## Project Structure
\`\`\`
src/
├── index.ts      # Entry point
├── app/          # Application logic
├── p2p/          # P2P networking
├── data/         # Database/storage
└── ui/           # UI components
\`\`\`

## Commands
- `pnpm dev` - Development mode
- `pnpm build` - Build
- `pnpm test` - Run tests
- `pear stage` - Stage Pear app

## Key Patterns
- Always await database ready state before operations
- Handle peer disconnection gracefully
- Use Hyperswarm topics for service discovery

## Available Skills
Use `/skill-name` to invoke:
- `/add-hyperdb` - Add database to feature
- `/add-p2p-sync` - Set up peer replication
- `/explain-architecture` - Understand the codebase

## Available Agents
Use `@agent-name` to invoke:
- `@p2p-expert` - For P2P architecture questions
```

---

## 8. Key Advantages

| Feature | Benefit for Unstoppable Stack |
|---------|-------------------------------|
| **Custom agents** | P2P expert agent with specialized knowledge |
| **Skills** | Compatible with Claude format, reusable |
| **Fine permissions** | Allow pear/npm commands, block dangerous ops |
| **Formatters** | Auto-format on save |
| **Multiple agents** | Switch between build/plan/expert modes |
| **Open source** | Can extend or customize |

## 9. Limitations

- Skills require restart to pick up changes
- No lifecycle hooks like Claude Code
- TUI-only (no IDE integration)
- Less documentation than competitors

---

## Sources

- [OpenCode Documentation](https://opencode.ai/docs/)
- [OpenCode Agents](https://opencode.ai/docs/agents/)
- [OpenCode Skills](https://opencode.ai/docs/skills)
- [OpenCode Config](https://opencode.ai/docs/config/)
- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
