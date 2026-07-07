# Pre-Release Execution Plan — Developer Preview Launch

> Companion to `release-review-2026-06-12.md`. That document is the audit;
> this is the to-do list. Work through phases in order — each phase unblocks
> the next.

## Progress (updated 2026-06-21)

Engineering prep is largely done; the remaining gates are owner/account actions.

- ✅ **Phase 2 — Memory decoupled**: `US_FEAT_MEMORY` off in minimal profile;
  `file:` memory dep removed from the CLI (would have broken every global
  install). Memory held for a separate v0.1 preview.
- ✅ **Phase 3 — Versions/metadata/changelog**: CLI bumped to 0.3.0 with a
  build-time `__US_VERSION__` (no more drift) + guard test; CLI `LICENSE`
  added and README/LICENSE in `files`; root `CHANGELOG.md` written. Node /
  node-client already publish-ready with no `file:` deps.
- ✅ **Phase 4 — Docs/copy**: no Memory refs on the site; install commands
  consistent; WDK payments + Unstoppable Agent relabelled "Coming soon";
  website build passes; root status tracker refreshed.
- ✅ **Phase 5 — Smoke gate**: scripted at `scripts/release-smoke.sh` and
  passing both locally and **on a clean machine** (fresh `node:20` Docker
  container, 2026-07-07, 19s). Note: pack on the host (`PACK_ONLY=1`), test in
  the container (`SKIP_PACK=1`) — the repo's node_modules carry host-platform
  native binaries and cannot build inside a foreign-platform container.
- ⏳ **Phase 0 — npm orgs**: NOT done (account action). Claim before publish.
- ⏳ **Phase 1 — Memory MCP fixes**: deferred to fast-follow (Memory excluded).
- ⏳ **Phase 6 — Publish/tag/deploy**: owner action, after the clean-machine run.
- ⏳ **Deferred**: Memory package README/LICENSE files (only needed when Memory
  publishes).

## Locked Decision (proposed)

**One launch: "Developer Preview" = CLI 0.3.0 + Node 0.4.0 npm publish +
website deploy.**

Memory ships as a **separate fast-follow v0.1 announcement** (~1–2 weeks
later), after E2E validation. Memory packages may be published to npm quietly
before then, but they are not part of the launch story and `us memory` is
removed from the minimal CLI profile for 0.3.0.

Rationale:

- Memory is the only piece with zero E2E validation, a likely-broken MCP
  handshake, and a pending security fix. Everything else is gated only on
  mechanical work.
- The launch lives or dies on the clean-machine install. Keep the unvalidated
  daemon out of that critical path.
- Memory as its own announcement is a second marketing beat and the most
  differentiated story in the stack — don't bury it in a launch changelog.

Open decisions that need an explicit owner sign-off (record answers here):

- [ ] Confirm the launch shape above (or override).
- [ ] Real-QVAC Node E2E: recommended posture is **documented external
      blocker** (pending `QVAC_MODEL_SRC`), not a publish gate.
- [x] Naming fallback if the `@unstoppable` npm org is unavailable
      (recommended fallback: publish Memory under `@unstoppable-stack/*`).
      **DECIDED 2026-06 — `@unstoppable` is taken.** Everything publishes
      under `@unstoppable-stack/*`. `@unstoppable/node-client` was renamed to
      `@unstoppable-stack/node-client` across the package, CLI generators,
      tests, READMEs, and changelog; smoke gate re-run and passing. The
      deferred Memory packages (`@unstoppable/memory*`) must be renamed to
      `@unstoppable-stack/memory*` before their fast-follow publish (includes
      `packages/cli/src/commands/memory.ts` which resolves the old name).

---

## Phase 0 — Claim npm names (Day 1, ~30 min) 🔴 do first

Nothing is published yet; the scopes are unverified. Name availability gates
every other naming/docs decision.

- [ ] Create (or confirm access to) npm org **`unstoppable-stack`**.
- [ ] Attempt to create npm org **`unstoppable`**. If unavailable, invoke the
      naming fallback decision above and update Memory package names + docs
      before any further metadata work.
- [ ] Note: the unscoped name `unstoppable-node` is squattable until
      published. If launch slips, consider an early `0.0.1` placeholder
      publish to reserve it.
