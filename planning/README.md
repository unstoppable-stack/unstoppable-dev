# Planning

All project planning, roadmap, status tracking, and presentation materials.

## Navigation

### Vision (`vision/`)
Original strategy and product direction.

| File | Contents |
|------|----------|
| `overview.md` | Project concept, stack definition, phased roadmap |
| `poc.md` | POC scope — what's in, what's excluded |
| `business-model.md` | Monetization: creator usage fees, user subscriptions |
| `user-flow.md` | End-to-end developer journey |

### Roadmap (`roadmap/`)
Comprehensive coverage tracking — what's battle-tested, what's docs-only, what's not covered.

| File | Contents |
|------|----------|
| `overview.md` | Coverage matrix (54 items across 5 categories), validation approach |
| `completed.md` | Reference apps built, agent pack content created, infrastructure built |
| `platform.md` | Pear Desktop, Pear Terminal, CLI, Mobile (Expo Bare), Electron |
| `qvac.md` | Chat, Vision, Transcription, Translation, TTS, OCR, RAG, Delegated |
| `p2p.md` | Hyperswarm, HyperDHT, SecretStream, Protomux, bare-rpc, storage modules |
| `wdk.md` | Wallet operations, payment flows, integration patterns, subscription model |
| `reference-apps.md` | 7 planned apps (File Sync, Collaborative Notes, Encrypted Chat, etc.) |
| `validation-process.md` | How we turn "docs-only" into "battle-tested" — the feedback loop |
| `quick-wins.md` | Improvements without building new apps |

### Features (`features/`)
Deep planning docs for major features and workstreams.

| File | Contents |
|------|----------|
| `agent-pack.md` | Agent pack v2 architecture: skills, hooks, auto-activation, researcher |
| `website.md` | unstoppable.dev — pages, components, design tokens, partner logos |
| `vault.md` | Unstoppable Vault — personal sync hub, 3 services, discovery protocol |
| `vault-technical.md` | Vault technical architecture — Data Sync, File Sync, AI Provider |
| `mobile-app.md` | Unstoppable Notes — mobile reference app to validate Expo Bare stack |

### Status (`status/`)
Sprint-level tracking — current priorities, next-up tasks, recently completed.

| File | Contents |
|------|----------|
| `README.md` | Workstream overview, coverage summary, priority order |
| `agent-pack-content/` | Per-category status (platform, QVAC, P2P, WDK, build tooling) |
| `agent-pack-architecture/` | Skill system, builders, auto-activation |
| `vault/` | Vault phases and what it validates |
| `website/` | Website pages, sections, components |

### Presentation (`presentation/`)
Pitch deck and speaker materials.

| File | Contents |
|------|----------|
| `deck-outline.md` | Full 32-slide deck outline |
| `deck-short.md` | Short version of the deck |
| `one-pager.md` | One-page summary |
| `short-deck.html` | HTML presentation |
| `speaker-notes.md` | Full speaker notes |
| `speaker-notes-short.md` | Short speaker notes |

## For AI Agents

When the user asks about plans, roadmap, or priorities:

1. **"What's the priority?"** → Start with `status/README.md` for current priorities
2. **"What's the coverage?"** → Check `roadmap/overview.md` for the full matrix
3. **"What should we build next?"** → See `roadmap/reference-apps.md` for planned apps
4. **"Tell me about feature X"** → Check `features/` for deep planning docs
5. **"What's the vision?"** → See `vision/overview.md`
6. **"What's been done?"** → See `roadmap/completed.md`
