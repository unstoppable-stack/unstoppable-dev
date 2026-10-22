# Unstoppable desktop UI kit

Use the **Unstoppable Control** visual system from the Personal Node desktop
app for US-related app UI. Read the workspace's
`.unstoppable/guidance/core/design-guide.md` and `ui-tokens.json` first.
Explicit user design choices override this default.

## Start from generated assets

Scaffolded desktop apps already own:

- `app/theme.css`: semantic light/dark color roles and panel radius.
- `app/styles.css`: compact top bar, navigation, content, panels, controls,
  results, chat, and responsive rules.
- `app/shell.js`: real section anchors and navigation selection state.

Extend those files. Do not add React, styled-components, a remote icon font, or
a component framework just to reproduce the existing visual language. When an
existing app already uses a framework, map the same tokens into its theme.

The canonical repository sources are `packages/agent-pack/src/ui/`; generated
copies are synchronized by `node scripts/sync-stack-assets.mjs`. Scaffolded
copies belong to the app and must survive upgrades.

## Shell pattern

```html
<div class="layout">
  <header class="app-header">
    <span class="brand-mark" aria-hidden="true">u//</span>
    <span class="app-title">My app</span>
    <span class="app-subtitle">/ Unstoppable app</span>
    <p class="mono" id="worker-status" role="status">Starting…</p>
  </header>
  <div class="workspace">
    <aside class="sidebar">
      <nav aria-label="App sections">
        <a class="nav-link" href="#records" aria-current="location">Records</a>
      </nav>
    </aside>
    <main class="content">
      <div class="page-heading"><h1>Records</h1></div>
      <section class="card" id="records" aria-labelledby="records-title">
        <h2 class="card-title" id="records-title">Saved on this computer</h2>
        <label for="record-name">Name</label>
        <input class="inp" id="record-name">
        <button class="btn" type="button">Save locally</button>
        <button class="btn btn-outline" type="button">Inspect</button>
        <p class="result" role="status"></p>
      </section>
    </main>
  </div>
</div>
```

For several records or apps, prefer a list and a selected-item inspector to a
full card with every action repeated for every item. Keep small single-purpose
apps compact; a sidebar is not mandatory.

## State and accessibility

Use `--accent` for primary actions and selected navigation, `--green` only for
observed success, `--amber` for attention/paused states, and `--red` for errors
or destructive actions. Pair color with plain text. On primary buttons use
`--accent-text`; on secondary buttons use `--text`.

Keep identifiers and metrics in monospace, body copy in the system font, and
headings restrained. Avoid fake metrics or decorative progress. Connection,
copy completeness, storage, and AI readiness are separate states.

Use native controls with labels, visible focus, accessible modal naming and
focus management, Escape to dismiss dialogs, and a useful empty state. Do not
replace focused controls or clear form edits when a worker snapshot arrives.

Inspect real light/dark layouts and smaller windows. Preserve all IPC actions,
local persistence, and native model cancellation/reuse when changing visuals.
