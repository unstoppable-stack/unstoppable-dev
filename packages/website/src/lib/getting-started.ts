import type { DocPage } from "./docs";
import { defaultScaffoldCommand, siteConfig } from "./release";
export { gettingStartedPaths } from "./setup-paths";

const extractPlugin = `cd ~/Downloads\ntar -xzf ${siteConfig.plugins.filename}\nPLUGIN_DIR="$(pwd)/${siteConfig.plugins.directory}"`;
const firstPrompt = "Scaffold a Pear Desktop app named shop-starter with local storage and peer networking. Use the installed Unstoppable Stack CLI’s actual catalog, keep storage and networking in the worker, install the app dependencies and tell me which folder to run.";
const downloadActions: DocPage["blocks"][number] = {
  type: "actions",
  items: [
    { label: `Download plugin preview ${siteConfig.plugins.version}`, href: siteConfig.plugins.downloadPath, download: true },
    { label: "View checksum and content identity", href: siteConfig.plugins.checksumPath },
  ],
};

function pluginGuide(host: "claude" | "codex"): DocPage {
  const isClaude = host === "claude";
  const title = isClaude ? "Claude Code" : "Codex";
  const command = isClaude ? "claude" : "codex";
  return {
    slug: `start/${host}`,
    title: `Get started with ${title}`,
    description: `Install the ${title} plugin preview with the Unstoppable Stack CLI and build your first app.`,
    category: "Get started",
    verifiedOn: siteConfig.docsUpdatedOn,
    blocks: [
      { type: "lead", text: `Use ${title} as your starting point. The Unstoppable Stack plugin brings 19 skills and reference routers into your assistant; the CLI handles app scaffolding.` },
      { type: "callout", title: "Repository plugin preview", body: "Install from the public repository catalog. This is separate from an official plugin-directory listing. Real installs and explicit skill invocation were checked with plugin 0.1.6 in Claude Code 2.0.76 and Codex 0.163.0-alpha.10.2. The current preview updates installation guidance; full app-building workflows, automatic skill selection and desktop reload remain separate checks." },
      { type: "steps", items: [
        { title: "Check your assistant and install the matching CLI", body: `Start with ${title} installed and signed in, plus Node.js 22.17 or newer and npm. Plugin install and status commands require CLI ${siteConfig.cli.version}. ${siteConfig.cli.published ? "Install that exact npm version below." : "This release candidate is not on npm yet. Use the pinned source build below in a new folder; the published beta.2 does not include plugin commands. The commands use a macOS/Linux shell and a user-writable npm prefix."}`, code: `${command} --version\n${command} plugin --help\n${siteConfig.cli.installCommand}\n${siteConfig.cli.versionCommand}` },
        { title: `Install the ${title} plugin`, body: isClaude ? "The CLI adds the public repository catalog and installs the plugin for your user through Claude’s native installer. Existing installations and disabled settings are preserved. This installs guidance; it does not download app dependencies or models. Older Claude versions can install while reporting status unavailable; check /plugin in a fresh session instead." : "The CLI adds the public repository catalog, then installs the plugin through Codex’s native installer. Status reports catalog registration, installation and enabled state separately. If this Codex version cannot install from the CLI, follow the desktop-plugin instructions reported by the command, or upgrade Codex.", code: `us plugin install ${host}\nus plugin status ${host}` },
        { title: "Start a fresh workspace session", body: isClaude ? "This example creates ~/shop-workspace, then launches Claude there after installation. Choose another directory or name if you prefer, and use a new folder." : "This example creates ~/shop-workspace, then launches Codex there after installation. In the Codex desktop app, open that folder and start a new chat instead. Choose a different name if it already exists.", code: `cd ~\nmkdir shop-workspace\ncd shop-workspace\n${command}` },
        { title: "Activate the entry skill", body: isClaude ? "Enter this in the Claude chat, then describe your app. The namespaced command should be available in the new session." : "In the new Codex session, select the entry skill by this namespaced name from the available skills. Confirm that it appears before asking it to build.", language: "text", code: isClaude ? "/unstoppable-stack:build-with-unstoppable" : "unstoppable-stack:build-with-unstoppable" },
        { title: "Describe the first app", body: "Use a small desktop baseline to check the setup. The assistant should inspect the installed CLI and tell you which generated app folder to run.", language: "text", code: firstPrompt },
      ] },
      { type: "actions", items: [{ label: "Save a note and make your first change", href: "/docs/tutorial#save-and-fetch-a-note" }] },
      { type: "heading", text: "Check the result" },
      { type: "paragraph", text: "Run the generated app from shop-starter, save an entry, close it normally and open it again to confirm persistence. Make one small visible change with your assistant. Local AI can be added after the baseline works; it needs compatible hardware and a model download." },
      { type: "heading", text: "If the skill does not appear" },
      { type: "paragraph", text: "Run us plugin status for your assistant and confirm installation separately from catalog registration. Enable a disabled plugin in the host plugin browser, then start a fresh session. Older Claude versions may report status unavailable even after a successful install. If login has expired, sign in again. Preserve existing project instructions and inspect overlapping CLI-generated or development-plugin skills before migrating; plugin installation is separate from us init. A conflicting catalog source is left untouched for you to inspect." },
      { type: "heading", text: "Manual installation fallback" },
      { type: "paragraph", text: "If the wrapper cannot complete, use your assistant’s native installer. Keep unrelated catalogs and plugins. On older Codex versions without plugin add, register the catalog below, install Unstoppable Stack through the desktop plugin browser, then start a new chat." },
      { type: "code", language: "bash", code: isClaude ? "claude plugin marketplace add unstoppable-stack/unstoppable-dev\nclaude plugin install unstoppable-stack@unstoppable-stack --scope user" : "codex plugin marketplace add unstoppable-stack/unstoppable-dev\ncodex plugin add unstoppable-stack@unstoppable-stack" },
      { type: "heading", text: "Optional archive installation" },
      { type: "paragraph", text: "Use the downloadable archive if you need a local catalog. It uses the separate unstoppable-stack-dev catalog name; avoid enabling both its plugin and the public plugin in the same session because they share skill names. Keep the entire extracted folder together. The archive supplies guidance, not the CLI or models." },
      downloadActions,
      { type: "code", language: "bash", code: `${extractPlugin}\n${isClaude ? 'claude plugin marketplace add "$PLUGIN_DIR"\nclaude plugin install unstoppable-stack@unstoppable-stack-dev --scope user' : 'codex plugin marketplace add "$PLUGIN_DIR"\ncodex plugin add unstoppable-stack@unstoppable-stack-dev'}` },
      { type: "cards", items: [
        { title: "Use the raw CLI", body: "Scaffold the same baseline directly from the terminal.", href: "/docs/start/cli" },
        { title: "Packages and integrations", body: "See what is installed, upstream, unpublished or excluded.", href: "/docs/packages" },
      ] },
      { type: "actions", items: [{ label: `${title} plugin documentation`, href: isClaude ? "https://code.claude.com/docs/en/discover-plugins" : "https://developers.openai.com/plugins/build/plugins" }] },
    ],
  };
}