- [ ] Enable 2FA on the publishing account; decide whether to publish with
      `--provenance` (requires publishing from CI).

## Phase 1 — Memory MCP security & robustness fixes (Day 1–2)

These land before the memory packages are published in any form, even
quietly. All in `packages/memory-mcp/src/server.js` unless noted.

- [ ] **DNS-rebinding/CSRF guard.** Reject requests whose `Host` header is
      not `127.0.0.1:<port>` or `localhost:<port>`, and reject any request
      carrying a foreign `Origin` header. (MCP spec requires Origin
      validation for HTTP transports; without it any webpage can POST
      `text/plain` JSON to the server and write/forget memories.) Add tests
      for both rejection paths.
- [ ] **JSON-RPC notification handling.** Requests without an `id`
      (e.g. `notifications/initialized`) must get `202 Accepted` with an
      empty body — never a response object, never a `-32601` error. This is
      the most likely cause of real-client connection failure today.
- [ ] **Version negotiation.** Echo the client's requested `protocolVersion`
      in the `initialize` result when it's one we support, instead of always
      returning the hardcoded `2025-03-26`.
- [ ] **Port-conflict crash.** Attach an `error` handler to `server.listen`
      so `EADDRINUSE` produces a clean message instead of an unhandled crash.
- [ ] **Health probe in `us memory start`**
      (`packages/cli/src/commands/memory.ts`): after spawning the daemon,
      poll `GET /health` (up to ~3 s) before printing `✓ started`. On
      failure, print the log tail and exit 1. Today a port conflict kills the
      daemon while the CLI reports success.
- [ ] **`forget` transparency** (`packages/memory/src/engine.js` +
      MCP `memory` tool response): include the text of the forgotten memory
      in the result, not just an opaque id — the fuzzy keyword match can
      forget the wrong thing silently.
