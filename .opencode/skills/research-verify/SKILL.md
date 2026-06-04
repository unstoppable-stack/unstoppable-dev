---
name: research-verify
description: Use when asked to verify, audit, or review agent-pack docs for quality, completeness, and API accuracy.
---

# Verify Agent Pack Quality

## When To Use

Use for requests like "verify agent pack quality" or "audit agent pack docs".

## Expected Structure

- `packages/agent-pack/src/core/`
- `packages/agent-pack/src/modules/`
- `packages/agent-pack/src/recipes/`
- `packages/agent-pack/src/skills/`
- `packages/agent-pack/src/components/`

## Module Checklist

- Overview is specific, not filler.
- Version notes include actual version and date.
- Installation uses the correct package name.
- Quick start is 10-20 lines of verified working code.
- Core concepts include at least 3 items.
- API reference includes TypeScript signatures from `.d.ts` files.
- Integration explains stack relationships.
- Common patterns include at least 2 code examples.
- Pitfalls are real gotchas.
- Resources are valid links.

## Recipe Checklist

- Problem is clear.
- Prerequisites are actual module requirements.
- Solution is step-by-step with code.
- Full example is complete with imports.
- Variations include at least one alternative.
- Troubleshooting has real symptoms and solutions.

## Red Flags

- Generic descriptions or placeholder URLs.
- Code with undefined variables or missing imports.
- Missing `await` on async operations.
- API names inconsistent with package exports.
- Wrong `bare-rpc` API assumptions.
- Missing `tools: true` in QVAC `loadModel()` for tool-calling models.

## Steps

1. Inventory files under `packages/agent-pack/src/`.
2. Compare structure against expected content.
3. Check modules and recipes against the relevant checklist.
4. Cross-reference code examples with source, docs, examples, and reference apps.
5. Report findings with file references and severity.
