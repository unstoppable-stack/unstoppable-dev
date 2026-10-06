---
id: WEB-LAUNCH-001
title: Website improvements before the public developer preview
package: website
status: in-progress
created: 2026-09-18
updated: 2026-09-23
owner:
---

# Website improvements before public launch

## Purpose and scope

The website should help a developer answer four questions quickly: **What can I build? Why would I use this? What works today? How do I start?** It should also give Tether colleagues an understandable demonstration of ecosystem value.

This is the website workstream of the [public launch plan](../20260918-public-launch-plan.md). It keeps the existing Next.js site and visual foundation. It does not require a new hosting provider, CMS, authentication system, full design-system rewrite, or additional product family.

Current observations come from local source reviewed on 18 September and the [9 September assessment](../../status/project-review-2026-09-09.md). The deployed website was not inspected during the planning pass. Effort/priority definitions and owner roles follow the master plan.

## Implementation progress — 23 September 2026

Implemented locally in `packages/website`:

- WEB-01/02: focused positioning, launch-ordered homepage, shared capability maturity data, and unsupported claim removal.
- WEB-03: desktop-first walkthrough pinned to the published CLI, with persistence verification and symptom-based troubleshooting.
- WEB-04: truthful Coffee Assistant case study structure. Public source, a real reviewed screenshot, and transcript remain blocked on the example release package.
- WEB-05/06: task-based docs, matching AI-readable exports, compact roadmap, and support/limitations guidance.
- WEB-07: skip link, active navigation semantics, accessible mobile menu and Escape behavior, copy failure feedback, reduced-motion handling, and mobile docs navigation.
- WEB-08: canonical metadata, social card, favicon, sitemap, robots, and a useful not-found page.
- WEB-09: working ESLint/type/build scripts and a bounded website CI workflow.

Local production build, lint, type checking, desktop visual review, mobile visual review, mobile-menu keyboard dismissal, and mobile docs layout pass. An anonymous check on 23 September returned 404 for the configured GitHub repository, so repository and issue-tracker calls to action were removed from the launch pages. Still required before public deployment: make the source/support destination public and restore verified links; clean-machine command validation for the release artifacts; public Coffee Assistant source and genuine media; supported-browser/automated accessibility review; preview deployment review; package publication sequencing; and rollback validation.

## Recommended message and navigation

**Headline:** Build private apps with local AI and peer-to-peer sync.

**Supporting copy:** Unstoppable Stack gives your AI coding assistant tested starters, implementation guides, and reusable components built around Tether and Holepunch technology.

**Status line:** Developer preview. Start with the verified desktop guide; other capabilities are labeled by maturity.

**Primary action:** Build your first app → `/getting-started`.

**Secondary action:** See the example → `/showcase`.

Keep “Unstoppable Stack” as the name. Explain the user outcome before listing protocols. Present the CLI/agent pack as the way to build, the runtime as reusable app infrastructure, and Personal Node as an optional companion. Mention WDK as a planned/experimental integration until a working payment path is included.

Proposed top navigation: **Get started · Docs · Examples · GitHub**. Relabel `/showcase` as “Examples” without changing its URL for this release. Put Roadmap, release notes, support, privacy, and limitations in the footer or docs. Do not publish a GitHub action that leads anonymous users to an inaccessible repository.

## WEB-01 — Reconcile positioning and claims across every surface

**P0 · Product + Web · S · Depends on PRJ-01**

Create a content inventory covering homepage sections, navigation, footer, metadata, rotating prompts, quickstart, docs, roadmap, and generated AI-readable documents. For each capability claim, record its actual maturity and the evidence supporting it.

Specific corrections:

- Replace the broad promise of P2P + AI + crypto + search + Personal Node with the focused launch message.
- Remove or qualify “under two minutes” and “zero errors” until representative measurements support them.
- Remove unvalidated wallet/mobile/health examples from the rotating homepage prompt list. Prefer a single reproducible example initially.
- Replace blanket “no infrastructure costs” language with “no mandatory application backend” and explain model downloads, peer availability, and optional services in the FAQ.
- Reconcile claims of automatic pairing with actual approval/invitation behavior.
- Update page descriptions and footer text as well as visible headline copy; search snippets must not advertise features the page labels planned.
- Use factual “Built with Tether and Holepunch technology” attribution without implying an endorsement or formal relationship that has not been established.

**Acceptance:** a reviewer can map each prominent claim to a shipped feature, measured result, or explicit planned label. No unsupported capability appears as a default benefit in metadata or animations.

