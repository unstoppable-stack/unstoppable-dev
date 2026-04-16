---
id: XREF-INSPIRATION-001
title: Inspiration-derived improvements (agent-code reference)
package: multiple
status: planning
created: 2026-03-31
updated: 2026-04-14
owner:
---

# Inspiration-derived improvements

This document maps **useful patterns** observed in `inspiration/agent-code/` (reference CLI / agent implementation) to **concrete improvement ideas** for Unstoppable Stack packages. It is a **backlog**, not a commitment order.

**Sources of ideas:**
- `inspiration/agent-code/` — Production agent CLI (skills, tools, sub-agents, compaction, UI/UX). Use as architectural inspiration.
- `badlogic/pi-mono` — Lightweight coding agent by Mario Zechner (MIT). Clean event-driven architecture, custom TUI without React, pluggable tools. GitHub: https://github.com/badlogic/pi-mono

**Status column** tracks the *proposal* lifecycle for this document’s rows. Split any large row into its own file under the package folder when work starts (see `TEMPLATE.md`).

## Master backlog table

| ID | Package | Improvement | Status |
|----|---------|-------------|--------|
| INS-CLI-001 | cli | **`us doctor` v2:** Structured diagnostics (install type, binary path, duplicate installs on `PATH`), optional `rg`/network hints, stable `{ issue, fix }` objects alongside `--json` | planning |
| INS-CLI-002 | cli | **Lazy-loaded subcommands:** Dynamic `import()` for heavy command modules to improve cold start (pattern from lazy slash-command loading) | planning |
| INS-CLI-003 | cli | **Parallel startup prefetch:** Where `us` gains slow operations (config reads, version checks), run independent IO in parallel before heavy work | planning |
| INS-CLI-004 | cli | **Config migrations:** Version stamped `us init` output; small named migrations when defaults or paths change (avoid breaking existing projects) | planning |
| INS-CLI-005 | cli | **Environment warnings in doctor:** Context hints the reference surfaces (proxy/TLS, sandbox egress, shell config) as optional non-blocking checks | planning |
| INS-AP-001 | agent-pack | **Skill frontmatter parity:** Document (and optionally validate) a Cursor/Claude-friendly frontmatter set: `when_to_use`, `allowed-tools`, `user-invocable`, `paths` (conditional activation), `hooks`, argument hints | implemented |
| INS-AP-002 | agent-pack | **Short skill index lines:** Cap listing/description length in generated "skill index" or rules; keep depth in `SKILL.md` body (saves context / cache tokens) | implemented |
| INS-AP-003 | agent-pack | **Sub-agent / specialist recipes:** Read-only "explorer" pattern (narrow tools, strong no-write system contract), plan-only agent, explicit `whenToUse`-style routing text for the parent model | implemented |
| INS-AP-004 | agent-pack | **Web patterns doc:** Recipe for safe URL fetch (redirect policy, size/time limits, authenticated-URL limitations) and for provider-native **web search** where applicable (citations, domain allow/deny) | planning |
| INS-AP-005 | agent-pack | **Path-based skill activation:** Align or extend `skill-rules.json` with gitignore-style path gating and document precedence (project vs user) | implemented |
| INS-AP-006 | agent-pack | **In-session task lists (todos):** Recipe for a structured checklist the model updates turn-by-turn; optional “verification nudge” before closing long lists | planning |
| INS-AP-007 | agent-pack | **Plan-before-code workflow:** Document design-first loops (enter/exit plan tools, permission mode shifts); map to how Cursor / other clients handle plan mode | planning |
| INS-AP-008 | agent-pack | **Structured output for automation:** Recipe for CI/SDK-style agents that must finish with **schema-validated JSON** (final “structured output” tool pattern) | planning |
| INS-AP-009 | agent-pack | **MCP in agent loops:** Progressive disclosure (defer + tool-search), tool vs resource, permission prompts, cleanup when sub-context ends | planning |
| INS-AP-010 | agent-pack | **Hooks security guide:** User/project HTTP hooks — SSRF-style blocking for metadata IPs, URL allowlists, wildcard matching, **header injection** sanitization (strip CR/LF/NUL), timeouts | planning |
| INS-AP-011 | agent-pack | **LSP-assisted workflows:** When language servers beat raw grep/edit; recipe outline for IDE-aware refactors | planning |
| INS-AP-012 | agent-pack | **Notebook editing:** Pattern for Jupyter-style notebooks in agent-driven flows (tool scope, output size) | planning |
| INS-AP-013 | agent-pack | **Long-context hygiene:** Document context budgets — auto-compact thresholds, reserved output tokens for summaries, **circuit breakers** after repeated compaction failure | implemented |
| INS-AP-014 | agent-pack | **Tool orchestration semantics:** Parallel batches for **read-only** tools vs **serial** mutating tools; why schema parse failures fall back to serial | planning |
| INS-AP-015 | agent-pack | **Tool-use summaries for UX:** One-line batch labels (commit-subject style) for logs/mobile — optional pattern for future Unstoppable UIs | planning |
| INS-AP-016 | agent-pack | **Post-session skill feedback (experimental):** Optional analysis of invoked project skills to suggest doc tweaks — **privacy and consent** sensitive | deferred |
| INS-AP-017 | agent-pack | **Multi-agent coordination:** Messaging, shutdown handshakes, broadcast patterns — advanced doc only; warn about complexity | planning |
| INS-AP-018 | agent-pack | **Git worktree isolation:** Recipe for parallel or risky agent work in a disposable worktree | planning |
| INS-AP-019 | agent-pack | **Embedded vs dedicated tools:** When to map search to shell `find`/`grep` vs first-class Glob/Grep tools (portable specialist prompts) | planning |
| INS-AP-020 | agent-pack | **Permissions model for tools:** Per-tool rules, per-input keys (e.g. `domain:host`), “suggested allow rule” payloads for UIs | planning |
| INS-WEB-001 | website | **Docs pages** linking CLI + agent-pack capabilities: doctor checks, skill layout (`skill-name/SKILL.md`), and “how agents use the pack” (progressive disclosure) | planning |
| INS-WEB-002 | website | **“Agents & security” hub:** Short pages on web fetch, hooks, MCP consent, redirect safety | planning |
| INS-MONO-001 | monorepo | **Optional agent-pack watch mode:** Debounced rebuild when `packages/agent-pack/src` changes; document Bun/Node watcher caveats (debounce, platform FS quirks) | planning |
| INS-MONO-002 | monorepo | **CLI bundle size discipline:** Lazy schema / deferred loading patterns if the CLI grows large dependencies | deferred |
| INS-MONO-003 | monorepo | **Regression tests for agent-safety utilities:** If we add fetch/hook/url helpers, test SSRF, redirect rejection, header injection | planning |
| INS-MONO-004 | monorepo | **Cron / proactive agents:** Document scheduled or wake-on-event agents only when product supports them | deferred |
| INS-UI-001 | agent | **Streaming markdown rendering:** Monotonic boundary parsing — only re-render the last block per token delta. LRU cache for parsed tokens (500 entries). Fast-path regex to skip lexer for plain text. | implemented |
| INS-UI-002 | agent | **Spinner with elapsed time and stall detection:** Show elapsed time during tool execution, token count after 30s. Grapheme-aware shimmer animation. Smooth RGB interpolation to red on stall. | implemented |
| INS-UI-003 | agent | **Unicode progress bar:** Sub-character precision with 8 block levels (`▏▎▍▌▋▊▉█`). Use for model loading, file operations, scaffold steps. | implemented |
| INS-UI-004 | agent | **Permission dialogs with inline feedback:** Half-bordered prompts (top border only), yes/no/always options, Tab to expand inline text feedback field for accept/reject. | planning |
| INS-UI-005 | agent | **Theme system with shimmer variants:** 6+ themes (dark/light/daltonized/ANSI), auto-detect via OSC terminal background query. Every color token has a lighter shimmer variant for animations. | deferred |
| INS-UI-006 | agent | **Diff rendering for tool results:** Syntax-highlighted diffs with non-selectable gutter (line numbers) and selectable content. WeakMap cache per hunk. | planning |
| INS-UI-007 | agent | **Sub-agent tree display:** Box-drawing chars (`├─`/`└─`), color-coded badges per agent type, tool count and token usage per sub-agent. | planning |
| INS-UI-008 | agent | **Better tool result display:** Progressive disclosure — compact by default (name + duration), expandable on keypress. Truncation with "N more lines" hint. | implemented |
| INS-UI-009 | cli | **Doctor v2 progressive disclosure:** Compact summary by default, Ctrl+O or flag to expand full diagnostics per check. Severity symbols. | planning |
| INS-UI-010 | cli | **Scaffold progress with unicode steps:** Show each scaffold step with progress indicator, elapsed time, and result icon (✓/✗). | planning |

