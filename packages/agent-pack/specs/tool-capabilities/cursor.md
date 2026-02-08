# Cursor Capabilities

## Overview

Cursor is an AI-powered IDE built on VS Code. It uses a simpler configuration model than Claude Code, focused primarily on rules that guide the AI's behavior.

## Configuration Hierarchy

Cursor has a straightforward precedence order (highest to lowest):

1. **Team Rules** - Enterprise/organization (if applicable)
2. **Project Rules** - `.cursor/rules/*.mdc`
3. **User Rules** - Cursor Settings > General > Rules for AI

---

## 1. Project Rules (Primary Configuration)

### Location
```
.cursor/rules/*.mdc         # Modern format (recommended)
.cursor/rules/*.md          # Also supported
AGENTS.md                   # Simple alternative (project root or subdirs)
.cursorrules                # Legacy (deprecated, still works)
```

### Rule File Format (.mdc)

Rules use MDC (Markdown with Components) format with YAML frontmatter:

```markdown
---
description: Rules for P2P data synchronization code
globs: ["src/p2p/**/*.ts", "src/data/**/*.ts"]
alwaysApply: false
---

# P2P Data Patterns

## HyperDB Usage
When working with HyperDB:
- Always await database ready state
- Handle peer disconnection gracefully
- Use proper key encoding

## Code Examples
\`\`\`typescript
// Good: Wait for ready
await db.ready()

// Good: Handle disconnection
swarm.on('connection', (conn) => {
  conn.on('close', () => handleDisconnect())
})
\`\`\`

## Don'ts
- Don't assume peers are always connected
- Don't store secrets in replicated data
```

### Rule Types (Application Modes)

| Type | Frontmatter | Behavior |
|------|-------------|----------|
| **Always** | `alwaysApply: true` | Included in every chat |
| **Auto** | `globs: [...]` | Applied when matching files referenced |
| **Agent Choice** | `description: "..."` | Agent decides based on description |
| **Manual** | Neither | Only via `@rulename` mention |

### Frontmatter Properties

| Property | Type | Purpose |
|----------|------|---------|
| `description` | string | Helps agent decide relevance |
| `globs` | string[] | File patterns for auto-apply |
| `alwaysApply` | boolean | Include in all sessions |

---

## 2. Creating Rules

### Via Command Palette
1. `Cmd+Shift+P` > "New Cursor Rule"
2. Enter rule name
3. Creates `.cursor/rules/<name>.mdc`

### Via Settings
1. Cursor Settings > Rules, Commands
2. Manage existing rules
3. View rule status

### Chaining Rules
Reference other rules within a rule:
```markdown
See @code-style for formatting guidelines.
Also follow @security-rules when handling user data.
```

---

## 3. User Rules (Global)

For settings that apply across all projects:

1. Cursor Settings > General > Rules for AI
2. Add global instructions (output language, response style, etc.)

Example:
```
- Always use TypeScript
- Prefer functional patterns
- Keep responses concise
```

---

## 4. AGENTS.md (Simple Alternative)

For simpler projects, use `AGENTS.md` in project root or subdirectories:

```markdown
# Project Assistant

This is an Unstoppable Stack project using:
- Pear Runtime for P2P
- HyperDB for data sync
- QVAC for local inference

## Conventions
- TypeScript everywhere
- Functional patterns preferred
- All P2P code in src/p2p/

## Commands
- `pnpm dev` - Start development
- `pnpm build` - Build for production
- `pear stage` - Stage Pear app
```

Subdirectory `AGENTS.md` files add context for that area:
```
src/
├── p2p/
│   └── AGENTS.md    # P2P-specific guidance
├── ui/
│   └── AGENTS.md    # UI-specific guidance
└── AGENTS.md        # General source guidance
```

---

## 5. MCP Integration

Cursor supports MCP servers for external tools:

### Configuration (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-github"]
    }
  }
}
```

---

## 6. Composer Modes

Cursor's AI assistant (Composer) has different modes:

| Mode | Description |
|------|-------------|
| **Normal** | File and context-aware assistance |
| **Agent** (`Cmd+.`) | Auto-pulls context, executes commands, edits files |

Agent mode is more autonomous and can:
- Search codebase for context
- Run terminal commands
- Make multi-file edits

---

## 7. File Exclusions

Use `.cursorignore` to exclude files from indexing:

```
# .cursorignore
node_modules/
dist/
*.log
.env*
```

This prevents Cursor from loading unnecessary files into context.

---

## 8. Recommended Output Structure

For an Unstoppable Stack project scaffolded with Cursor:

```
my-unstoppable-app/
├── .cursor/
│   ├── rules/
│   │   ├── project.mdc          # Always-apply project context
│   │   ├── code-style.mdc       # TypeScript conventions
│   │   ├── p2p-patterns.mdc     # P2P rules (glob-scoped)
│   │   ├── hyperdb.mdc          # HyperDB patterns
│   │   ├── qvac.mdc             # QVAC patterns (if selected)
│   │   └── testing.mdc          # Test conventions
│   └── mcp.json                 # MCP servers (optional)
├── .cursorignore                # Exclude node_modules, etc.
└── AGENTS.md                    # Simple overview (optional)
```

### Example project.mdc
```markdown
---
description: Unstoppable Stack project configuration
alwaysApply: true
---

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
```

### Example p2p-patterns.mdc
```markdown
---
description: Patterns for P2P networking code
globs: ["src/p2p/**/*.ts", "src/data/**/*.ts"]
---

# P2P Patterns

## Hyperswarm Connection
\`\`\`typescript
const swarm = new Hyperswarm()
swarm.on('connection', (socket, peerInfo) => {
  // Always handle errors
  socket.on('error', (err) => console.error('Peer error:', err))

  // Replicate your cores
  store.replicate(socket)
})
\`\`\`

## HyperDB Operations
\`\`\`typescript
// Always wait for ready
await db.ready()

// Use proper key paths
await db.put('/users/' + id, userData)
const user = await db.get('/users/' + id)
\`\`\`

## Don'ts
- Don't assume peers are always connected
- Don't store large blobs in HyperDB (use Hyperdrive)
- Don't hardcode discovery keys
```

---

## 9. Key Advantages

| Feature | Benefit for Unstoppable Stack |
|---------|-------------------------------|
| **Glob-scoped rules** | Different guidance for P2P vs UI code |
| **MDC format** | Rich formatting with metadata |
| **AGENTS.md** | Simple subdirectory-specific context |
| **Agent mode** | Autonomous multi-file edits |
| **VS Code base** | Full IDE features |

## 10. Limitations

- No lifecycle hooks
- No permission system
- Skills require manual `@` invocation (no auto-trigger by description)
- Less granular than Claude Code settings
- No programmatic hook into agent decisions

---

## Sources

- [Cursor Rules Documentation](https://cursor.com/docs/context/rules)
- [Cursor Best Practices](https://github.com/digitalchild/cursor-best-practices)
- [Awesome Cursor Rules](https://github.com/PatrickJS/awesome-cursorrules)