**Files:** `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/footer.tsx`, `src/components/typing-prompt.tsx`, and affected documentation data.

## WEB-02 — Restructure the homepage around one outcome

**P0 · Web + Product · M · Depends on WEB-01; final assets on PRJ-09**

Use the following order. Keep the existing typography, spacing system, and dark/accent palette unless usability testing exposes a problem.

| Section | Required content | Visitor takeaway |
| --- | --- | --- |
| Hero | Clear headline, one explanatory paragraph, preview label, two actions | I know what this is and where to start |
| Working example | Real app screenshot, short caption, demo link, source link | I can see what it produces |
| Three benefits | Local data; on-device AI; direct peer communication | I understand practical value |
| How to build | Configure assistant → scaffold/run → extend the app | I understand the workflow |
| What is included | CLI/agent pack, runtime, optional Personal Node | The components have distinct jobs |
| What works today | Compact support/maturity table with verification date | I know what I can rely on |
| FAQ | Offline requirements, hardware, assistants, Node optionality, payments, limitations | Common objections are answered honestly |
| Final action | Link to the same recommended quickstart | I have one clear next step |

Move the exhaustive module grid and detailed runtime topology into documentation. Remove promotional cards for Search, the custom Agent, and other excluded products from the primary conversion path. Keep research ideas discoverable through the roadmap.

If including an install snippet in the hero, source its version/tag from the release manifest and label exactly what it does. Do not make a blank-workspace command look like a running-app command. Do not show both global and one-off install variants above the fold.

**Acceptance:** in a short comprehension test, three colleagues can independently state what the product does, who it is for, what is optional, and where to start. The first viewport contains one clear primary action and no unsupported promise.

## WEB-03 — Rewrite Getting Started as an executable walkthrough

**P0 · Web + Runtime · M · Depends on PRJ-02/03/04/08**

Default to the supported desktop path. The first success should not require Personal Node, payment setup, or choosing from every platform/feature combination.

The page should contain these steps in order:

1. **Check prerequisites:** exact tested OS/architecture and runtime; required desktop tools; free disk/RAM guidance from real measurements; model download expectation. Separate required from optional.
2. **Install the release:** one exact candidate version or intended preview tag, verified anonymously. Show how to confirm the installed version.
3. **Configure the assistant workspace:** explain that `us init` writes assistant guidance. Show where to open the workspace.
4. **Create the app:** supply the actual tested prompt or scaffold command, with a project name and supported features. State the generated folder and files.
5. **Install and run:** show commands from the correct application folder, expected output, and a screenshot of success. Mark model downloading/loading separately from app failure.
6. **Make one change:** a small prompt, such as changing how an order is displayed, with an observable expected result. This demonstrates the agent pack's purpose.
7. **Verify persistence and local operation:** restart the app; confirm saved data; run local inference offline after model installation.
8. **Continue optionally:** add a peer or Personal Node through separate documentation with explicit trust and availability requirements.

Keep the manual CLI route available, but place it after the default flow or behind an accessible switch. The current switch defaults to local AI plus Node sync, which introduces extra dependencies before the first success; simplify it. Ensure the manual route states whether assistant guidance is included or must be initialized separately.

Add troubleshooting for unsupported runtime, missing Pear tooling, install failure, unavailable package, model download failure, insufficient resources, and a missing optional Node. Each entry needs a recognizable symptom, one diagnostic step, and one recovery action. Never suggest broad destructive cleanup as the default remedy.

Remove the obsolete `p2p,kv-storage` flags. Correct the description of the Node CLI runtime to match the actual generator. Don't imply multi-writer and Node sync can be combined while the CLI rejects that combination.

**Acceptance:** a clean-machine run copies the page verbatim and reaches real local inference and persistence without author assistance. No step assumes a previously installed global binary, private registry credential, or repository checkout. Copy buttons copy commands without prompt decorations or explanatory prose.

## WEB-04 — Publish one credible example page

**P0 · Product + Web · M · Depends on PRJ-09**

Replace “Coming Soon” with one first-party reference app. Use the maintained Coffee Assistant example from the master plan. Do not wait for outside community submissions.

Required content: screenshot; a two-sentence use case; capability labels; tested version/platform; short video or image sequence; source and run instructions; a brief account of the integration problems the toolkit resolves; and known limitations. Identify mock versus real inference wherever relevant.

