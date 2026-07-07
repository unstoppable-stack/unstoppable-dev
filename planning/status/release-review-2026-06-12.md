# Release Review Handoff - 2026-06-12

> Purpose: give a reviewer a single place to understand what is intended to
> release, what is already working, and what must be resolved before tagging or
> publishing.

## Executive Summary

The current branch has enough working pieces for a release review, but it should
not be tagged or published until the release shape is confirmed.

There are three release narratives in the repository:

- The existing v0.3.0 launch plan in `planning/presentations/2026-05-v0.3.0-launch/deck.html`, focused on CLI build profiles, mobile generator work, QVAC 0.11 agent-pack alignment, and the Unstoppable Node full slice.
- The initial public launch review in `planning/presentations/2026-05-initial-launch-review/deck.html`, focused on the developer-preview story: ship the CLI, Node, website, and install/demo path with conservative messaging.
- The Node v0.4 developer-preview plan in `planning/features/node-v0.4-spec.md`, focused on publishing `unstoppable-node` and `@unstoppable/node-client` after Bare smoke, publish prep, discovery fixes, and real-QVAC validation.
- Newer June work in the current working tree: Unstoppable Memory packages and CLI command, generated website docs, `llms.txt` exports, OpenCode docs hygiene, and a draft Node v0.5 API/resource review.

Recommended review decision: treat Website docs as release-ready, treat Memory as
a v0.1 release candidate, and do not fold Memory into the older v0.3.0 release
without explicitly updating versioning, dependency strategy, changelog, and the
publish order.

## Current Release Scope Under Review

| Area | Intended release content | Current status | Release posture |
| --- | --- | --- | --- |
| CLI v0.3 plan | Minimal build profile, slim published tarball, Node command, scaffold/doctor/init surfaces, older mobile and agent-pack work from the launch deck | Builds and tests pass locally, but `packages/cli/package.json` and `src/us.ts` still report `0.2.0` | Not ready to tag as v0.3.0 until version/changelog gates are done |
| Initial public launch | Website + CLI + Node developer-preview story, clean install instructions, demo path, conservative claims for Search/Agent/payments | Planning deck exists, but messaging/version status is not reconciled with current docs and packages | Not ready for external launch until copy, versions, changelog, npm packages, and clean-machine install are aligned |
| Node v0.4 publish | Publishable `unstoppable-node` and `@unstoppable/node-client` developer preview | v0.4 spec marks 19/20 features done or preview-done; real-QVAC E2E is blocked, publish prep is done, actual publish is not done | Separate publish track, not complete until version bump, semver package links, real-QVAC decision, and npm publish |
| Unstoppable Memory v0.1 | `@unstoppable/memory`, `@unstoppable/memory-client`, `@unstoppable/memory-mcp`, private Pear desktop companion, and `us memory` CLI lifecycle commands | Unit tests pass and package dry-runs succeed | Release candidate, blocked on package metadata/dependency strategy and E2E validation |
| Website docs foundation | Generated docs pages, docs sidebar, `/llms.txt`, `/llms-full.txt`, updated Getting Started scaffold path switch, website status tracker update | Production build passes and static docs routes are generated | Ready after reviewer content/visual pass |
| Unstoppable Node | Current status doc says Node v0.4 batch is built: TOFU approval, headless daemon, `us node`, typed errors, status RPC, reconnect, disk usage, live AI toggle, pause/resume, data peek | Existing status says tests passed previously; not rerun in this review | Already a release pillar, but publish remains deferred |
| Node v0.5 API/resource direction | `planning/features/node-api-database-review.md` captures resource/capability API recommendations | Draft planning artifact only | Review artifact, not runtime release scope |
| OpenCode docs hygiene | `.opencode/instructions.md` now tells agents which docs/status files to update when behavior changes | Documentation-only update | Ready after reviewer check |

## What Is Working Now

### Memory

The Memory release candidate includes a local-first Hyperbee-backed memory engine
in `packages/memory/` with document add/update, keyword search, soft forget,
profile generation, project listing, and Node registration metadata.

