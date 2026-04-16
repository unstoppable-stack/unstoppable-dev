# Technical improvements

Backlog and tracking for engineering improvements across the monorepo. Items are **not** sprint commitments until they appear in `planning/status/` or a team agreement says otherwise.

## Layout

| Path | Purpose |
|------|---------|
| This `README.md` | Conventions, status definitions, how to add items |
| `TEMPLATE.md` | Copy this when creating a new improvement doc |
| `inspiration-derived-improvements.md` | Cross-package backlog + **thematic catalog** (maps reference `src/` areas to backlog IDs) |
| `cli/` | Improvements for `packages/cli` (`us`) |
| `agent-pack/` | Improvements for `packages/agent-pack` |
| `website/` | Improvements for `packages/website` |
| `monorepo/` | Tooling, CI, Turborepo, shared configs (not tied to one app package) |

Add one markdown file per improvement (or per small batch of tightly related changes), named `YYYYMMDD-short-title.md` or `AREA-###-short-title.md`.

## Status values

Use the **Status** field in the frontmatter of each improvement document. Allowed values:

| Status | Meaning |
|--------|---------|
| `planning` | Captured idea; problem and scope still being shaped |
| `reviewing` | Written proposal; awaiting feedback or prioritization |
| `approved` | Agreed to implement; no active PR yet |
| `in_progress` | Someone is actively implementing |
| `implemented` | Landed on main (or release branch); may still need docs or verification |
| `done` | Shipped, verified, and any docs/status follow-ups completed |
| `deferred` | Intentionally parked (time, dependencies, or priority) |
| `cancelled` | Will not pursue; note reason in the doc |

Update the status as work moves. When an item reaches `done`, optionally add a one-line pointer to PRs/commits in the doc body.

## Document frontmatter (required)

```yaml
---
id: CLI-001
title: Short human-readable title
package: cli
status: planning
created: 2026-03-31
updated: 2026-03-31
owner: optional-github-handle-or-team
---
```

`package` must be one of: `cli`, `agent-pack`, `website`, `monorepo` (or `multiple` if the file tracks coordinated work).

## Relationship to other planning docs

- **`planning/status/`** — Current sprint priorities and “next up” tasks.
- **`planning/roadmap/`** — Coverage and long-term product direction.
- **`planning/technical-improvements/`** — Durable engineering backlog and design notes that may span releases.

When an improvement here becomes active sprint work, link it from the relevant `planning/status/` file instead of duplicating full specs in both places.

## Inspiration source

Patterns discussed in improvement docs may reference **`inspiration/agent-code/`** (third-party reference tree in the repo). Treat that code as **architectural inspiration only** — do not copy proprietary implementations verbatim.