Suggested case-study structure: **what it does → how it is built → what was learned → reproduce it**. Explain renderer/worker or runtime problems in one approachable example, with technical detail linked separately. Label historical prompt-count results as one internal experiment and disclose conditions; omit unsupported general performance claims.

Use a lightweight poster and click-to-play video with captions or a transcript. Do not autoplay a large recording on page load. Source links and assets must be accessible without internal accounts.

**Acceptance:** a visitor can watch the outcome, inspect the matching source, and reproduce the same release. All images are of the real app. The page does not present a first-party demo as independent adoption.

## WEB-05 — Make documentation match the released architecture

**P0 for launch-path accuracy · Web + Runtime · M · Depends on PRJ-01/08/10**

Recommended documentation groups:

| Group | Content |
| --- | --- |
| Start | Quickstart, support matrix, environment checks, troubleshooting |
| Build | Project structure, assistant workflow, local storage, local AI |
| Connect | P2P basics, trusted pairing, sync, optional Personal Node |
| Reference | CLI commands, runtime/capability API, version compatibility |
| Operate | Limitations, data retention/export, upgrades, support/security reporting |

Replace removed node-client APIs in current guidance; retain migration context where useful. Explain identity, approval, networking, and sync only as deeply as required by the page's task. Link to upstream API documentation instead of copying entire SDK manuals.

Create one shared release/support data source for versions, commands, maturity labels, and the public repository URL. Keep it small. Human docs and `/llms.txt`/`/llms-full.txt` must describe the same release. Avoid independent copies of feature lists scattered across page components.

Add “verified with” metadata to maintained examples, meaningful headings/anchors, a compact mobile docs navigation, and a route to report a documentation problem. Full-text search and a CMS can wait until navigation proves insufficient.

**Acceptance:** no launch page references a removed API, unavailable dependency, contradictory platform promise, or unsupported feature combination. Every default command has an executable validation fixture. AI-readable exports agree with visible docs.

## WEB-06 — Simplify roadmap and explain trust, support, and limitations

**P0 for truthful limitations; P1 for presentation polish · Product + Web · S–M · Depends on PRJ-01/05/06/11**

Replace the long internal workstream inventory with three groups: **Available in this preview**, **Being validated**, and **Later**. Link included items to released artifacts or docs. Avoid percentages and “shipped” labels without a clear denominator/version. Show the last review date. Keep internal sprint detail in the repository.

Add a support/limitations document covering model downloads, local storage locations, peer connectivity, settings exports, retained copies, what logs contain, and where to seek help. Explain that remote inference sends input to the selected trusted device. Distinguish application data handling from the developer's chosen coding assistant and from website hosting.

List what the project collects based on implementation. If no project telemetry is added, state that precisely without claiming the hosting provider keeps no request logs. Make any future analytics choice explicit. Do not introduce accounts, mailing lists, or tracking just to launch.

**Acceptance:** a user can find support and understand what happens to data during local inference, delegated inference, sync, disconnect, and export. Roadmap entries cannot reasonably be confused with usable features.

## WEB-07 — Complete usability and accessibility checks

**P0 for navigation/reading/copy blockers; P1 for remaining polish · Web · M · Depends on page drafts**

Source-level fixes to include:

- Give the mobile menu an accessible name, expanded state, and controlled-region association; support Escape and sensible focus behavior.
- Name icon-only GitHub links and other controls.
- Add a skip-to-content link, visible keyboard focus, active-page semantics, and logical heading order.
- Handle clipboard rejection with a useful fallback; announce copy success/failure accessibly.
- Keep command blocks and tables horizontally scrollable without making the whole page overflow.
- Make the onboarding route switch understandable by keyboard and assistive technology.
- Respect reduced-motion preferences and ensure animated text does not cause distracting layout shifts or repeated announcements. A static real example is acceptable.
- Ensure docs navigation does not push the article far below the initial mobile viewport.

Check small mobile, tablet, and desktop widths; keyboard-only navigation; text zoom; contrast; long code samples; and video transcript access. Test the real supported browsers selected for the site. Use automated accessibility checks plus manual interaction, without treating a score as proof of full accessibility.

**Acceptance:** all primary journeys are usable by keyboard; controls have meaningful names; focus remains visible; no critical/serious automated findings remain unreviewed; and mobile readers can reach content and copy commands without layout obstruction.

## WEB-08 — Add release-ready metadata, assets, and loading behavior

**P1 · Web · S–M · Depends on WEB-01/04**

