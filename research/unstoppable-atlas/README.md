# Planning

This folder contains architectural decisions, feature plans, and project documentation for **Unstoppable Atlas** — a local-first, P2P AI agent network.

## Documents

### Research
| # | Document | Purpose |
|---|----------|---------|
| 01 | [Hyperspace AI Analysis](./01-research-hyperspace-analysis.md) | Deep dive into Hyperspace's architecture, features, and technology |
| 02 | [Competitive Landscape](./02-research-competitive-landscape.md) | Market analysis: Hyperspace vs Bittensor, Akash, Render, and our position |
| 03 | [Gaps & Opportunities](./03-research-gaps-and-opportunities.md) | Weaknesses we exploit, features we add, opportunities beyond Hyperspace |

### Architecture & Design
| # | Document | Purpose |
|---|----------|---------|
| 04 | [System Design](./04-architecture-system-design.md) | Full architecture: layers, apps, data, security, modules |
| 05 | [Feature Matrix](./05-feature-matrix.md) | All 18 features with priorities, details, and implementation notes |
| 06 | [Differentiation Strategy](./06-differentiation-strategy.md) | Five pillars of differentiation, personas, competitive moats |

### Planning
| # | Document | Purpose |
|---|----------|---------|
| 07 | [Roadmap & Implementation](./07-roadmap-implementation.md) | 4-phase roadmap with weekly milestones and task breakdowns |
| 08 | [Adoption Strategy](./08-adoption-strategy.md) | Go-to-market, distribution channels, retention, metrics |

## What Goes Here

- **Architecture decisions** - Record important technical choices and their rationale
- **Feature plans** - Break down features before implementing them
- **Design docs** - Document system design and data flows

## Templates

### Architecture Decision Record (ADR)

Create files like `adr-001-database-choice.md`:

```markdown
# ADR-001: [Decision Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What is the issue we're facing? What do we need to decide?]

## Decision
[What did we decide to do?]

## Consequences
[What are the results of this decision? Pros and cons.]
```

### Feature Plan

Create files like `feature-user-auth.md`:

```markdown
# Feature: [Name]

## Goal
[What are we building and why?]

## User Stories
- As a [user], I want to [action] so that [benefit]

## Technical Approach

### Modules Required
- [Module]: [Why]

### Implementation Steps

#### Phase 1: [Name]
- [ ] Step 1
- [ ] Step 2

#### Phase 2: [Name]
- [ ] Step 1
- [ ] Step 2

## Open Questions
- [Question 1]
- [Question 2]
```

## Tips

1. **Plan before coding** - Use this folder to think through features before implementing
2. **Record decisions** - Future you will thank present you for documenting why choices were made
3. **Keep it lightweight** - Don't over-document, focus on important decisions