export const gettingStartedGuides: DocPage[] = [
  pluginGuide("claude"),
  pluginGuide("codex"),
  {
    slug: "start/cli",
    title: "Get started with the raw CLI",
    description: "Install the matching CLI and run a local-first desktop app from your terminal.",
    category: "Get started",
    verifiedOn: siteConfig.docsUpdatedOn,
    blocks: [
      { type: "lead", text: "Use this path for direct control over setup and scaffolding. You can run it without an assistant, or add generated guidance for Claude Code, Codex, Cursor or OpenCode." },
      { type: "steps", items: [
        { title: "Check the required tools", body: "Use `Node.js` 22.17 or newer and npm. The generated desktop project installs its own Electron and Pear runtime dependencies.", code: "node --version\nnpm --version" },
        { title: "Install the matching CLI", body: `Use ${siteConfig.cli.version} for the maintained workflow. ${siteConfig.cli.published ? "Install the exact published version below." : "This candidate is not on npm yet. Build the pinned public source in a new folder with a macOS/Linux shell and a user-writable npm prefix; the older published 0.3.0 has a different command surface."}`, code: `${siteConfig.cli.installCommand}\n${siteConfig.cli.versionCommand}` },
        { title: "Create a workspace", body: "**This creates a workspace, not a runnable app.** The command chooses no assistant; use --assistant claude or --assistant codex instead if you want generated project guidance.", code: "us init shop-workspace --assistant none --no-install\ncd shop-workspace" },
        { title: "Scaffold the app", body: "The shop-starter child directory contains a minimal runnable app with peer networking and local Hyperbee storage. It does not include the Local Goods catalog or checkout.", code: defaultScaffoldCommand },
        { title: "Install and run from the app folder", body: "A desktop window should open. Keep this terminal open while the app is running.", code: "cd shop-starter\nnpm install\nnpm run dev" },
        { title: "Verify persistence", body: "Save an entry, close the app normally and start it again. The entry should remain. Local reads and writes should continue while offline; discovering and syncing with another peer requires connectivity." },
      ] },
      { type: "actions", items: [{ label: "Continue: save a note and change the app", href: "/docs/tutorial#save-and-fetch-a-note" }] },
      { type: "callout", title: "Try the finished ecommerce example", body: "The scaffold above is a minimal starting point. Local Goods adds a searchable catalog, persistent cart, demo checkout and local shopping assistant. Open Examples for its source and run instructions; checkout has no payment or fulfillment integration." },
      { type: "actions", items: [{ label: "Explore Local Goods", href: "/showcase" }] },
      { type: "heading", text: "If setup fails" },
      { type: "paragraph", text: "If us is not found, check npm prefix -g and ensure its bin directory is on PATH. For runtime problems, run the command below from shop-starter and check the first failed diagnostic. A successful scaffold is separate from a successful app launch." },
      { type: "code", language: "bash", code: "us doctor -p pear-desktop" },
      { type: "cards", items: [
        { title: "CLI reference", body: "Published beta commands and differences from earlier 0.3.0.", href: "/docs/cli" },
        { title: "Add local AI", body: "Use QVAC after the desktop baseline works.", href: "/docs/local-ai" },
        { title: "Troubleshooting", body: "Recognize a setup failure and find the next check.", href: "/docs/troubleshooting" },
        { title: "Packages and integrations", body: "One P2P library, upstream SDKs and optional applications.", href: "/docs/packages" },
      ] },
    ],
  },
];