## pi-mono inspiration items (badlogic/pi-mono — lightweight coding agent)

| ID | Package | Improvement | Status |
|----|---------|-------------|--------|
| PI-AGENT-001 | agent | **Differential TUI rendering:** No React/Ink — pure `render(width) → string[]` per component, diff old vs new lines, write minimal ANSI escapes. Synchronized output (`\x1b[?2026h`). ~16ms throttle. Strict width invariant. | planning |
| PI-AGENT-002 | agent | **Event-driven agent architecture:** Agent emits typed events (`turn_start/end`, `message_update`, `tool_execution_*`). Listeners awaited in order. Steering vs follow-up message queues. Clean separation of loop, state, and UI. | implemented |
| PI-AGENT-003 | agent | **Unified streaming protocol:** All providers normalize into `AssistantMessageEvent` union (start/text/thinking/toolcall/done/error) with incremental `partial: AssistantMessage`. One stream interface for all models. | planning |
| PI-AGENT-004 | agent | **File mutation queue:** Serialize write/edit operations per-file (`realpath` keyed) while allowing parallel operations on different files. 39 lines — prevents concurrent edit corruption. | implemented |
| PI-AGENT-005 | agent | **TypeBox + AJV tool schemas:** Tool parameters defined with TypeBox, validated at runtime with AJV. `prepareArguments` hook for pre-validation transforms. Wrapper converts `ToolDefinition` ↔ `AgentTool`. | planning |
| PI-AGENT-006 | agent | **Pluggable tool operations:** Each tool (read, bash, ls, grep, edit, write, find) has an `Operations` interface that can be swapped (local fs → SSH/remote). Same tool, different backend. | planning |
| PI-AGENT-007 | agent | **Structured truncation:** Head-truncate (file reads — show beginning) vs tail-truncate (bash output — show errors at end). Dual limits: line count (2000) AND byte count (50KB), whichever hits first. Never partial lines. | implemented |
| PI-AGENT-008 | agent | **Extension system with hooks:** Extensions loaded from `.pi/extensions/`, define tools, slash commands, flags, keybindings, and lifecycle hooks (`session_start/shutdown`, `before_tool_call`, `before_switch`). TypeBox-validated configs. | planning |
| PI-AGENT-009 | agent-pack | **Coding vs read-only tool sets:** Pre-built sets: `codingTools` (read, bash, edit, write) and `readOnlyTools` (read, grep, find, ls). Document which tools belong in which specialist agent pattern. | implemented |
| PI-AGENT-010 | agent | **Branch summarization + compaction:** Session branching (fork at any user message), with summarization when compacting long branches. JSONL session format with entry IDs and parent pointers. | planning |
| PI-AGENT-011 | agent | **stdout takeover for TUI:** Redirect `process.stdout.write` to `stderr` so TUI owns stdout exclusively. Prevents tool subprocess output from corrupting the display. `output-guard.ts` — 74 lines. | implemented |
| PI-AGENT-012 | agent | **Markdown rendering without React:** `marked.lexer` → themed ANSI lines, cache by text+width, ANSI-aware word wrapping. 824 lines for full terminal markdown. | implemented |
| PI-AGENT-013 | agent | **ANSI-aware text utilities:** `visibleWidth` (grapheme + ANSI escape aware), `wrapTextWithAnsi` (word wrap preserving ANSI state), truncation — 1068 lines of battle-tested terminal text processing. | implemented |
| PI-AGENT-014 | agent | **Session manager with JSONL persistence:** Append-only session log, branching at any entry, cwd tracking per session, import/export. Survives crashes (no transaction needed). | implemented |
| PI-AGENT-015 | agent-pack | **Tool output rendering patterns:** Each tool defines `renderCall` (compact display of tool invocation) and `renderResult` (compact/expanded display of result) alongside execution. Document as recipe. | implemented |
| PI-WEB-001 | website | **HTML session export:** Export conversation to standalone HTML with ANSI-to-HTML conversion, tool result rendering, and embedded CSS/JS template. | deferred |

