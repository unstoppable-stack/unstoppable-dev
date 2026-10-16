import type { DocPage } from "./docs";
import { defaultScaffoldCommand, siteConfig } from "./release";
export { gettingStartedPaths } from "./setup-paths";

const extractPlugin = `cd ~/Downloads\ntar -xzf ${siteConfig.plugins.filename}\nPLUGIN_DIR="$(pwd)/${siteConfig.plugins.directory}"`;
const firstPrompt = "Scaffold a Pear Desktop app named coffee-notes with local storage and peer networking. Use the installed Unstoppable Stack CLI’s actual catalog, keep storage and networking in the worker, install the app dependencies and tell me which folder to run.";
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
    description: `Download the ${title} plugin preview, install it locally and build your first app.`,
    category: "Get started",
    verifiedOn: siteConfig.docsUpdatedOn,
    blocks: [
      { type: "lead", text: `Use ${title} as your starting point. The Unstoppable Stack plugin brings 19 skills and reference routers into your assistant; the CLI handles app scaffolding.` },
      { type: "callout", title: "Local plugin preview", body: "This download contains skills and references for Claude and Codex. It is a local installation preview, not a public marketplace listing. Native package parsing has been checked; full session activation and end-to-end assistant workflows remain under evaluation." },
      downloadActions,
      { type: "steps", items: [
        { title: "Check your assistant and install the matching CLI", body: `Start with ${title} installed and signed in, plus Node.js 22.17 or newer and npm. This plugin requires CLI ${siteConfig.cli.candidateVersion}. ${siteConfig.cli.candidatePublished ? "Install that exact npm version below." : "The matching candidate is not on npm yet; use this pinned source build in a new folder. npm 0.3.0 does not supply the maintained workflow. The commands below use a macOS/Linux shell and a user-writable npm prefix."}`, code: `${command} --version\n${command} plugin --help\n${siteConfig.cli.setupInstallCommand}\n${siteConfig.cli.versionCommand}` },
        { title: "Extract the plugin download", body: "Download the archive above, then run this from your Downloads folder in a macOS or Linux shell. Adjust the folder if your browser saves elsewhere. Keep this terminal open and retain the extracted folder for the local catalog.", code: extractPlugin },
        { title: `Install in ${title}`, body: isClaude ? "Add the extracted catalog and install Unstoppable Stack for your user. This installs guidance; it does not download app dependencies or models." : "Register the extracted local catalog, then install Unstoppable Stack from it. Registration alone does not activate the plugin. Check codex plugin --help if your version uses a different installation surface.", code: isClaude ? 'claude plugin marketplace add "$PLUGIN_DIR"\nclaude plugin install unstoppable-stack@unstoppable-stack-dev --scope user' : 'codex plugin marketplace add "$PLUGIN_DIR"\ncodex plugin add unstoppable-stack@unstoppable-stack-dev' },
        { title: "Start a fresh workspace session", body: isClaude ? "This example creates ~/coffee-workspace, then launches Claude there after installation. Choose another directory or name if you prefer, and use a new folder." : "This example creates ~/coffee-workspace, then launches Codex there after installation. In the Codex desktop app, open that folder and start a new chat instead. Choose a different name if it already exists.", code: `cd ~\nmkdir coffee-workspace\ncd coffee-workspace\n${command}` },
        { title: "Activate the entry skill", body: isClaude ? "Enter this in the Claude chat, then describe your app. The namespaced command should be available in the new session." : "In the new Codex session, select the entry skill by this namespaced name from the available skills. Confirm that it appears before asking it to build.", language: "text", code: isClaude ? "/unstoppable-stack:build-with-unstoppable" : "unstoppable-stack:build-with-unstoppable" },
        { title: "Describe the first app", body: "Use a small desktop baseline to check the setup. The assistant should inspect the installed CLI and tell you which generated app folder to run.", language: "text", code: firstPrompt },
      ] },
      { type: "heading", text: "Check the result" },
      { type: "paragraph", text: "Run the generated app from coffee-notes, save an entry, close it normally and open it again to confirm persistence. Make one small visible change with your assistant. Local AI can be added after the baseline works; it needs compatible hardware and a model download." },
      { type: "heading", text: "If the skill does not appear" },
      { type: "paragraph", text: "Confirm both catalog registration and plugin installation completed, then start a fresh session in the intended workspace. Keep the entire extracted folder together. If your project already has CLI-generated guidance, preserve its instructions and inspect overlap before migrating. Use the raw CLI guide while a host installation issue is unresolved." },
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
        { title: "Check the required tools", body: "Use Node.js 22.17 or newer and npm. The generated desktop project installs its own Electron and Pear runtime dependencies.", code: "node --version\nnpm --version" },
        { title: "Install the matching CLI", body: `Use ${siteConfig.cli.candidateVersion} for the maintained workflow. ${siteConfig.cli.candidatePublished ? "Install the exact published version below." : "This candidate is not on npm yet. Build the pinned public source in a new folder with a macOS/Linux shell and a user-writable npm prefix; the older published 0.3.0 has a different command surface."}`, code: `${siteConfig.cli.setupInstallCommand}\n${siteConfig.cli.versionCommand}` },
        { title: "Create a workspace", body: "This creates a workspace, not a runnable app. The command chooses no assistant; use --assistant claude or --assistant codex instead if you want generated project guidance.", code: "us init coffee-workspace --assistant none --no-install\ncd coffee-workspace" },
        { title: "Scaffold the app", body: "The coffee-notes child directory contains the runnable app. Base peer networking and local Hyperbee storage are included.", code: defaultScaffoldCommand },
        { title: "Install and run from the app folder", body: "A desktop window should open. Keep this terminal open while the app is running.", code: "cd coffee-notes\nnpm install\nnpm run dev" },
        { title: "Verify persistence", body: "Save an entry, close the app normally and start it again. The entry should remain. Local reads and writes should continue while offline; discovering and syncing with another peer requires connectivity." },
      ] },
      { type: "heading", text: "If setup fails" },
      { type: "paragraph", text: "If us is not found, check npm prefix -g and ensure its bin directory is on PATH. For runtime problems, run the command below from coffee-notes and check the first failed diagnostic. A successful scaffold is separate from a successful app launch." },
      { type: "code", language: "bash", code: "us doctor -p pear-desktop" },
      { type: "cards", items: [
        { title: "CLI reference", body: "Published commands and the difference from the source candidate.", href: "/docs/cli" },
        { title: "Add local AI", body: "Use QVAC after the desktop baseline works.", href: "/docs/local-ai" },
        { title: "Troubleshooting", body: "Recognize a setup failure and find the next check.", href: "/docs/troubleshooting" },
        { title: "Packages and integrations", body: "One P2P library, upstream SDKs and optional applications.", href: "/docs/packages" },
      ] },
    ],
  },
];
