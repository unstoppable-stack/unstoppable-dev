import { defaultScaffoldCommand, siteConfig, supportMatrix } from "@/lib/release";

export type DocBlock =
  | { type: "lead"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; body: string; code?: string }[] }
  | { type: "code"; language: string; code: string }
  | { type: "callout"; title: string; body: string }
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
  { title: "Start", pages: [{ title: "Overview", slug: "" }, { title: "Quickstart", slug: "quickstart" }, { title: "Compatibility", slug: "compatibility" }, { title: "Troubleshooting", slug: "troubleshooting" }] },
  { title: "Build", pages: [{ title: "Project architecture", slug: "architecture" }, { title: "Assistant workflow", slug: "agent-pack" }, { title: "Local AI", slug: "local-ai" }] },
  { title: "Connect", pages: [{ title: "P2P and pairing", slug: "connect" }, { title: "Personal Node", slug: "node" }] },
  { title: "Reference", pages: [{ title: "CLI commands", slug: "cli" }, { title: "Modules", slug: "modules" }] },
  { title: "Operate", pages: [{ title: "Support & limitations", slug: "support" }, { title: "Upgrades", slug: "upgrades" }] },
];

const verifiedOn = siteConfig.verifiedOn;

export const docsPages: DocPage[] = [
  {
    slug: "",
    title: "Documentation",
    description: "Task-based guidance for the Unstoppable Stack developer preview.",
    category: "Start",
    verifiedOn,
    blocks: [
      { type: "lead", text: "Unstoppable Stack helps developers create local-first applications with direct peer communication and optional on-device AI. Start with the Pear Desktop baseline; capabilities outside that path carry an explicit maturity label." },
      { type: "cards", items: [
        { title: "Build the baseline", body: "Install the public CLI, configure an assistant workspace, run a desktop app, and verify local persistence.", href: "/getting-started" },
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
    title: "Quickstart",
    description: "The concise version of the supported Pear Desktop walkthrough.",
    category: "Start",
    verifiedOn,
    blocks: [
      { type: "lead", text: "Use this path for the fewest dependencies. It creates a base app with local storage and peer networking; it does not require a model, payment setup, or Personal Node." },
      { type: "steps", items: [
        { title: "Check tools", body: "Use Node.js 20 or newer and npm. The generated project installs Electron and pear-runtime locally.", code: "node --version\nnpm --version" },
        { title: "Install the released CLI", body: `The repository candidate is ${siteConfig.cli.candidateVersion}, but public docs remain pinned to the verified registry release.`, code: `${siteConfig.cli.installCommand}\n${siteConfig.cli.versionCommand}` },
        { title: "Create an assistant workspace", body: "Choose the assistant you actually use; the no-assistant option is valid.", code: "us init coffee-workspace\ncd coffee-workspace" },
        { title: "Scaffold the app", body: "Base P2P and Hyperbee storage are included automatically.", code: defaultScaffoldCommand },
        { title: "Run it", body: "Run from the generated application folder.", code: "cd coffee-notes\nnpm install\nnpm run dev" },
      ] },
      { type: "callout", title: "Need the full path?", body: "The Getting Started page includes a first change, persistence check, and symptom-based troubleshooting." },
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
      { type: "lead", text: "us init writes tool-specific instructions and progressively loaded skills. It does not replace review, testing, or explicit user approval for consequential actions." },
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
    ],
  },
  {
    slug: "node",
    title: "Personal Node",
    description: "Deferred alpha architecture for replication and delegated inference.",
    category: "Connect",
    verifiedOn,
    blocks: [
      { type: "lead", text: "The Personal Node is not required for a local app and is deferred from the core preview. Its alpha source explores retained replicas, file seeding, and delegated inference, but packaging, trust defaults, and replication-status gates remain open." },
      { type: "list", items: [
        "Replication protects observed data; it does not automatically guarantee future writes or a complete backup.",
        "Settings export does not imply that all replicated application payloads are included.",
        "Disconnecting pauses Node services but must not erase local data or block local reads and writes.",
        "Removing or unpairing an app stops replication and revokes access, but already downloaded blocks remain. The alpha has no per-app purge control.",
      ] },
    ],
  },
  {
    slug: "cli",
    title: "CLI commands",
    description: "The public command surface and current feature compatibility.",
    category: "Reference",
    verifiedOn,
    blocks: [
      { type: "code", language: "bash", code: "us init [project-name]\nus scaffold app -p <platform> -n <name> [-f features]\nus scaffold list-platforms\nus scaffold list-features\nus doctor\nus doctor -p pear-desktop\nus research list\nus research run <experiment-id>\nus research scaffold-test" },
      { type: "heading", text: "Scaffold facts" },
      { type: "list", items: [
        "Platforms in source: pear-desktop, expo-mobile, and node-cli. The launch guide defaults to pear-desktop.",
        "Base Hyperswarm/Corestore networking and Hyperbee storage are always included.",
        "Feature flags: local-ai, wallet (stub), node-sync, node-host (node-cli only), and multi-writer.",
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
      { type: "paragraph", text: "The repository and issue tracker are not yet anonymously accessible, so this draft does not publish a broken support action. Before launch, add a verified public destination. A useful report should include the CLI version, platform, exact command, expected result, and first relevant error with private data removed." },
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
    if (block.type === "steps") block.items.forEach((item, index) => { lines.push(`${index + 1}. ${item.title}`, "", item.body, ""); if (item.code) lines.push("```bash", item.code, "```", ""); });
    if (block.type === "code") lines.push(`\`\`\`${block.language}`, block.code, "```", "");
    if (block.type === "callout") lines.push(`> ${block.title}: ${block.body}`, "");
    if (block.type === "cards") block.items.forEach((item) => lines.push(`### ${item.title}`, "", item.body, ""));
  }
  return lines.join("\n").trim();
}

export function getAllDocsMarkdown() {
  return docsPages.map((page) => `# ${page.title} (/docs/${page.slug})\n\n${getDocMarkdown(page)}`).join("\n\n---\n\n");
}