## Thematic catalog (reference map)

Use this section to see **where ideas come from** in `inspiration/agent-code/` without rereading the tree.

### Session control and UX

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Plan mode | `EnterPlanModeTool`, `ExitPlanMode*`, permission setup | INS-AP-007 |
| Todos / checklist | `TodoWriteTool`, task state keyed by session/agent | INS-AP-006 |
| Structured final output | `SyntheticOutputTool`, Ajv validation path | INS-AP-008 |
| Tool batch labels | `services/toolUseSummary/toolUseSummaryGenerator.ts` | INS-AP-015 |

### Context, cost, and reliability

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Auto-compact | `services/compact/autoCompact.ts`, thresholds, failure circuit breaker | INS-AP-013 |
| Micro-compact / grouping | `services/compact/microCompact.ts`, `grouping.ts` | INS-AP-013 |
| Post-compact cleanup | `postCompactCleanup.ts` | INS-AP-013 |
| Deferred tools + search | `ToolSearchTool`, `utils/toolSearch.ts` | INS-AP-009, INS-AP-002 |
| Tool result size limits | `maxResultSizeChars`, `toolResultStorage` | INS-AP-014 |

### Tools and agents

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Sub-agents | `AgentTool/runAgent.ts`, `loadAgentsDir.ts`, built-in agents | INS-AP-003, INS-AP-017 |
| Specialist prompts | `AgentTool/built-in/exploreAgent.ts`, disallowed tool lists | INS-AP-003, INS-AP-019 |
| Parallel tool runs | `services/tools/toolOrchestration.ts` | INS-AP-014 |
| Worktrees | `EnterWorktreeTool` / `ExitWorktreeTool` | INS-AP-018 |
| Messaging / swarms | `SendMessageTool`, `utils/teammate*.ts`, coordinator (feature-gated) | INS-AP-017 |