`packages/memory-mcp/` exposes that engine through a local HTTP JSON-RPC style
MCP surface:

- Tools: `memory`, `recall`, `whoAmI`, `listProjects`.
- Resources: `unstoppable-memory://profile`, `unstoppable-memory://projects`.
- Prompt: `context`, which instructs assistants to save useful user facts.

`packages/memory-client/` adds `connectMemoryToNode()`, which serves the memory
core over Hyperswarm and registers it with the local Unstoppable Node using the
existing `@unstoppable/node-client` pairing path.

`packages/memory-desktop/` is a private Pear Desktop companion app. It provides a
simple UI to save memories, search, view profile/projects, show MCP config, start
the MCP server, and show Node sync status. It is private and should be treated as
a companion app, not an npm package.

`packages/cli/src/commands/memory.ts` registers:

- `us memory start`
- `us memory status`
- `us memory stop`
- `us memory setup-mcp`

The minimal CLI profile now includes both `US_FEAT_NODE` and `US_FEAT_MEMORY`.

### Website

The website docs work moves `/docs` from one large hand-written page to a
generated multi-page docs system backed by `packages/website/src/lib/docs.ts`.
The docs include overview, quickstart, CLI, platform pages, Node, modules,
agent-pack, and recipes.

The site now also exports AI-readable docs:

- `/llms.txt`
- `/llms-full.txt`

`packages/website/src/app/getting-started/page.tsx` now includes a
manual-vs-agent scaffold path switch through
`packages/website/src/components/scaffold-path-switch.tsx`.

## Verification Performed

All checks below were run locally on 2026-06-12.

| Check | Result |
| --- | --- |
| `npm --prefix packages/memory test` | Pass: 6 tests |
| `npm --prefix packages/memory-client test` | Pass: 3 tests |
| `npm --prefix packages/memory-mcp test` | Pass: 4 tests |
| `npm --prefix packages/memory-desktop test` | Pass: 5 tests |
| `npm --prefix packages/website run build` | Pass: Next.js production build, 19 static pages generated |
| `npm --prefix packages/cli test -- src/__tests__/memory-command.test.ts` | Pass: 4 tests |
| `npm --prefix packages/cli run build:minimal` | Pass: minimal profile includes `node` and `memory` chunks |
| `npm --prefix packages/cli test` | Pass: 227 tests, 14 skipped |
| `npm pack --dry-run` in `packages/cli/` | Pass: tarball generated as `@unstoppable-stack/cli@0.2.0` |
| `npm pack --dry-run` in `packages/memory/` | Pass: tarball generated as `@unstoppable/memory@0.1.0` |
| `npm pack --dry-run` in `packages/memory-client/` | Pass: tarball generated as `@unstoppable/memory-client@0.1.0` |
| `npm pack --dry-run` in `packages/memory-mcp/` | Pass: tarball generated as `@unstoppable/memory-mcp@0.1.0` |

## Release Blockers

1. Release naming is not decided.

   The launch deck says v0.3.0 is the next release, but the current branch also
   adds Memory v0.1 and website docs work that are not part of that May launch
   narrative. A reviewer should decide whether this is:

   - v0.3.0 with only the original CLI/Node/mobile/agent-pack scope.
   - v0.3.0 plus Memory and docs.
   - A later release, with Memory called out as a separate v0.1 preview.

2. CLI versioning still says `0.2.0`.

   `packages/cli/package.json` is `0.2.0`, and `packages/cli/src/us.ts` hardcodes
   `0.2.0 (${__US_BUILD_PROFILE__})`. The CLI dry-run tarball is therefore
   `unstoppable-stack-cli-0.2.0.tgz`, not v0.3.0.

3. Local `file:` dependencies must be resolved before npm publishing.

   Current package metadata uses local file dependencies:

   - `packages/cli/package.json` depends on `@unstoppable/memory-mcp` via `file:../memory-mcp`.
   - `packages/memory-mcp/package.json` depends on `@unstoppable/memory` via `file:../memory`.
   - `packages/memory-client/package.json` depends on `@unstoppable/node-client` via `file:../node-client`.
   - `packages/memory-desktop/package.json` depends on local Memory and Node packages, but that package is private.

   Before publishing, either publish the dependent packages in order and replace
   these with semver ranges, or intentionally bundle/vendor the runtime pieces.

