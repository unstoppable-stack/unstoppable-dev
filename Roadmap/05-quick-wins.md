# Quick Wins — Improvements Without Building New Apps

These are agent pack improvements that can be done by reviewing existing code
and reference material, without building a brand new app.

---

## 1. Audit Existing Components for Bare Compatibility

**Files:** `components/p2p/swarm-manager.ts`, `components/p2p/replication.ts`,
`components/data/corestore-manager.ts`, `components/data/db-setup.ts`

**Task:** Check for Node.js-only APIs (`crypto`, `Buffer`, `TextEncoder`,
`process` as global) and replace with Bare-compatible alternatives.

**Effort:** Low (1-2 hours)

---

## 2. Review QVAC Recipes Against Research Examples

**Files:** `recipes/qvac-multimodal-vision.md`, `recipes/qvac-transcription.md`,
`recipes/qvac-translation.md`, `recipes/qvac-embeddings-rag-sqlite.md`

**Source:** `research/qvac-examples/`, `research/qvac-docs/`

**Task:** Cross-reference recipe code with the actual QVAC examples in the
research folder. Fix any API mismatches.

**Effort:** Low-Medium (half day)

---

## 3. Extract More from Workbench Reference App

**Source:** `research/qvac-app-workbench-desktop-main/`,
`research/qvac-app-workbench-mobile-main/`

**Task:** These are Tether's official reference apps. Mine them for:
- Additional Pear config patterns
- QVAC model configuration details
- Mobile-specific patterns (from mobile workbench)
- UI patterns (from desktop workbench)

**Effort:** Medium (1 day)

---

## 4. Add Pear Terminal App Guidance

**Task:** The coffee-assistant CLI ran as Node.js, not as a Pear terminal app.
Create a small section in `modules/pear.md` or a mini-skill for Pear terminal
apps (simpler than desktop — no renderer/worker split needed).

**Source:** Pear docs + workbench reference

**Effort:** Low (a few hours)

---

## 5. Validate the "Scaffold and Vibe-Code" Loop

**Task:** Scaffold a fresh project with `create-unstoppable-app`, select Cursor,
and try to build a simple P2P chat using only the agent pack rules. Document
what works, what fails, and what the AI assistant gets wrong.

This is the most important quick win — it tests the whole system end-to-end.

**Effort:** Medium (half day to build, half day to document fixes)

---

## 6. Update core/architecture.md and core/cheatsheet.md

**Task:** These files may reference outdated patterns (pre-worker-bridge). Audit
them against the current state of modules/pear.md and modules/bare.md.

**Effort:** Low (1-2 hours)
