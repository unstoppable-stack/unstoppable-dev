import { defaultScaffoldCommand, siteConfig, supportMatrix } from "@/lib/release";
import { gettingStartedGuides, gettingStartedPaths } from "@/lib/getting-started";
import { discoveryDocs, capabilityCards, moduleBlocks } from "@/lib/discovery-docs";
import { libraryPages, libraryNav } from "@/lib/library-docs";
import { tutorialDocs } from "@/lib/tutorial-docs";
import { packageDocs } from "@/lib/package-docs";

export type DocBlock =
  | { type: "lead"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; body: string; code?: string; language?: string }[] }
  | { type: "code"; language: string; code: string }
  | { type: "callout"; title: string; body: string }
  | { type: "start-paths" }
  | { type: "actions"; items: { label: string; href: string; download?: boolean }[] }
  | { type: "cards"; items: { title: string; body: string; href?: string }[] };

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  category: string;
  verifiedOn: string;
  blocks: DocBlock[];
};

export const docsNav = [
  { title: "Get started", pages: [{ title: "What you can build", slug: "" }, { title: "Your first desktop app", slug: "tutorial" }, { title: "Examples", slug: "examples" }, { title: "Choose your path", slug: "quickstart" }, { title: "Claude Code", slug: "start/claude" }, { title: "Codex", slug: "start/codex" }, { title: "Raw CLI", slug: "start/cli" }] },
  { title: "Build", pages: [{ title: "Project architecture", slug: "architecture" }, { title: "Assistant workflow", slug: "agent-pack" }, { title: "Local AI", slug: "local-ai" }] },
  { title: "Connect", pages: [{ title: "P2P and pairing", slug: "connect" }, { title: "Personal Node", slug: "node" }] },
  { title: "Package APIs", pages: [{ title: "P2P runtime", slug: "p2p" }, { title: "Runnable examples", slug: "p2p/examples" }, { title: "Typed RPC", slug: "p2p/rpc" }, { title: "Replication", slug: "p2p/sync" }, { title: "Collaborative databases", slug: "p2p/database" }, { title: "Capability roadmap", slug: "p2p/roadmap" }, { title: "AI lifecycle", slug: "runtime-ai" }, { title: "Node Desktop", slug: "node-desktop" }, { title: "Deferred packages", slug: "experiments" }] },
  { title: "Reference", pages: [{ title: "Packages & integrations", slug: "packages" }, { title: "CLI commands", slug: "cli" }, { title: "Modules", slug: "modules" }] },
  { title: "Library reference", pages: libraryNav.flatMap((section) => section.pages) },
  { title: "Operate", pages: [{ title: "Compatibility", slug: "compatibility" }, { title: "Troubleshooting", slug: "troubleshooting" }, { title: "Support & limitations", slug: "support" }, { title: "Upgrades", slug: "upgrades" }] },
];

const verifiedOn = siteConfig.verifiedOn;