Set accurate titles/descriptions, canonical URLs, social previews, favicon, sitemap, and robots behavior for the chosen production URL. Verify preview environments do not leak into canonical links or get indexed accidentally. Include a useful not-found route.

Use one recognizable project mark; verify permitted attribution before adopting third-party branding. Do not block a launch on a complex logo commission. Prefer genuine app screenshots and a simple social card over unrelated promotional illustration.

Optimize screenshot dimensions/formats, reserve image space, and load video on demand. Establish a repeatable mobile performance baseline on the production-like build. Investigate large regressions and unnecessary client code. Performance budgets are targets agreed during implementation, not claims of measurements made in this plan.

**Acceptance:** shared links display accurate preview text/images; canonical/sitemap URLs resolve; no empty or missing assets appear; the first useful page content is available without waiting for animation or video; and no substantial unexplained layout shift appears in the tested journey.

## WEB-09 — Validate and deploy the website as part of the release

**P0 · Web + Release · M · Depends on PRJ-02/09/11/12 and applicable WEB tasks**

Add a bounded site check to CI covering production build, functioning lint/type checks, important routes, internal links, and the main interactive controls. Confirm the existing lint script actually runs with the installed toolchain and correct it if needed. Add meaningful tests for navigation, code copying, and route selection; avoid snapshots of every paragraph.

Treat command validation as a separate executable check. A successful website build does not prove an installation example works. Test default commands against release artifacts in a clean environment, then run the public-registry version after publication. Keep external-link verification targeted; handle transient upstream failures without permanently ignoring broken links.

Retain the current suitable hosting setup. Prepare a preview deployment for content/device review and a rollback to the last working deployment. Publish the matching package line before switching users to its quickstart. Verify anonymously: homepage actions, repository/example visibility, supported installation, docs, support links, and social preview assets.

**Acceptance:** website and packages tell the same versioned story; all primary routes/actions work in production; default commands run; GitHub/example links are public; and the previous deployment can be restored if needed.

## Page and file map

Paths below are relative to `packages/website/` and identify implementation areas, not files already changed by this plan.

| Area | Existing files | Tasks |
| --- | --- | --- |
| Homepage | `src/app/page.tsx`, `src/components/typing-prompt.tsx` | WEB-01/02 |
| Onboarding | `src/app/getting-started/page.tsx`, `src/components/scaffold-path-switch.tsx` | WEB-03 |
| Examples | `src/app/showcase/page.tsx` | WEB-04 |
| Docs and AI exports | `src/lib/docs.ts`, `src/components/docs-shell.tsx`, `src/app/docs/`, `src/app/llms.txt/`, `src/app/llms-full.txt/` | WEB-05 |
| Roadmap | `src/app/roadmap/page.tsx` | WEB-06 |
| Shared usability | `src/components/navbar.tsx`, `footer.tsx`, `code-block.tsx`, `src/app/globals.css` | WEB-07 |
| Metadata and assets | `src/app/layout.tsx`, `public/`, new metadata routes as needed | WEB-08 |
| Build/release checks | `package.json`, repository CI and existing deployment configuration | WEB-09 |

## Content and asset handoff

- [ ] Release manifest and verified support matrix from PRJ-01/10.
- [ ] Exact install/scaffold commands and expected outputs from PRJ-02/03.
- [ ] Real-model requirements and limitations from PRJ-04.
- [ ] Trust/replication/export wording from PRJ-05/06.
- [ ] Public example source, screenshot, video/transcript, and case-study notes from PRJ-09.
- [ ] Public repository, license, support/security, and release-note destinations from PRJ-11.
- [ ] Pilot feedback and corrected confusing steps from PRJ-12.

The website can be drafted before these assets arrive, but final copy must not invent evidence or present planned functionality as demonstrated.

## Success measures and scope protection

Measure comprehension and successful onboarding first. Proposed targets are three of three pilot participants understanding the product and completing the default journey, zero broken primary links/commands, and no undocumented author intervention. Record time and failure points separately; do not publish a time guarantee from this small sample.

After launch, track recurring support questions and voluntarily reported successful builds. Optional aggregate website analytics may help later, but are not a launch dependency. Avoid collecting prompts, wallet details, identities, or app data for marketing metrics.

Defer a theme rewrite, interactive architecture simulator, account system, community directory, full-text docs search, localization, content marketing program, and marketing pages for unshipped products. Revisit them when actual usage identifies a need.