- [ ] Defer (document, don't fix for v0.1): keyword-only search, Latin-only
      tokenizer (non-Latin memories are unrecallable — add to package README
      known limits), optional bearer-token auth, official MCP SDK adoption
      (evaluate for v0.2).

## Phase 2 — Decouple Memory from the CLI release (Day 2)

- [ ] Flip `US_FEAT_MEMORY: false` in the `minimal` profile in
      `packages/cli/tsup.config.ts` (keep `true` in `full`).
- [ ] Remove `"@unstoppable/memory-mcp": "file:../memory-mcp"` from
      `packages/cli/package.json` dependencies. As published today it would
      break **every** global install. Full-profile builds inside the repo
      still work via the path fallbacks in
      `packages/cli/src/commands/memory.ts` (`resolveServerPath`). When
      Memory rejoins the minimal profile post-launch, re-add it as a semver
      dependency on the published package.
- [ ] Re-run `npm --prefix packages/cli run build:minimal` and verify the
      bundle has no memory chunk and `us memory` is absent from `us --help`.
- [ ] Re-run CLI tests; adjust `src/__tests__/memory-command.test.ts` if it
      assumes minimal-profile inclusion.
- [ ] `npm pack --dry-run` in `packages/cli/`: confirm no `file:` specifier
      remains anywhere in the packed `package.json`.

## Phase 3 — Versions, metadata, changelog (Day 2–3)

- [ ] Bump CLI to **0.3.0** in `packages/cli/package.json`.
- [ ] Replace the hardcoded version in `packages/cli/src/us.ts:22` with a
      build-time constant: add `__US_VERSION__` to the tsup `define` block
      (read from `package.json`), so version drift can't recur. Add/keep a
      test asserting `us --version` matches `package.json`.
- [ ] Add `README.md` (usage + known limits) and `LICENSE` (MIT) to
      `packages/memory/`, `packages/memory-client/`, `packages/memory-mcp/`
      — their `files` arrays already reference both.
- [ ] Replace remaining `file:` deps with semver ranges:
      `memory-mcp → @unstoppable/memory ^0.1.0`,
      `memory-client → @unstoppable/node-client ^0.4.0`.
      (`memory-desktop` is private; its `file:` deps may stay.)
- [ ] Verify `unstoppable-node` and `@unstoppable/node-client` (both 0.4.0)
      are publish-ready per `planning/features/node-v0.4-spec.md`.
- [ ] Write `CHANGELOG.md` covering CLI 0.3.0 and Node 0.4.0 from the release
      commits. Memory gets its own changelog entry at fast-follow time.

## Phase 4 — Docs & copy reconciliation (Day 3–4)

- [ ] Website copy pass: only promise shipped surfaces; Search/Remote/Agent
      messaged as preview/internal; current feature-flag names (`local-ai`,
      `wallet`, `node-sync`); exact install commands
      (`npm install -g @unstoppable-stack/cli`, unscoped `unstoppable-node`).
- [ ] Getting Started page commands must match the clean-machine script in
      Phase 5 verbatim.
- [ ] Static export spot-check: `/docs` + every slug, `/llms.txt`,
      `/llms-full.txt`, nav links, unknown-slug behavior.
- [ ] Refresh `planning/status/README.md` (root tracker) to reflect Node
      v0.4, website docs, this plan, and current test counts.
- [ ] Fix or annotate the CLAUDE.md monorepo claim (pnpm+Turborepo) vs
      reality (no root workspace). Full workspace restoration can be
      post-release, but the doc shouldn't mislead contributors at launch.

## Phase 5 — Release gate: scripted clean-machine install (Day 4)

This is **the** acceptance test, not a checklist line. Script it (e.g.
`scripts/release-smoke.sh`) and run it in a fresh `node:20` Docker container
or a clean macOS user account.

- [ ] `npm pack` each release package; install tarballs globally in
      dependency order.
- [ ] `us --version` → `0.3.0 (minimal)`.
- [ ] `us init test-app` (each AI-assistant choice at least once) → scaffold
      builds and `pnpm dev` boots.
- [ ] `us doctor` passes on the clean machine.
- [ ] `unstoppable-node` install + smoke per the v0.4 spec
      (real-QVAC step per the decision in the header).
- [ ] Acceptance bar: fresh machine → working scaffolded app in **under
      10 minutes, zero errors**. Time it.

## Phase 6 — Publish, tag, deploy (Day 5)

From a clean working tree, after all phases above are checked off.

- [ ] Publish order (each step verified by `npm install` from the registry
      before the next): `@unstoppable/node-client` → `unstoppable-node` →
      `@unstoppable-stack/cli`. Scoped packages need
      `npm publish --access public`.
- [ ] (Optional, quiet) `@unstoppable/memory` → `@unstoppable/memory-mcp` →
      `@unstoppable/memory-client` — only after Phase 1 fixes; no
      announcement.
- [ ] Re-run the Phase 5 script against the **registry** (not tarballs).
- [ ] Tag `cli-v0.3.0` and `node-v0.4.0`; confirm `node-release.yml` /
      `node-publish.yml` workflow behavior matches the tags.
- [ ] Deploy the website; verify `/llms.txt` and Getting Started in
      production.

---

## Fast-follow: Memory v0.1 (week after launch)

Not launch-gating. Tracked here so it isn't lost.

- [ ] E2E with a real MCP client (Claude Code and Cursor) against
      `http://127.0.0.1:8787/mcp`.
- [ ] `us memory start/status/setup-mcp/stop` against a packaged full-profile
      CLI install.
- [ ] Pear Desktop companion via `pear run .`; fix or remove the missing
      `scripts/smoke.js` referenced by `test:smoke` in
      `packages/memory-desktop/package.json`.
- [ ] Node sync against a live Unstoppable Node (not mocked).
- [ ] Memory docs page in `packages/website/src/lib/docs.ts` + `llms.txt`
      entry; document local-HTTP/no-auth posture and keyword-only search.
- [ ] Re-enable `US_FEAT_MEMORY` in the minimal profile; re-add the
      `@unstoppable/memory-mcp` semver dep; ship CLI 0.3.1.
- [ ] Memory CI coverage (extend `cli.yml` or add `memory.yml`).
- [ ] Announce Memory v0.1.

## Post-launch hygiene (no date pressure)

- [ ] Restore a real root workspace (`package.json` +
      `pnpm-workspace.yaml`) or update CLAUDE.md to describe the per-package
      layout; remove the stray `packages/website/pnpm-workspace.yaml`
      `allowBuilds` hack if superseded.
- [ ] Evaluate `@modelcontextprotocol/sdk` for memory-mcp v0.2.
- [ ] Website CI gate (build + static artifact checks).
