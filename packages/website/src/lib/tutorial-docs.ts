import type { DocPage } from "./docs";
import { siteConfig } from "./release";

export const tutorialDocs: DocPage[] = [{
  slug: "tutorial",
  title: "Build and change your first desktop app",
  description: "Create an app, save a note, prove it survives a restart, and change the saved data.",
  category: "Get started",
  verifiedOn: "21 October 2026",
  blocks: [
    { type: "lead", text: "Follow this page from start to finish for a small desktop app with local Hyperbee storage. You will use the CLI directly; an assistant is optional. **No model download is needed for this tutorial.**" },
    { type: "heading", text: "Before you start" },
    { type: "paragraph", text: "Use a desktop with `Node.js` 22.17+ and npm. Installation needs internet access and downloads Electron, Pear runtime and native dependencies. Start in a parent directory where you can create a new folder named notes-workspace. The desktop scaffold is a developer preview; platform and packaged-release acceptance are separate checks." },
    { type: "heading", text: "Create and launch the app" },
    { type: "steps", items: [
      { title: "Check tools and install the CLI", body: "Check Node first, then install the exact CLI version used by these docs. Keep the version output if you need help.", code: `node --version\nnpm --version\n${siteConfig.cli.installCommand}\nus --version\nus doctor -p pear-desktop` },
      { title: "Create the workspace and app", body: "Run these in your chosen parent directory. init creates the workspace; scaffold creates the runnable notes-app child. For generated assistant guidance, replace none with claude, codex, cursor or opencode.", code: "us init notes-workspace --assistant none --no-install\ncd notes-workspace\nus scaffold app -p pear-desktop -n notes-app" },
      { title: "Start from the app directory", body: "The desktop window should show KV Storage with Key, Value, Save and Fetch controls. Keep this terminal open to see worker errors. If it only prints a workspace message, you are one directory too high.", code: "cd notes-app\nnpm install\nnpm run dev" },
    ] },
    { type: "heading", text: "Save and fetch a note" },
    { type: "steps", items: [
      { title: "Write a value", body: "In KV Storage, enter note:welcome in Key and Hello from my desktop in Value. Click Save. Expect Saved followed by the key." },
      { title: "Read it back", body: "Leave Key as note:welcome and click Fetch. The result should contain Hello from my desktop. Fetch a different key such as note:missing to see the not found result." },
      { title: "Prove persistence", body: "Close the app normally. From the same notes-app directory, run npm run dev again, enter note:welcome and click Fetch. The inputs start empty; the stored value should still exist." },
      { title: "Check offline use", body: "With dependencies already installed, disconnect external networking and repeat Save and Fetch with note:offline. Close and reopen the same app and Fetch again. Local storage should work; peer discovery needs connectivity. Reconnect when finished." },
    ] },
    { type: "heading", text: "Change the value you save" },
    { type: "paragraph", text: "Close the app. Open `app/index.js` inside notes-app and find the kv-save click handler. Replace its existing sendToWorker call below. Keep the other handler lines, including the key/value input reads." },
    { type: "code", language: "js", code: "// Existing line inside the Save handler:\nsendToWorker({ type: 'db-put', key, value })\n\n// Replace that line with:\nsendToWorker({\n  type: 'db-put',\n  key,\n  value: { text: value, kind: 'note' }\n})" },
    { type: "paragraph", text: "**The worker already accepts JSON values.** This change makes newly saved records objects; existing string records remain strings until you save over their keys. Storage stays in `worker.js` and the UI continues to use the existing bridge." },
    { type: "steps", items: [
      { title: "Run the changed app", body: "Launch again, save note:structured with Value Hello, then Fetch that key.", code: "npm run dev" },
      { title: "Check the new shape", body: "The fetched JSON should match the object below. Restart and Fetch again to confirm the object persists. Fetch your original note:welcome too; it should retain its original string unless you overwrote it.", language: "json", code: '{ "text": "Hello", "kind": "note" }' },
    ] },
    { type: "heading", text: "Choose your next change" },
    { type: "cards", items: [
      { title: "Understand the Save path", body: "Trace the UI, bridge and worker handlers before adding another command.", href: "/docs/architecture" },
      { title: "Connect two peers", body: "Run an isolated notes demo for scoped RPC and replication, then choose the right sharing API.", href: "/docs/connect" },
      { title: "Add local AI", body: "Generate a separate AI starter and validate model loading, streaming and cancellation.", href: "/docs/local-ai" },
      { title: "Something failed?", body: "Find diagnostics for the command, window, storage, peers or model.", href: "/docs/troubleshooting" },
    ] },
  ],
}];