### Web, MCP, and integrations

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Web search (provider) | `WebSearchTool` + server tool schema | INS-AP-004 |
| Web fetch | `WebFetchTool`, `utils.ts` (cache, redirects, limits) | INS-AP-004 |
| MCP proxy tool | `MCPTool`, `services/mcp/client.ts` | INS-AP-009 |
| MCP resources | `ListMcpResourcesTool`, `ReadMcpResourceTool` | INS-AP-009 |
| LSP | `LSPTool` | INS-AP-011 |
| Notebooks | `NotebookEditTool` | INS-AP-012 |

### Hooks, automation, and safety

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| HTTP hooks | `utils/hooks/execHttpHook.ts` (allowlist, proxy, timeouts) | INS-AP-010 |
| SSRF guard | `utils/hooks/ssrfGuard.ts` | INS-AP-010 |
| Post-sampling hooks | `postSamplingHooks.ts` | INS-AP-010 |
| Skill improvement hook | `skillImprovement.ts` (feature-gated) | INS-AP-016 |
| Session memory / extract | `services/extractMemories`, `memdir/` | Prior research; extend INS-AP-013 or new doc if we add memory recipes |

### Tasks and background work

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Task framework | `utils/task/framework.ts`, `TaskCreateTool`, disk output | INS-MONO-004 (defer) |
| Cron / remote triggers | `CronCreateTool`, `RemoteTriggerTool` | INS-MONO-004 (defer) |

