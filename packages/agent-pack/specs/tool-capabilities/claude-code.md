# Claude Code Capabilities

## Overview

Claude Code is Anthropic's official CLI for AI-assisted coding. It provides the most comprehensive configuration system of the three tools, with layered settings, lifecycle hooks, and MCP integration.

## Configuration Hierarchy

Claude Code uses a layered configuration system (highest to lowest priority):

1. **Managed** - System-wide IT policies
2. **Local** - Project personal (`.claude/settings.local.json`, gitignored)
3. **Project** - Team shared (`.claude/settings.json`, committed)
4. **User** - Personal global (`~/.claude/settings.json`)

---

## 1. Project Instructions (CLAUDE.md)

### Purpose
Persistent project context loaded at every session start. This is the primary mechanism for teaching Claude about your project.

### Locations (checked in order)
```
./CLAUDE.md                    # Project root (recommended)
./.claude/CLAUDE.md           # Alternative location
./.claude/rules/*.md          # Modular rules (additive)
./CLAUDE.local.md             # Personal overrides (gitignored)
```

### What to Include
- Code style guidelines and conventions
- Build/test commands (`npm test`, `pnpm build`)
- Architectural decisions and patterns
- Important gotchas and non-obvious behaviors
- Links to documentation (`@docs/api.md` syntax)

### What to Avoid
- Self-evident practices
- Lengthy API docs (link instead)
- Frequently changing information
- File-by-file descriptions

### Features

**Imports** - Reference other files:
```markdown
See @README.md for overview
- API patterns: @docs/api-conventions.md
- Git workflow: @docs/git-instructions.md
```

**Modular Rules** - Split into `.claude/rules/`:
```
.claude/rules/
├── code-style.md       # Always applies
├── testing.md
├── p2p-patterns.md     # Path-scoped (see below)
└── security.md
```

**Path-Scoped Rules** - Use YAML frontmatter:
```markdown
---
paths:
  - "src/p2p/**/*.ts"
  - "src/data/**/*.ts"
---
# P2P Module Rules
When working with P2P code...
```

### Best Practices
- Keep under 500 lines per file
- Use `IMPORTANT:` or `YOU MUST:` for critical rules
- Commit to git for team consistency
- Run `/init` to bootstrap from codebase analysis

---

## 2. Skills (Slash Commands)

### Purpose
Reusable instructions and workflows invoked manually (`/skill-name`) or automatically by Claude when relevant.

### Location
```
~/.claude/skills/<name>/SKILL.md    # Global (personal)
.claude/skills/<name>/SKILL.md      # Project (shared)
```

### SKILL.md Format
```markdown
---
name: add-p2p-sync
description: Add HyperDB P2P sync to a feature
allowed-tools: Read, Grep, Edit, Bash(npm *)
---

# Add P2P Sync

## When to Use
When user wants to add data synchronization between peers.

## Steps
1. Create a new store in `src/data/`
2. Set up replication in `src/p2p/`
3. Connect to app initialization

## Code Template
\`\`\`typescript
import HyperDB from 'hyperdb'
// ...
\`\`\`
```

### Frontmatter Options

| Field | Purpose |
|-------|---------|
| `name` | Becomes `/name` command |
| `description` | Claude uses this to decide when to apply |
| `allowed-tools` | Restrict tools when skill active |
| `disable-model-invocation` | Only manual `/name` invocation |
| `user-invocable` | Set `false` for background knowledge only |
| `context: fork` | Run in isolated subagent |

### Use Cases for Unstoppable Stack
- `/add-hyperdb` - Add database to feature
- `/add-p2p-sync` - Set up peer replication
- `/add-inference` - Integrate QVAC model
- `/explain-p2p` - Explain P2P architecture
- `/debug-swarm` - Debug peer discovery

---

## 3. Hooks (Lifecycle Automation)

### Purpose
Run shell commands or prompts at specific lifecycle points. Unlike CLAUDE.md (advisory), hooks are deterministic.

### Hook Events

| Event | Trigger |
|-------|---------|
| `PreToolUse` | Before tool executes (can block) |
| `PostToolUse` | After successful tool execution |
| `SessionStart` | Session begins or resumes |
| `Stop` | Claude finishes responding |

### Configuration (`.claude/settings.json`)
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "npx prettier --write $FILE"
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{
          "type": "command",
          "command": ".claude/hooks/protect-files.sh"
        }]
      }
    ]
  }
}
```

### Use Cases for Unstoppable Stack
- Auto-format after edits
- Protect `.env` and secrets from modification
- Run tests after certain file changes
- Inject reminders after context compaction

---

## 4. MCP Servers (External Tools)

### Purpose
Connect Claude to external tools, databases, and services via Model Context Protocol.

### Configuration (`.mcp.json` at project root)
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem"]
    }
  }
}
```

### Relevant MCP Servers
- **GitHub** - Issues, PRs, repo management
- **Filesystem** - Extended file operations
- **Database** - Query project databases
- **Custom** - Could build Holepunch-specific tools

---

## 5. Settings & Permissions

### Permission Configuration
```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(pnpm *)",
      "Bash(pear *)",
      "Read(~/.config/*)"
    ],
    "deny": [
      "Read(./.env)",
      "Edit(package-lock.json)"
    ]
  }
}
```

### Other Settings
```json
{
  "env": {
    "NODE_ENV": "development"
  },
  "model": "claude-sonnet-4-5-20250929",
  "outputStyle": "Technical"
}
```

---

## 6. Recommended Output Structure

For an Unstoppable Stack project scaffolded with Claude Code:

```
my-unstoppable-app/
├── CLAUDE.md                     # Main project instructions
├── .claude/
│   ├── settings.json            # Permissions, hooks
│   ├── rules/
│   │   ├── code-style.md        # TypeScript conventions
│   │   ├── p2p-patterns.md      # P2P coding rules (path-scoped)
│   │   └── testing.md           # Test conventions
│   ├── skills/
│   │   ├── add-hyperdb/
│   │   │   └── SKILL.md
│   │   ├── add-p2p-sync/
│   │   │   └── SKILL.md
│   │   ├── add-inference/
│   │   │   └── SKILL.md
│   │   └── explain-architecture/
│   │       └── SKILL.md
│   └── hooks/
│       └── protect-files.sh
├── .mcp.json                     # MCP servers (optional)
└── .gitignore                    # Include .claude/settings.local.json
```

---

## 7. Key Advantages

| Feature | Benefit for Unstoppable Stack |
|---------|-------------------------------|
| **Skills** | Encapsulate complex P2P recipes as invokable commands |
| **Path-scoped rules** | Different guidance for P2P vs UI code |
| **Hooks** | Auto-format, protect secrets, run validations |
| **MCP** | Could expose Holepunch debugging tools |
| **Layered config** | Team settings + personal overrides |

## 8. Limitations

- Skills require restart to pick up changes
- Hooks add latency to operations
- Large CLAUDE.md files consume context window
- MCP servers need separate installation

---

## Sources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code GitHub](https://github.com/anthropics/claude-code)