4. Publishable Memory packages list missing files.

   The Memory package `files` arrays include `README.md` and `LICENSE`, but there
   are no `README.md` or `LICENSE` files in the new Memory package directories.
   `npm pack --dry-run` still succeeds, but the release would ship without usage
   docs or license files.

5. Memory has not had end-to-end product validation yet.

   Unit tests pass, but these release checks are still missing:

   - Build and globally install the CLI, then validate with the real `us` command.
   - Run `us memory start/status/setup-mcp/stop` against the packaged CLI.
   - Connect a real MCP client to `http://127.0.0.1:8787/mcp`.
   - Run the Pear Desktop memory app with `pear run .`.
   - Validate Node sync against a running Unstoppable Node, not just a mocked client.

6. Website docs need reviewer content/UX pass.

   The site builds, but the generated docs are still foundational. Deep module
   docs, stable code examples, real logos, SEO metadata, and showcase content
   remain tracked follow-up work in `planning/status/website/README.md`.

7. Existing v0.3.0 launch checklist still has open gates.

   The deck lists these remaining gates before publishing:

   - Bump `packages/cli/package.json` to `0.3.0`.
   - Write `CHANGELOG.md` from the release commits.
   - Verify `us --version` reports `0.3.0 (minimal)`.
   - Run `npm pack --dry-run` in `packages/cli/`.
   - Optional: run mobile `--device` E2E on a real iPhone.
   - Tag `v0.3.0` and publish.

8. Initial public launch checklist is not reconciled with current files.

   The initial launch review calls out launch-level gates that overlap with, but
   are not identical to, the CLI release checklist:

   - Fix CLI version mismatch.
   - Clean website copy and README claims so they only promise shipped surfaces.
   - Use current feature flags (`local-ai`, `wallet`, `node-sync`) instead of stale flags.
   - Document exact install commands for the scoped CLI and unscoped Node packages.
   - Add launch changelog.
   - Publish npm packages, deploy the website, and run a clean-machine install test.

9. Node v0.4 publish remains a separate release gate.

   `planning/features/node-v0.4-spec.md` marks the developer-preview scope mostly
   complete, but actual npm publish is not done. The remaining release questions
   are package version bumps, published semver dependencies instead of local
   `file:` links, release workflow/tag behavior, and whether real-QVAC E2E is a
   hard gate or an explicitly documented external blocker.

10. Root planning status is stale compared with subsystem trackers.

   `planning/status/README.md` still says it was last updated on 2026-04-22 and
   does not reflect the Node v0.4 batch, June website docs, current Memory work,
   or updated test counts. Reviewers should trust subsystem docs and this handoff
   over the root status summary until it is refreshed.

11. Memory is not wired into the broader workspace or CI graph.

   There is no root `package.json` in this checkout, no root workspace file
   covering the Memory packages, and no CI workflow that runs the Memory package
   tests. `packages/memory-desktop/package.json` also defines
   `test:smoke: node scripts/smoke.js`, but `scripts/smoke.js` is missing.

12. Website validation should include static artifact spot checks.

   `npm --prefix packages/website run build` passed, but a release reviewer
   should still inspect the generated export for `/docs`, all static doc slugs,
   `/llms.txt`, and `/llms-full.txt`, and spot-check nav links plus unknown slug
   behavior. There is no website CI gate.

## Known Limits To Accept If Shipping

- Memory search is keyword/scored text search only. There are no embeddings,
  vector index, summarization, or deduplication beyond custom document updates.
- The Memory MCP server is local HTTP on `127.0.0.1`; it does not implement auth,
  multi-user isolation, TLS, or remote access. That may be acceptable for local
  preview, but should be explicit in docs.
- `us memory start` starts a background process and writes pid/meta/log files,
  but release validation has not yet proven packaged startup, health probing,
  port conflict handling, or log behavior under real user installs.
