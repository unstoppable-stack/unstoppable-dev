---
name: research-writing-guide
description: Use when writing or updating agent-pack module docs and recipe docs under packages/agent-pack/src.
---

# Agent Pack Documentation Writing Guide

## Module Template

```markdown
# [Module Name]

## Overview
[One paragraph - what it does, why use it]

## Version Notes
- Latest version: X.Y.Z (checked YYYY-MM-DD)

## Installation
\`\`\`bash
npm install [package]
\`\`\`

## Quick Start
[10-20 lines minimal working example]

## Core Concepts
- Concept 1: explanation
- Concept 2: explanation

## API Reference
[Key methods with TypeScript signatures from .d.ts files]

## Integration with Other Modules
[How it works with other stack components]

## Common Patterns
[2-3 code snippets]

## Pitfalls & Gotchas
[Real issues]

## Resources
- [Official docs link]
- [GitHub link]
```

## Recipe Template

```markdown
# Recipe: [Task Name]

## Problem
[What you are trying to accomplish]

## Prerequisites
- [Required modules]

## Solution
[Step-by-step with code]

## Full Example
[Complete working code]

## Variations
[Alternative approaches]

## Troubleshooting
[Common issues and fixes]
```

## Rules

- Extract TypeScript types from `.d.ts` files; do not guess.
- Frame decision trees as active directives, for example: "If X, ASK: ...".
- Document model and variant options with tradeoff tables.
- Keep modules <=8KB, recipes <=15KB, and core docs <=12KB.
- Verify code examples against reference apps and local research material.
