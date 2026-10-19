import { defaultScaffoldCommand, siteConfig, supportMatrix } from "@/lib/release";
import { gettingStartedGuides, gettingStartedPaths } from "@/lib/getting-started";
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
  { title: "Get started", pages: [{ title: "Overview", slug: "" }, { title: "Choose your path", slug: "quickstart" }, { title: "Claude Code", slug: "start/claude" }, { title: "Codex", slug: "start/codex" }, { title: "Raw CLI", slug: "start/cli" }] },
  { title: "Build", pages: [{ title: "Project architecture", slug: "architecture" }, { title: "Assistant workflow", slug: "agent-pack" }, { title: "Local AI", slug: "local-ai" }] },
  { title: "Connect", pages: [{ title: "P2P and pairing", slug: "connect" }, { title: "Personal Node", slug: "node" }] },
  { title: "Package APIs", pages: [{ title: "P2P runtime", slug: "p2p" }, { title: "Runnable examples", slug: "p2p/examples" }, { title: "Typed RPC", slug: "p2p/rpc" }, { title: "Replication", slug: "p2p/sync" }, { title: "Database prototype", slug: "p2p/database" }, { title: "Capability roadmap", slug: "p2p/roadmap" }, { title: "AI lifecycle", slug: "runtime-ai" }, { title: "Node Desktop", slug: "node-desktop" }, { title: "Deferred packages", slug: "experiments" }] },
  { title: "Reference", pages: [{ title: "Packages & integrations", slug: "packages" }, { title: "CLI commands", slug: "cli" }, { title: "Modules", slug: "modules" }] },
  { title: "Operate", pages: [{ title: "Compatibility", slug: "compatibility" }, { title: "Troubleshooting", slug: "troubleshooting" }, { title: "Support & limitations", slug: "support" }, { title: "Upgrades", slug: "upgrades" }] },
];

const verifiedOn = siteConfig.verifiedOn;