### UI/UX (inspiration/agent-code)

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Streaming markdown | `Markdown.tsx`, `StreamingMarkdown`, monotonic boundary, LRU cache | INS-UI-001 |
| Spinner / animation | `Spinner/`, `SpinnerAnimationRow`, `GlimmerMessage`, stall detection | INS-UI-002 |
| Progress bar | `design-system/ProgressBar.tsx`, Unicode block chars | INS-UI-003 |
| Permission dialogs | `PermissionDialog.tsx`, `PermissionPrompt.tsx`, inline feedback | INS-UI-004 |
| Theme system | `utils/theme.ts`, `ThemeProvider`, OSC auto-detect, shimmer variants | INS-UI-005 |
| Diff display | `StructuredDiff.tsx`, NAPI, gutter/content split, WeakMap cache | INS-UI-006 |
| Agent tree | `AgentProgressLine.tsx`, `CoordinatorAgentStatus`, box-drawing | INS-UI-007 |
| Tool result UX | progressive disclosure, Ctrl+O expand, truncation | INS-UI-008 |

### UI/UX (pi-mono — lightweight alternative)

| Theme | Reference areas | Unstoppable angle |
|-------|-----------------|-------------------|
| Differential TUI | `pi-tui/tui.ts`, `doRender`, sync output, width invariant | PI-AGENT-001 |
| Event-driven agent | `pi-agent-core/agent.ts`, `agent-loop.ts`, steering/follow-up | PI-AGENT-002 |
| Unified streaming | `pi-ai/types.ts`, `stream.ts`, `AssistantMessageEvent` | PI-AGENT-003 |
| File mutation queue | `tools/file-mutation-queue.ts` (39 lines) | PI-AGENT-004 |
| TypeBox schemas | `pi-ai/utils/validation.ts`, `tool-definition-wrapper.ts` | PI-AGENT-005 |
| Pluggable operations | `*Operations` interfaces per tool | PI-AGENT-006 |
| Truncation | `tools/truncate.ts`, head/tail, dual limits | PI-AGENT-007 |
| Extension hooks | `extensions/types.ts`, lifecycle events | PI-AGENT-008 |
| Markdown in terminal | `pi-tui/components/markdown.ts`, `marked` + chalk | PI-AGENT-012 |
| ANSI text utils | `pi-tui/utils.ts`, `visibleWidth`, ANSI-aware wrap | PI-AGENT-013 |
| Session branching | `session-manager.ts`, JSONL, fork at any entry | PI-AGENT-014 |

## Package-specific notes

### `packages/cli`

- Doctor enhancements should stay **dependency-light** (no requirement for Ink/React); JSON output should remain machine-stable for scripts.
- Any web fetch/search behavior belongs in **documented patterns** or future products, not necessarily in `us` unless we add explicit commands.

### `packages/agent-pack`

- Keep **Unstoppable** terminology and module docs; inspiration file uses different product names — translate patterns, don’t copy prose.
- Sync policy: changes should still flow to **`packages/cli/agent-pack-src/`** when applicable (per `CLAUDE.md`).

### `packages/website`

- Website work here is mostly **documentation and discoverability** for CLI/agent-pack features driven by this backlog.

### Monorepo / tooling

- Watch mode and perf tasks apply to **developer experience** of contributors, not end users of scaffolded apps.

## Next steps

1. Break out **one file per improvement** under `cli/`, `agent-pack/`, `website/`, or `monorepo/` when an item is prioritized.
2. Set status to `reviewing` when the proposal is ready for feedback; `approved` when scheduled.
3. Link completed work in the body (PR URLs) and set status to `implemented` → `done` after release and doc updates.