export const docsPages: DocPage[] = [
  ...gettingStartedGuides,
  ...tutorialDocs,
  ...packageDocs,
  ...discoveryDocs,
  ...libraryPages,
  {
    slug: "packages",
    title: "Packages and integrations",
    description: "The CLI, one P2P library, assistant plugins and direct upstream SDK integrations.",
    category: "Reference",
    verifiedOn: "16 October 2026",
    blocks: [
      { type: "lead", text: "Start through Claude Code, Codex or the raw CLI. The plugins guide your assistant; the CLI configures workspaces and generates apps. Apps use one Unstoppable P2P library and upstream QVAC or wallet SDKs when needed." },
      { type: "heading", text: "Packages we maintain" },
      { type: "lead", text: "**A newer CLI or plugin does not migrate an existing app.** Inspect its recorded profile, compare a fresh scaffold, and apply changes explicitly while preserving your UI, data and edited runtime files." },
      { type: "heading", text: "Inspect before changing files" },
      { type: "paragraph", text: "From the workspace containing shop-starter, run the commands below. Replace that name with your app directory. These commands inspect files without rewriting them." },
      { type: "code", language: "bash", code: "us --version\nus compatibility list -o .\nus compatibility check -o ./shop-starter" },
      { type: "paragraph", text: "Read `matchesProfile` and changes in the JSON output. Each proposed change includes path, from, to and reason. `mutated`: false confirms the check did not apply it. A matching profile describes recorded files; it does not prove native runtime or offline acceptance. If `project.js`on is missing or the schema is unknown, recover the original generator/version information before attempting migration." },
      { type: "heading", text: "Compare a separate scaffold" },
      { type: "paragraph", text: "**Commit or save your current work** and copy irreplaceable app data first. With the target CLI installed, generate a baseline beside the edited app. Use its original platform and features; the example below is for a base desktop app without local AI." },
      { type: "code", language: "bash", code: "us scaffold app -p pear-desktop -n upgrade-reference\ngit diff --no-index -- ./shop-starter/worker.js ./upgrade-reference/worker.js" },
      { type: "paragraph", text: "git diff exits 1 when differences exist. Compare `package.js`on, electron/, `app/bridge.js` and any vendored runtime too. Review each change in a branch; retain app-specific handlers, schemas and prompts. Do not regenerate an edited app with --force or replace metadata just to make a check pass." },
      { type: "heading", text: "Verify the migrated copy" },
      { type: "steps", items: [
        { title: "Install and start", body: "Install dependencies in the migrated app, preserve and review its lockfile, and run its checks and npm run dev." },
        { title: "Read old data and write new data", body: "Test using a copy of existing data. Save a second record, close normally, reopen and fetch both while offline." },
        { title: "Check selected features", body: "For P2P, disconnect and reconnect peers and confirm downloaded data remains readable. For AI, test native loading, streaming, Stop, another request after cancellation, and cached offline startup." },
        { title: "Record the accepted migration", body: "Update metadata only after the intended migration passes its checks. Run compatibility check again, review remaining intentional differences and record the platform/model evidence." },
      ] },
      { type: "actions", items: [{ label: "Diagnose a failure", href: "/docs/troubleshooting" }, { label: "Validation commands and acceptance limits", href: `${siteConfig.publicRepositoryUrl}/blob/main/docs/validation.md` }] },
    ],
  },
  {
    slug: "",
    title: "Build apps that work locally",
    description: "Create desktop apps, store data on-device, connect trusted peers, and add local AI.",
    category: "Overview",
    verifiedOn: "21 October 2026",
    blocks: [
      { type: "lead", text: "Unstoppable Stack combines app scaffolding, coding-assistant guidance, and a P2P library. Your app owns its UI and data; Holepunch libraries provide storage and networking, and QVAC provides optional inference on the device running the model." },
      { type: "heading", text: "Start with a working result" },
      { type: "actions", items: [{ label: "Build and change your first desktop app", href: "/docs/tutorial" }, { label: "Run an existing example", href: "/docs/examples" }] },
      { type: "paragraph", text: "The first-app tutorial takes you from installation to saving a note, restarting, and changing the data you save. Already have an app? Use the Build guides for changes and Package APIs for contracts and complete code examples." },
      { type: "heading", text: "What you can build" },
      { type: "cards", items: capabilityCards },
      { type: "callout", title: "Choose a path with the right maturity", body: "Workspace setup and desktop scaffolding are the core preview. P2P is alpha; typed RPC and the collaborative database are available in published 0.6.0-alpha.2. Native AI needs model and platform validation. Personal Node, mobile, Memory and wallets remain outside the core preview." },
      { type: "heading", text: "How the pieces fit" },
      { type: "steps", items: [
        { title: "Create your workspace and app", body: "The CLI generates the project. The agent pack gives Claude Code, Cursor, OpenCode or Codex implementation guidance; it is not the AI running inside your app." },
        { title: "Keep work on the device", body: "**The renderer displays the UI.** **A worker owns persistent storage, native models and networking.** Local reads and writes should keep working when peers disconnect." },
        { title: "Add only the capabilities you need", body: "Use the P2P library for permissioned calls and replication. Use QVAC for inference. **Your application supplies schemas, prompts, conflict rules and user controls.**" },
      ] },
      { type: "heading", text: "Start building" },
      { type: "start-paths" },
      { type: "heading", text: "Find the right reference" },
      { type: "cards", items: [
        { title: "Try an example", body: "See expected results, prerequisites and commands for real repository examples.", href: "/docs/examples" },
        { title: "Choose a library", body: "Understand what each runtime, networking and storage library does, with practical use cases.", href: "/docs/modules" },
        { title: "Packages and APIs", body: "Find maintained packages, install versions and API contracts.", href: "/docs/packages" },
        { title: "Compatibility and support", body: "Check feature maturity and supported combinations before choosing a target.", href: "/docs/compatibility" },
      ] },
    ],
  },
  {
    slug: "quickstart",
    title: "Choose your starting path",
    description: "Install the Claude plugin, the Codex plugin or the raw CLI.",
    category: "Get started",
    verifiedOn: siteConfig.docsUpdatedOn,
    blocks: [
      { type: "lead", text: "Choose the tool you already use. All three paths lead to the same desktop baseline with local storage and peer networking. Plugin paths include a local preview download; the CLI installs from npm." },
      { type: "start-paths" },
      { type: "heading", text: "How the pieces fit" },
      { type: "paragraph", text: "The plugins supply workflows and references. The CLI creates workspaces and apps. The consolidated P2P library owns pairing, permissions and replication; QVAC and wallet features use upstream SDKs directly. The P2P alpha is available on npm, and wallet scaffolds remain stubs. Memory and Search are excluded from this release." },
      { type: "cards", items: [
        { title: "Packages and integrations", body: "Purpose, versions and publication status for every layer.", href: "/docs/packages" },
        { title: "Compatibility", body: "Platform and feature maturity before adding capabilities.", href: "/docs/compatibility" },
      ] },
    ],
  },
  {
    slug: "compatibility",
    title: "Compatibility",
    description: "Current capability maturity and combinations for the developer preview.",
    category: "Start",
    verifiedOn,
    blocks: [
      { type: "lead", text: `This matrix was reviewed ${siteConfig.verifiedOn}. “Preview” means an implementation and validation path exist; it does not mean production support.` },
      { type: "list", items: supportMatrix.map((item) => `${item.capability} — ${item.maturity}: ${item.detail}`) },
      { type: "heading", text: "Known incompatible combination" },
      { type: "paragraph", text: "`multi-writer` and `node-sync` cannot be selected together. Multi-writer uses an Autobee writer set, while the current Node registration path handles the single base data core. The CLI rejects the combination instead of generating incomplete protection." },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Recognizable symptoms, one diagnostic, and one safe recovery action.",
    category: "Start",
    verifiedOn: "21 October 2026",
    blocks: [
      { type: "cards", items: [
        { title: "us is not found", body: "Check npm prefix -g, then ensure its bin directory is on PATH or open a new terminal." },
        { title: "Desktop dependencies are missing", body: "Run npm ls --depth=0 in the generated app, then rerun npm install and address the first meaningful error." },
        { title: "Install failed", body: "Use the first meaningful npm error to identify network, permission, or native dependency failure; do not start with broad cache deletion." },
        { title: "Model failed", body: "Check disk space and the first QVAC error. Return to the base scaffold or use a smaller compatible model before retrying." },
        { title: "Node unavailable", body: "Continue device-only. If Node features are needed, check that it is running, reachable, and has approved the requested capabilities." },
      ] },
    ],
  },
  {
    slug: "architecture",
    title: "Project architecture",
    description: "Keep UI, long-lived runtime resources, and optional peers in clear boundaries.",
    category: "Build",
    verifiedOn: "21 October 2026",
    blocks: [
      { type: "lead", text: "The primary desktop pattern separates the renderer from a worker. This is a runtime requirement, not just code organization." },
      { type: "heading", text: "Run two peers on your computer" },
      { type: "paragraph", text: "Use Node 22.17+, npm and Git. In a new parent directory, get the repository and run the notes consumer. It creates two peers and an isolated loopback DHT; no model, Personal Node or public peer discovery is needed. Installation still needs network access." },
      { type: "code", language: "bash", code: `git clone ${siteConfig.publicRepositoryUrl}.git p2p-walkthrough\ncd p2p-walkthrough\nnpm ci --prefix packages/p2p\nnpm ci --prefix examples/p2p-notes\nnpm run demo --prefix examples/p2p-notes` },
      { type: "heading", text: "Check the output" },
      { type: "list", items: ["**RPC note:** contains coffee: oat latte, returned through a paired peer's granted get procedure.", "**Streamed note:** contains the morning record, returned through the granted list stream.", "**Source offline; replicated note:** contains the note after the writer closes. This read uses downloaded local data rather than a live RPC request."] },
      { type: "paragraph", text: "The demo exits and cleans up its temporary stores. To inspect the implementation, open `examples/p2p-notes/demo.js` for invites and grants, `src/contract.js` for procedures, and `src/notes.js` for storage handlers. This loopback result does not establish Internet reachability." },
      { type: "heading", text: "Choose how your app shares data" },
      { type: "cards", items: [
        { title: "Request a selected result", body: "Use typed RPC for a receipt lookup or a validated action. The caller needs the host online and permission for the procedure.", href: "/docs/p2p/rpc" },
        { title: "Keep a local read-only copy", body: "Use `openCollection`, share the dataset key/version, and sync before reading. Downloaded records can remain available offline.", href: "/docs/p2p/sync" },
        { title: "Allow several writers", body: "Use the experimental collaborative database and explicitly admit each writer. Pairing alone does not grant write access.", href: "/docs/p2p/database" },
      ] },
      { type: "heading", text: "Handle disconnects in your UI" },
      { type: "list", items: [
        "**Renderer:** UI state, user interactions, and narrow bridge calls.",
        "**Worker:** Hyperswarm, Corestore, Hyperbee, Hyperdrive, QVAC, and cleanup.",
        "**Bridge:** typed messages with timeouts, errors, and visible status.",
        "**Optional Node:** a separate peer for replication or delegated inference; local work must survive its absence.",
      ] },
      { type: "heading", text: "Find the code in a generated desktop app" },
      { type: "code", language: "text", code: "shop-starter/\n  app/index.js          # UI and button handlers\n  app/bridge.js         # sendToWorker / onWorkerMessage\n  electron/preload.cjs  # window.unstoppable bridge\n  electron/main.js      # window, worker startup and storage path\n  worker.js             # Hyperbee, networking and command handlers\n  .unstoppable/project.json  # recorded platform and profile" },
      { type: "heading", text: "Follow a Save through the app" },
      { type: "steps", items: [
        { title: "UI sends a command", body: "The Save handler in `app/index.js` reads the key/value inputs and calls the bridge. It never opens the database.", language: "js", code: "sendToWorker({ type: 'db-put', key, value })" },
        { title: "Worker persists the value", body: "In `worker.js`, the base scaffold's db-put handler writes to Hyperbee and acknowledges completion.", language: "js", code: "await db.put(msg.key, msg.value)\nsend({ type: 'db-put-ok', key: msg.key })" },
        { title: "UI displays the acknowledgement", body: "The message listener in `app/index.js` handles db-put-ok and displays Saved. Fetch sends db-get and renders db-get-ok. Add new commands by extending both the worker handler and the UI response handler." },
      ] },
      { type: "paragraph", text: "These fragments explain the generated handlers; they are not standalone scripts. For new operations, validate input in the worker, return errors, and give the caller a deadline. For concurrent requests, add request IDs rather than matching replies by command type alone." },
      { type: "actions", items: [{ label: "Make your first change", href: "/docs/tutorial#change-the-value-you-save" }] },
      { type: "callout", title: "Shutdown matters", body: "Close swarms, stores, model handles, and worker pipes explicitly. Treat reconnecting and unavailable states as normal." },
    ],
  },
  {
    slug: "agent-pack",
    title: "Assistant workflow",
    description: "How generated project guidance helps an AI coding assistant work inside stack constraints.",
    category: "Build",
    verifiedOn,
    blocks: [
      { type: "lead", text: "Install the Claude or Codex plugin for portable workflows, or use us init for project-local guidance. Both delivery methods share the same maintained agent-pack source. The raw CLI also works without an assistant." },
      { type: "start-paths" },
      { type: "paragraph", text: "**Plugin installation adds guidance**, not the CLI or native dependencies. The entry skill checks the installed CLI catalog before scaffolding. Existing apps keep their recorded runtime and project instructions; updating the plugin does not migrate them." },
      { type: "heading", text: "What the agent pack contains" },
      { type: "list", items: [
        "Core architecture and runtime constraints; module references for networking, storage, AI and platform integration.",
        "Task skills for setup and feature implementation, focused recipes, reusable components and activation hooks.",
        "Generated project guidance for Claude Code, Cursor, OpenCode and Codex, plus separate Claude/Codex plugin distributions.",
        "Canonical content lives in packages/agent-pack/src. The CLI bundles synchronized output; plugin builders distribute the same maintained guidance.",
      ] },
      { type: "steps", items: [
        { title: "Initialize", body: "Select Claude Code, Cursor, OpenCode, Codex, or none.", code: "us init my-workspace" },
        { title: "Scaffold first", body: "Create the smallest supported target before asking for feature work.", code: defaultScaffoldCommand },
        { title: "Request one change", body: "Name the observable result and preserve the worker boundary." },
        { title: "Verify", body: "Run the generated project checks and exercise local persistence and disconnect behavior." },
      ] },
    ],
  },
  {
    slug: "local-ai",
    title: "Local AI",
    description: "Add on-device inference after the base application works.",
    category: "Build",
    verifiedOn,
    blocks: [
      { type: "lead", text: "QVAC-backed inference is optional in the preview. A local model avoids sending prompts to a hosted inference provider, but it still requires compatible hardware, disk space, and an initial model download." },
      { type: "heading", text: "What you can add" },
      { type: "cards", items: [
        { title: "Streaming chat", body: "Display a response as it arrives, keep bounded conversation history and provide a Stop control. Native cancellation must settle before another request starts.", href: "/docs/runtime-ai" },
        { title: "An assistant for your app", body: "Provide your own catalog, prompts and validated tools. Local Goods demonstrates shopping advice alongside persistent cart and order controls.", href: "/docs/examples#build-a-local-shopping-assistant" },
      ] },
      { type: "heading", text: "Create a desktop app with local AI" },
      { type: "paragraph", text: "With the published CLI beta installed and inside your initialized workspace, generate a new app with the `local-ai` feature. This creates the integration code; a model still needs to download and load on compatible hardware." },
      { type: "code", language: "bash", code: "us scaffold app -p pear-desktop -n local-assistant -f local-ai\ncd local-assistant\nnpm install\nnpm run dev" },
      { type: "paragraph", text: "**Expected result:** a desktop app with an AI integration path. Verify model loading, a streamed response, Stop, another request after cancellation, and cached startup without external networking. Mock responses only verify the UI and protocol." },
      { type: "heading", text: "Separate UI checks from native inference" },
      { type: "paragraph", text: "On macOS/Linux, close the app and run this from local-assistant to exercise the visibly labelled mock response. Stop a response, then send another message. This checks wiring and the session flow without claiming that a model loaded." },
      { type: "code", language: "bash", code: "QVAC_MOCK=1 npm run dev" },
      { type: "paragraph", text: "Close mock mode, start again with npm run dev, and use the AI load control for a real model. Verify streamed output, Stop and a subsequent request. After a successful download, close and reopen with external networking unavailable to check cached offline loading. Record your OS, architecture and model; a successful mock run cannot substitute for these results." },
      { type: "heading", text: "Who owns what" },
      { type: "paragraph", text: "QVAC owns inference. Private runtime helpers copied into .unstoppable/runtime-ai/ manage loading, bounded history, cancellation and cleanup. **Your app owns prompts, tool schemas, conversation UI and domain actions.** Renderer code talks to the worker through IPC." },
      { type: "heading", text: "Integration checklist" },
      { type: "list", items: [
        "Keep model initialization in the worker, never the renderer.",
        "Report download, loading, ready, and error states separately.",
        "Use mock inference for deterministic UI and protocol tests; label it as mock.",
        "After a successful model install, test local inference without internet access.",
        "Do not publish a universal RAM or download-size claim until the chosen model is pinned and measured.",
      ] },
      { type: "heading", text: "Go deeper" },
      { type: "actions", items: [
        { label: "AI session and adapter contract", href: "/docs/runtime-ai" },
        { label: "QVAC upstream capabilities", href: "https://docs.qvac.tether.io/ecosystem/" },
      ] },
      { type: "paragraph", text: "The upstream QVAC ecosystem includes capabilities beyond this project's text-generation integration. An upstream feature listing does not mean the scaffold implements it. Use the dependency versions recorded by your app and check API compatibility before adopting upstream examples." },
    ],
  },
  {
    slug: "connect",
    title: "P2P and pairing",
    description: "Peer discovery, invitations, approval, and disconnect behavior.",
    category: "Connect",
    verifiedOn: "21 October 2026",
    blocks: [
      { type: "lead", text: "Hyperswarm provides discovery and encrypted transport. Application trust still needs an explicit identity, invitation, or approval model; discovery alone is not authorization." },
      { type: "list", items: [
        "Display searching, approval required, connected, reconnecting, and unavailable states.",
        "Grant only requested capabilities supported by the peer.",
        "A desktop Personal Node may require explicit approval; a headless development daemon can be configured differently.",
        "Remote inference sends the request to the selected trusted device. It is not on-device inference.",
      ] },
      { type: "cards", items: [
        { title: "P2P runtime API", body: "Host and consume capabilities without a separate client SDK.", href: "/docs/p2p" },
        { title: "Replication API", body: "Register and protect app-owned resources.", href: "/docs/p2p/sync" },
      ] },
    ],
  },
  {
    slug: "node",
    title: "Personal Node",
    description: "Deferred alpha host composition, local management and delegated inference.",
    category: "Connect",
    verifiedOn: "16 October 2026",
    blocks: [
      { type: "lead", text: "Personal Node is an optional application composed from the P2P runtime, its sync pack and an internal QVAC adapter. The reorganized 0.6.0-alpha.2 source is unpublished and deferred from the core preview; published 0.4.0 has a different API." },
      { type: "heading", text: "Local operator API" },
      { type: "list", items: [
        "`PersonalNode.start()`/`close()` manage the host. `getStatus()` reports all peers, resources, quotas, invitations and AI readiness to the owner.",
        "`getConfig()`/`updateConfig(patch)`, setPeerQuota, setPeerGrant, pausePeer/resumePeer and unpairPeer control local policy and trust.",
        "enableAI/disableAI manage optional QVAC or labelled mock inference. Granted peers call ai.completion.stream; the AI adapter is internal application code.",
        "createInvite/listInvites/revokeInvite manage scoped invitations. getDiskUsage and peekCore/peekDrive are local operator diagnostics.",
        "exportState/importState handle settings and peer metadata. They include the sensitive identity seed and revocation records, but no replicated app payloads.",
      ] },
      { type: "paragraph", text: "These local methods drive the daemon CLI and desktop dashboard. They are not remote `peer.api` methods. Remote peers receive granted sync methods and optional completion streaming, scoped to their authenticated identity. Quotas pause replication and gate registration/resume; they are not hard filesystem limits." },
      { type: "heading", text: "Protection boundaries" },
      { type: "list", items: [
        "Replication protects observed data; it does not automatically guarantee future writes or a complete backup.",
        "Settings export does not imply that all replicated application payloads are included.",
        "Disconnecting pauses Node services but must not erase local data or block local reads and writes.",
        "Removing or unpairing an app stops replication and revokes access, but already downloaded blocks remain. The alpha has no per-app purge control.",
      ] },
      { type: "actions", items: [{ label: "Local management reference", href: "https://github.com/unstoppable-stack/unstoppable-dev/blob/main/packages/node/docs/api.md" }, { label: "Internal AI adapter", href: "https://github.com/unstoppable-stack/unstoppable-dev/blob/main/packages/node/docs/ai.md" }] },
      { type: "cards", items: [{ title: "Desktop controls", body: "Dashboard, tray lifecycle and packaged acceptance.", href: "/docs/node-desktop" }, { title: "Capability roadmap", body: "Restore, retention and the remaining service contracts.", href: "/docs/p2p/roadmap" }] },
    ],
  },
  {
    slug: "cli",
    title: "CLI commands",
    description: "The public command surface and current feature compatibility.",
    category: "Reference",
    verifiedOn: "21 October 2026",
    blocks: [
      { type: "lead", text: `CLI ${siteConfig.cli.version} ${siteConfig.cli.published ? "is the published beta" : "is an unpublished release candidate"}: plugin installation/status, init, scaffold, doctor and compatibility checks. Earlier latest ${siteConfig.cli.latestVersion} also exposes the deferred node command. Follow the setup guide for the matching ${siteConfig.cli.published ? "npm install" : "pinned source build"}.` },
      { type: "code", language: "bash", code: "us --version\nus --help\nus scaffold list-platforms\nus scaffold list-features\nus doctor -p pear-desktop" },
      { type: "actions", items: [{ label: "Create and run a desktop app", href: "/docs/tutorial" }, { label: "Complete CLI flags", href: `${siteConfig.publicRepositoryUrl}/blob/main/packages/cli/README.md#commands` }] },
      { type: "heading", text: "Assistant plugin commands" },
      { type: "paragraph", text: `Available in ${siteConfig.cli.version}; absent from published beta.2 and earlier releases. Install an assistant first and sign in. Installation uses its native public-repository catalog flow and is separate from us init. Status distinguishes registration, installation and enabled state. Older hosts may require a desktop installation step or report status unavailable. Neither command updates app runtimes or models.` },
      { type: "code", language: "bash", code: "us plugin install claude\nus plugin install codex\nus plugin status\nus plugin status codex --json" },
      { type: "heading", text: "Compatibility commands" },
      { type: "paragraph", text: "Published 0.4.0-beta.2 includes the read-only commands below. They are absent from earlier 0.3.0. Remote, Research, Search and Memory are not shipped in the minimal release artifact; Personal Node is an optional separate app." },
      { type: "code", language: "bash", code: "us compatibility list -o <workspace>\nus compatibility check -o <app>" },
      { type: "heading", text: "Scaffold facts" },
      { type: "list", items: [
        "The published beta exposes pear-desktop. Expo Mobile and Node CLI remain deferred source targets.",
        "Base Hyperswarm/Corestore networking and Hyperbee storage are always included.",
        "The published beta exposes local-ai. Wallet (stub), `node-sync`, `node-host` and `multi-writer` remain deferred source features.",
        "`multi-writer` and `node-sync` are rejected when combined.",
        "Node CLI is a `Node.js` command-line target; it is not described as a Bare-only app.",
      ] },
    ],
  },
  {
    slug: "modules",
    title: "Modules",
    description: "The runtime modules used by generated applications.",
    category: "Reference",
    verifiedOn,
    blocks: moduleBlocks,
  },
  {
    slug: "support",
    title: "Support and limitations",
    description: "Data handling, connectivity, exports, logs, and where to ask for help.",
    category: "Operate",
    verifiedOn,
    blocks: [
      { type: "lead", text: "This is a developer preview, not a managed application service. Generated apps store and exchange data according to the developer’s code and the peers a user chooses." },
      { type: "heading", text: "Data paths" },
      { type: "list", items: [
        "Local storage stays in the generated app’s configured device storage until application code exports, replicates, or deletes it.",
        "Local inference keeps prompts on the device running the model. Delegated inference sends them to the selected trusted peer.",
        "P2P sync sends declared data to connected peers; those peers may retain a copy after disconnect.",
        "A settings export is not necessarily an application-data backup. Inspect what each tool says it includes.",
        "Coding-assistant data handling is controlled by the assistant and provider the developer selects, not by the generated application runtime.",
      ] },
      { type: "heading", text: "Logs and website" },
      { type: "paragraph", text: "The project does not add product analytics in this website source. That statement does not mean the hosting provider keeps no network or request logs. Generated apps may log runtime status and errors; developers should avoid writing prompts, secrets, wallet material, or application records to logs." },
      { type: "heading", text: "Get help" },
      { type: "paragraph", text: "Use the public GitHub issue tracker linked below. Include the CLI version, platform, exact command, expected result, and first relevant error with private data removed. For a plugin issue, include the assistant version and confirm whether catalog registration, installation or session activation failed." },
    ],
  },
  {
    slug: "upgrades",
    title: "Upgrades",
    description: "Move between preview releases without hiding compatibility risk.",
    category: "Operate",
    verifiedOn: "21 October 2026",
    blocks: [
      { type: "list", items: [
        "Record the current us --version and generated app commit before changing tools.",
        "Read the release notes for generator, agent-pack, runtime, and storage changes.",
        "Regenerate into a temporary folder and compare structure instead of overwriting application code blindly.",
        "Back up irreplaceable local data and test migration on a copy.",
        "Verify offline reads, writes, reconnect, and shutdown after the upgrade.",
      ] },
    ],
  },
];

export function getDocPage(slug: string[] | string | undefined) {
  const normalized = Array.isArray(slug) ? slug.join("/") : slug ?? "";
  return docsPages.find((page) => page.slug === normalized);
}

export function getDocStaticParams() {
  return docsPages.filter((page) => page.slug).map((page) => ({ slug: page.slug.split("/") }));
}

export function getDocMarkdown(page: DocPage) {
  const lines = [`# ${page.title}`, "", page.description, "", `Content reviewed: ${page.verifiedOn}`, ""];
  for (const block of page.blocks) {
    if (block.type === "lead" || block.type === "paragraph") lines.push(block.text, "");
    if (block.type === "heading") lines.push(`## ${block.text}`, "");
    if (block.type === "list") lines.push(...block.items.map((item) => `- ${item}`), "");
    if (block.type === "steps") block.items.forEach((item, index) => { lines.push(`${index + 1}. ${item.title}`, "", item.body, ""); if (item.code) lines.push(`\`\`\`${item.language || "bash"}`, item.code, "```", ""); });
    if (block.type === "code") lines.push(`\`\`\`${block.language}`, block.code, "```", "");
    if (block.type === "callout") lines.push(`> ${block.title}: ${block.body}`, "");
    if (block.type === "cards") block.items.forEach((item) => lines.push(`### ${item.title}`, "", item.body, "", ...(item.href ? [`[Read more](${item.href})`, ""] : [])));
    if (block.type === "start-paths") gettingStartedPaths.forEach((path) => lines.push(`### ${path.title} — ${path.badge}`, "", path.description, "", `[${path.action}](${path.href})`, ""));
    if (block.type === "actions") block.items.forEach((item) => lines.push(`[${item.label}](${item.href})`, ""));
  }
  return lines.join("\n").trim();
}

export function getAllDocsMarkdown() {
  return docsPages.map((page) => `# ${page.title} (/docs/${page.slug})\n\n${getDocMarkdown(page)}`).join("\n\n---\n\n");
}