export const docsPages: DocPage[] = [
  ...gettingStartedGuides,
  ...packageDocs,
  {
    slug: "packages",
    title: "Packages and integrations",
    description: "The CLI, one P2P library, assistant plugins and direct upstream SDK integrations.",
    category: "Reference",
    verifiedOn: "16 October 2026",
    blocks: [
      { type: "lead", text: "Start through Claude Code, Codex or the raw CLI. The plugins guide your assistant; the CLI configures workspaces and generates apps. Apps use one Unstoppable P2P library and upstream QVAC or wallet SDKs when needed." },
      { type: "heading", text: "Packages we maintain" },
      { type: "list", items: [
        "@unstoppable-stack/cli: workspace setup, scaffolding and environment checks. Version 0.4.0-beta.1 is published under beta; install that exact version. Version 0.3.0 remains the earlier latest release.",
        "@unstoppable-stack/p2p: identity, pairing, permissions, capability calls and streaming. Replication is the /sync entry of the same package. The consolidated 0.6.0-alpha.1 is published under alpha; install that exact version.",
        "unstoppable-stack plugins for Claude Code and Codex: two host distributions from shared guidance. Local prototypes exist; public marketplace listings remain pending. Local-install preview downloads are available in the Claude and Codex guides.",
        "unstoppable-node: optional Personal Node application. Published 0.4.0 has a different API from the reorganized, unpublished 0.6.0-alpha.2 source. It is outside the core preview.",
      ] },
      { type: "code", language: "bash", code: "npm install @unstoppable-stack/p2p@0.6.0-alpha.1" },
      { type: "code", language: "js", code: "// Published alpha imports.\nimport { createNode } from '@unstoppable-stack/p2p'\nimport { syncPack } from '@unstoppable-stack/p2p/sync'" },
      { type: "heading", text: "Use upstream SDKs directly" },
      { type: "paragraph", text: "QVAC owns inference. Generated apps use its SDK or inference packages for their runtime, with small private lifecycle helpers for cancellation and shutdown. Personal Node's delegated AI adapter is internal application code. Wallet integration will use WDK directly; current wallet scaffolds are stubs." },
      { type: "heading", text: "Release boundaries" },
      { type: "paragraph", text: "Memory and Search are excluded from this release. The website, shared agent-pack source and runtime helpers are internal packages. The P2P root does not load replication, but npm installs the storage dependencies with the library. Published releases and unpublished source candidates must use their own version-matched instructions." },
      { type: "heading", text: "Feature and API references" },
      { type: "cards", items: [
        { title: "CLI", body: "Workspace setup, supported scaffold targets, feature flags and compatibility checks.", href: "/docs/cli" },
        { title: "Agent pack and plugins", body: "Shared skills, recipes, hooks and project guidance for Claude Code, Cursor, OpenCode and Codex.", href: "/docs/agent-pack" },
        { title: "P2P runtime", body: "Identity, invites, discovery, app networks, grants, calls and streams.", href: "/docs/p2p" },
        { title: "P2P replication", body: "Resource manifests, peer ownership, protection, usage and pause/resume.", href: "/docs/p2p/sync" },
        { title: "Personal Node", body: "Optional host composition, local management and delegated AI.", href: "/docs/node" },
        { title: "Node Desktop", body: "Operator dashboard, approval controls, tray and Bare sidecar.", href: "/docs/node-desktop" },
        { title: "AI lifecycle helpers", body: "Private vendored sessions, cancellation and runtime adapters.", href: "/docs/runtime-ai" },
        { title: "Deferred packages", body: "Memory implementations and experimental feature boundaries.", href: "/docs/experiments" },
        { title: "Capability roadmap", body: "Original cloud-like services, current implementation and remaining gaps.", href: "/docs/p2p/roadmap" },
      ] },
      { type: "start-paths" },
      { type: "cards", items: [
        { title: "Choose a setup guide", body: "Install a plugin preview or the published CLI.", href: "/getting-started" },
        { title: "Assistant workflow", body: "Understand how guidance and scaffolding work together.", href: "/docs/agent-pack" },
        { title: "Upgrades", body: "Inspect compatibility differences before migrating an existing app.", href: "/docs/upgrades" },
      ] },
    ],
  },
  {
    slug: "",
    title: "Documentation",
    description: "Task-based guidance for the Unstoppable Stack developer preview.",
    category: "Start",
    verifiedOn,
    blocks: [
      { type: "lead", text: "Unstoppable Stack helps developers create local-first applications with direct peer communication and optional on-device AI. Choose Claude Code, Codex or the raw CLI to build the Pear Desktop baseline. Capabilities outside that baseline carry an explicit maturity label." },
      { type: "start-paths" },
      { type: "cards", items: [
        { title: "Packages and integrations", body: "One P2P library, direct upstream SDKs and optional applications.", href: "/docs/packages" },
        { title: "Understand the boundaries", body: "Learn what is local, what needs a reachable peer, and what the project does and does not retain.", href: "/docs/support" },
        { title: "Check compatibility", body: "Use one support table for platforms, features, and combinations instead of relying on promotional copy.", href: "/docs/compatibility" },
      ] },
      { type: "heading", text: "Preview principles" },
      { type: "list", items: [
        "Local-first: useful reads and writes should not depend on a central application API.",
        "Peer availability is optional: show disconnected state and resume cleanly.",
        "Runtime boundaries matter: renderer UI calls a worker that owns networking, storage, and native AI resources.",
        "Planned features are not default benefits: wallet payments are not part of the supported preview path.",
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
      { type: "paragraph", text: "multi-writer and node-sync cannot be selected together. Multi-writer uses an Autobee writer set, while the current Node registration path handles the single base data core. The CLI rejects the combination instead of generating incomplete protection." },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Recognizable symptoms, one diagnostic, and one safe recovery action.",
    category: "Start",
    verifiedOn,
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
    verifiedOn,
    blocks: [
      { type: "lead", text: "The primary desktop pattern separates the renderer from a worker. This is a runtime requirement, not just code organization." },
      { type: "list", items: [
        "Renderer: UI state, user interactions, and narrow bridge calls.",
        "Worker: Hyperswarm, Corestore, Hyperbee, Hyperdrive, QVAC, and cleanup.",
        "Bridge: typed messages with timeouts, errors, and visible status.",
        "Optional Node: a separate peer for replication or delegated inference; local work must survive its absence.",
      ] },
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
      { type: "paragraph", text: "Plugin installation adds guidance, not the CLI or native dependencies. The entry skill checks the installed CLI catalog before scaffolding. Existing apps keep their recorded runtime and project instructions; updating the plugin does not migrate them." },
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
      { type: "list", items: [
        "Keep model initialization in the worker, never the renderer.",
        "Report download, loading, ready, and error states separately.",
        "Use mock inference for deterministic UI and protocol tests; label it as mock.",
        "After a successful model install, test local inference without internet access.",
        "Do not publish a universal RAM or download-size claim until the chosen model is pinned and measured.",
      ] },
    ],
  },
  {
    slug: "connect",
    title: "P2P and pairing",
    description: "Peer discovery, invitations, approval, and disconnect behavior.",
    category: "Connect",
    verifiedOn,
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
        "PersonalNode.start()/close() manage the host. getStatus() reports all peers, resources, quotas, invitations and AI readiness to the owner.",
        "getConfig()/updateConfig(patch), setPeerQuota, setPeerGrant, pausePeer/resumePeer and unpairPeer control local policy and trust.",
        "enableAI/disableAI manage optional QVAC or labelled mock inference. Granted peers call ai.completion.stream; the AI adapter is internal application code.",
        "createInvite/listInvites/revokeInvite manage scoped invitations. getDiskUsage and peekCore/peekDrive are local operator diagnostics.",
        "exportState/importState handle settings and peer metadata. They include the sensitive identity seed and revocation records, but no replicated app payloads.",
      ] },
      { type: "paragraph", text: "These local methods drive the daemon CLI and desktop dashboard. They are not remote peer.api methods. Remote peers receive granted sync methods and optional completion streaming, scoped to their authenticated identity. Quotas pause replication and gate registration/resume; they are not hard filesystem limits." },
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
    verifiedOn,
    blocks: [
      { type: "lead", text: `CLI ${siteConfig.cli.version} is the published beta: init, scaffold, doctor and compatibility checks. Earlier latest ${siteConfig.cli.latestVersion} also exposes the deferred node command. Install the exact beta for this guide.` },
      { type: "code", language: "bash", code: "us --version\nus --help\nus init [project-name] --assistant <claude|codex|cursor|opencode|none>\nus scaffold app -p pear-desktop -n <name>\nus scaffold list-platforms\nus scaffold list-features\nus doctor -p pear-desktop" },
      { type: "heading", text: "Compatibility commands" },
      { type: "paragraph", text: "The published 0.4.0-beta.1 adds the read-only commands below. They are absent from earlier 0.3.0. Remote, Research, Search and Memory are not shipped in the minimal release artifact; Personal Node is an optional separate app." },
      { type: "code", language: "bash", code: "us compatibility list -o <workspace>\nus compatibility check -o <app>" },
      { type: "heading", text: "Scaffold facts" },
      { type: "list", items: [
        "The published beta exposes pear-desktop. Expo Mobile and Node CLI remain deferred source targets.",
        "Base Hyperswarm/Corestore networking and Hyperbee storage are always included.",
        "The published beta exposes local-ai. Wallet (stub), node-sync, node-host and multi-writer remain deferred source features.",
        "multi-writer and node-sync are rejected when combined.",
        "Node CLI is a Node.js command-line target; it is not described as a Bare-only app.",
      ] },
    ],
  },
  {
    slug: "modules",
    title: "Modules",
    description: "The runtime modules used by generated applications.",
    category: "Reference",
    verifiedOn,
    blocks: [
      { type: "cards", items: [
        { title: "Pear and Bare", body: "Application and minimal JavaScript runtimes from Holepunch." },
        { title: "Hyperswarm", body: "Peer discovery and encrypted connections over the DHT." },
        { title: "Hypercore and Corestore", body: "Append-only logs and lifecycle management for collections of cores." },
        { title: "Hyperbee / HyperDB", body: "Local key-value storage and the validated multi-writer collection pattern." },
        { title: "Hyperdrive", body: "Versioned P2P file storage built on Hypercore." },
        { title: "QVAC", body: "Optional local model management and inference." },
        { title: "WDK", body: "Planned wallet integration; not a supported preview capability." },
      ] },
    ],
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
    verifiedOn,
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
  const lines = [`# ${page.title}`, "", page.description, "", `Verified: ${page.verifiedOn}`, ""];
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
