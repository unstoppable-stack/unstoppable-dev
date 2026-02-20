# Validation Process

How we turn "docs-only" knowledge into "battle-tested" knowledge.

---

## The Loop

```
1. Build App
   ├── Use the agent pack to scaffold + vibe-code
   ├── Hit real bugs and gaps
   └── Document every fix in research/{app-name}/fixes/

2. Extract Knowledge
   ├── Update modules/ with real API behavior
   ├── Update skills/ with working code examples
   ├── Update recipes/ with validated patterns
   ├── Update components/ with reusable abstractions
   ├── Update core/verified-versions.md with new packages
   └── Add new troubleshooting entries

3. Sync to CLI
   ├── rsync agent-pack/src → cli/agent-pack-src
   ├── Rebuild CLI (pnpm --filter create-unstoppable-app build)
   └── Verify with test scaffold

4. Validate
   ├── Scaffold a fresh project with the CLI
   ├── Vibe-code the same app using ONLY agent pack knowledge
   ├── If it works first try → knowledge is solid
   └── If it fails → go back to step 1
```

---

## Fix Documentation Template

When building an app and finding a gap, create:

```
research/{app-name}/fixes/
├── README.md                    # Index of all fixes
├── 001-{short-name}.md          # Each fix with problem/solution/code
├── FEEDBACK-AGENT-PACK.md       # Summary of what needs updating
└── REUSABLE-ABSTRACTIONS.md     # Reusable patterns extracted
```

Each fix file should contain:
1. **Problem** — What happened, exact error message
2. **Root cause** — Why it happened (API misunderstanding, missing dep, etc.)
3. **Solution** — Working code that fixes it
4. **Agent pack impact** — Which files need updating

---

## Confidence Levels

| Level | Meaning | Criteria |
|-------|---------|----------|
| **Battle-tested** | Code was written, run, and debugged in a real app | Fix docs exist, code is extracted from working source |
| **Docs-validated** | Written from official docs + examples, but not run in our app | No fix docs, code may have subtle issues |
| **Speculative** | Written from limited docs or by inference | High risk of hallucinated APIs or wrong patterns |

---

## Quality Checklist for Agent Pack Content

Before marking a module/skill as "battle-tested":

- [ ] Code examples compile and run (not just look right)
- [ ] Error messages in troubleshooting are real (copy-pasted from terminal)
- [ ] Package versions are pinned and verified in a working package.json
- [ ] Pitfalls/gotchas come from actual mistakes we made
- [ ] The "full-example" resource produces a working app
- [ ] Bare runtime compatibility is checked (no TextEncoder, Buffer, crypto)
- [ ] Pear desktop worker pattern is correctly applied (if relevant)