- `unstoppable-memory-desktop` is private and not publishable to npm. Any desktop
  release needs a separate Pear distribution decision.
- WDK/payments remain out of scope.
- Showcase remains placeholder content.
- Node v0.5 capability/resource API is a planning direction only, not shipped
  behavior.
- Search, Remote Coder, and Unstoppable Agent should be messaged as preview or
  full-profile/internal surfaces unless the launch owner explicitly promotes
  them for the public launch.

## Reviewer Checklist

Before approving release, the reviewer should answer:

- Which release is being approved: CLI v0.3.0, Node v0.4, initial public launch,
  Memory v0.1 preview, or a combined release?
- Is Memory in this release, or should it be held as a separate v0.1 preview?
- Should Memory package names use `@unstoppable/*`, while the CLI uses
  `@unstoppable-stack/*`, or should naming be aligned before publish?
- Should `us memory` be included in the minimal CLI profile, or only in the full
  profile until Memory has more E2E coverage?
- Is local unauthenticated HTTP acceptable for the initial Memory MCP release?
- Are keyword-only memories acceptable for v0.1, with embeddings/RAG deferred?
- Does the release need a real Pear Desktop distribution path, or is the desktop
  companion a repo-local preview?
- Is real-QVAC Node E2E required before Node v0.4 publish, or can it remain a
  documented blocker pending `QVAC_MODEL_SRC`?
- Should root status be refreshed before this handoff goes to another reviewer?
- Should the Node v0.5 API review be included as planning documentation in the
  release, or kept out of release notes?

## Recommended Remaining Work

1. Decide release shape and version.

   Pick one explicit target: original v0.3.0, v0.3.0 plus Memory/docs, or a newer
   release with Memory as v0.1 preview.

2. Fix package metadata.

   Update versions, replace publish-blocking `file:` dependencies, add package
   READMEs and license files, and decide publish order for Memory and Node
   packages.

3. Write release notes.

   Create `CHANGELOG.md` or package-level release notes covering CLI/Node/docs
   and, if included, Memory.

4. Run product E2E checks.

   Validate the globally installed `us` command, Memory MCP with a real MCP
   client, Memory desktop via Pear, and Node sync against a live Node.

5. Do a reviewer pass on public docs.

   Check docs navigation, generated content accuracy, Getting Started copy,
   `llms.txt` content, and whether Memory needs public docs before it ships.

6. Refresh planning/status alignment.

   Update `planning/status/README.md` so the root tracker reflects Node v0.4,
   website docs, current release gates, and the correct test counts.

7. Tag and publish only after gates are closed.

   The final publish should happen from a clean working tree with status docs and
   release notes matching the exact packages being shipped.

## Key Files For Review

- `planning/presentations/2026-05-v0.3.0-launch/deck.html`
- `planning/presentations/2026-05-initial-launch-review/deck.html`
- `planning/status/README.md`
- `planning/status/website/README.md`
- `planning/status/node/README.md`
- `planning/features/node-v0.4-spec.md`
- `planning/features/node-api-database-review.md`
- `packages/cli/package.json`
- `packages/cli/src/us.ts`
- `packages/cli/tsup.config.ts`
- `packages/cli/src/commands/memory.ts`
- `packages/cli/src/__tests__/memory-command.test.ts`
- `packages/memory/package.json`
- `packages/memory/src/engine.js`
- `packages/memory/test/engine.test.js`
- `packages/memory-client/package.json`
- `packages/memory-client/src/node-sync.js`
- `packages/memory-mcp/package.json`
- `packages/memory-mcp/src/server.js`
- `packages/memory-desktop/package.json`
- `packages/memory-desktop/lib/memory-host.js`
- `packages/website/src/lib/docs.ts`
- `packages/website/src/app/docs/page.tsx`
- `packages/website/src/app/docs/[...slug]/page.tsx`
- `packages/website/src/app/llms.txt/route.ts`
- `packages/website/src/app/llms-full.txt/route.ts`
- `packages/website/src/components/docs-shell.tsx`
- `packages/website/src/components/scaffold-path-switch.tsx`
- `.opencode/instructions.md`
