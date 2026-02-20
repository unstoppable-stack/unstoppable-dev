# Sandbox

Apps built using `create-unstoppable-app` for testing and feedback. This folder is **gitignored** but intentionally accessible to AI agents.

## Purpose

Each subfolder is a project scaffolded with the CLI, used to:

1. **Validate the CLI** — Does scaffolding work correctly?
2. **Test the agent pack** — Are rules, skills, and recipes effective?
3. **Collect feedback** — What went well? What needs improvement?

## Structure

Each test app should include a `FEEDBACK.md` at its root:

```
sandbox/
├── my-test-app/
│   ├── FEEDBACK.md          # What worked, what didn't, improvement ideas
│   ├── src/                  # The scaffolded app
│   ├── package.json
│   └── ...
└── another-test/
    ├── FEEDBACK.md
    └── ...
```

## FEEDBACK.md Template

```markdown
# Feedback: <app-name>

## Setup
- **CLI version**: x.x.x
- **Template**: blank / ...
- **Assistant**: cursor / claude / opencode
- **Date**: YYYY-MM-DD

## What Worked
- ...

## Issues Encountered
- ...

## Agent Pack Gaps
- Missing skill for ...
- Recipe for X was unclear about ...

## Suggestions
- ...
```

## For AI Agents

When improving the agent pack:

1. Scan `sandbox/*/FEEDBACK.md` for recurring issues
2. Cross-reference gaps with `packages/agent-pack/src/skills/`
3. Prioritize fixes that affect multiple test apps
4. After fixing an issue, re-test by scaffolding a new app here
