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
  blocks: DocBlock[];
};

export const docsNav = [
  {
    title: "Start",
    pages: [
      { title: "Overview", slug: "" },
      { title: "Quickstart", slug: "quickstart" },
      { title: "CLI Reference", slug: "cli" },
    ],
  },
  {
    title: "Platforms",
    pages: [
      { title: "Pear Desktop", slug: "platforms/pear-desktop" },
      { title: "Expo Mobile", slug: "platforms/expo-mobile" },
      { title: "Node CLI", slug: "platforms/node-cli" },
    ],
  },
  {
    title: "Stack",
    pages: [
      { title: "Unstoppable Node", slug: "node" },
      { title: "Node Client SDK", slug: "node-client" },
      { title: "Modules", slug: "modules" },
      { title: "Agent Pack", slug: "agent-pack" },
      { title: "Recipes", slug: "recipes" },
    ],
  },
];

export const docsPages: DocPage[] = [
  {
    slug: "",
    title: "Documentation",
    description:
      "Build local-first applications with P2P networking, local AI, self-custodial payments, and assistant-aware scaffolding.",
    category: "Start",
    blocks: [
      {
        type: "lead",
        text: "The Unstoppable Stack is a developer toolchain for apps that keep working without central servers. It combines Holepunch P2P infrastructure, QVAC local inference, WDK payments, a CLI, and portable AI assistant instructions.",
      },
      {
        type: "cards",
        items: [
          {
            title: "Start with the CLI",
            body: "Use `us init` or `us scaffold` to create a Pear Desktop, Expo Mobile, or Node CLI app with agent instructions included.",
            href: "/docs/quickstart",
          },
          {
            title: "Learn the runtime model",
            body: "Apps run locally, discover peers through Hyperswarm, replicate data with Hypercore-based stores, and can pair with an Unstoppable Node.",
            href: "/docs/modules",
          },
          {
            title: "Use AI assistants safely",
            body: "The agent pack gives Claude, Cursor, OpenCode, and Codex grounded recipes for this stack instead of generic web-app assumptions.",
            href: "/docs/agent-pack",
          },
        ],
      },
      { type: "heading", text: "Core Principles" },
      {
        type: "list",
        items: [
          "Local-first: the app should stay useful offline and sync opportunistically.",
          "Peer-to-peer by default: discovery and replication happen without an application server.",
          "Private inference: QVAC runs models locally or through a user-controlled node.",
          "Assistant-aware development: scaffolded projects include context for the AI tool the developer chooses.",
        ],
      },
      {
        type: "callout",
        title: "QVAC docs reference",
        body: "This docs section follows QVAC's useful patterns: structured source content, generated navigation, static pages, and LLM-readable text exports.",
      },
    ],
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    description: "Install the CLI, scaffold an app, run it locally, and start building with an assistant.",
    category: "Start",
    blocks: [
      {
        type: "lead",
        text: "The fastest path is to install the CLI, scaffold an app for your target platform, and let the generated assistant instructions guide the next change.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Install the CLI",
            body: "Install the `us` command globally when the package is published, or work from the CLI package during local development.",
            code: "npm install -g @unstoppable-stack/cli",
          },
          {
            title: "Create a project",
            body: "Use the interactive flow when you want the CLI to ask for project name and assistant target.",
            code: "us init my-app",
          },
          {
            title: "Scaffold a specific app",
            body: "Use `us scaffold app` when you already know the platform and features.",
            code: "us scaffold app -p pear-desktop -n my-app -f local-ai,node-sync",
          },
          {
            title: "Run the app",
            body: "Follow the generated README. Most projects start with dependency install and a dev command.",
            code: "cd my-app\npnpm install\npnpm dev",
          },
        ],
      },
      { type: "heading", text: "Choose A Platform" },
      {
        type: "cards",
        items: [
          {
            title: "Pear Desktop",
            body: "Desktop P2P app with a renderer and worker split.",
            href: "/docs/platforms/pear-desktop",
          },
          {
            title: "Expo Mobile",
            body: "React Native app with a Bare worklet for P2P and local runtime code.",
            href: "/docs/platforms/expo-mobile",
          },
          {
            title: "Node CLI",
            body: "Terminal app for scripts, daemons, agents, and quick P2P experiments.",
            href: "/docs/platforms/node-cli",
          },
        ],
      },
    ],
  },
  {
    slug: "cli",
    title: "CLI Reference",
    description: "The `us` command creates projects, scaffolds app targets, checks environments, and runs research workflows.",
    category: "Start",
    blocks: [
      {
        type: "lead",
        text: "The CLI is the entry point for creating Unstoppable Stack projects. It installs the right app structure and assistant context for the selected target.",
      },
      { type: "heading", text: "Common Commands" },
      {
        type: "code",
        language: "bash",
        code: "us init [project-name]\nus scaffold app -p <platform> -n <name> [-f features]\nus scaffold list-platforms\nus scaffold list-features\nus doctor\nus doctor -p expo-mobile\nus research list\nus research run <experiment-id>\nus research scaffold-test",
      },
      { type: "heading", text: "Platforms" },
      {
        type: "list",
        items: [
          "`pear-desktop`: desktop app using Pear, a renderer, and a worker process.",
          "`expo-mobile`: React Native app with Bare runtime integration for P2P code.",
          "`node-cli`: Node-based command line app for local-first services and experiments.",
        ],
      },
      { type: "heading", text: "Feature Flags" },
      {
        type: "list",
        items: [
          "`local-ai`: add QVAC-powered local inference or mock-mode compatible AI flows.",
          "`node-sync`: connect scaffolded apps to the local Unstoppable Node for data/files/AI services.",
          "`wallet`: add the current WDK wallet integration stub where supported.",
        ],
      },
    ],
  },
  {
    slug: "platforms/pear-desktop",
    title: "Pear Desktop",
    description: "Build desktop P2P applications with Pear, Bare, a renderer process, and a worker process.",
    category: "Platforms",
    blocks: [
      {
        type: "lead",
        text: "Pear Desktop is the primary target for rich local-first applications. UI code stays in the renderer; P2P, storage, and AI runtime work belongs in the worker.",
      },
      { type: "heading", text: "Runtime Shape" },
      {
        type: "list",
        items: [
          "Renderer: React UI, bridge calls, status display, user interactions.",
          "Worker: Hyperswarm, Corestore, Hyperbee, Hyperdrive, QVAC, long-running services.",
          "Bridge: message boundary between UI and runtime code. Keep it typed and narrow.",
        ],
      },
      {
        type: "callout",
        title: "Important",
        body: "Do not put peer networking or database state directly in the renderer. Keep long-lived resources in the worker and close them on shutdown.",
      },
      {
        type: "code",
        language: "bash",
        code: "us scaffold app -p pear-desktop -n desktop-app -f local-ai,node-sync",
      },
    ],
  },
  {
    slug: "platforms/expo-mobile",
    title: "Expo Mobile",
    description: "Build mobile local-first apps with React Native UI and Bare-powered runtime code.",
    category: "Platforms",
    blocks: [
      {
        type: "lead",
        text: "Expo Mobile support uses a split architecture: React Native renders the interface while a Bare worklet runs P2P and storage code that needs the Holepunch runtime.",
      },
      { type: "heading", text: "Design Rules" },
      {
        type: "list",
        items: [
          "Keep UI state and mobile navigation in React Native.",
          "Run Hyperswarm, Hypercore, Hyperbee, and Corestore code inside the Bare worklet.",
          "Use IPC/RPC messages between React Native and the worklet.",
          "Treat mobile networking as intermittent; persist locally first and sync later.",
        ],
      },
      {
        type: "code",
        language: "bash",
        code: "us scaffold app -p expo-mobile -n mobile-app -f local-ai,node-sync",
      },
    ],
  },
  {
    slug: "platforms/node-cli",
    title: "Node CLI",
    description: "Use Node CLI apps for agents, daemons, scripts, and fast local-first experiments.",
    category: "Platforms",
    blocks: [
      {
        type: "lead",
        text: "Node CLI is the simplest target for learning the stack or building automation. It avoids UI complexity while keeping the same P2P and data modules.",
      },
      { type: "heading", text: "Good Uses" },
      {
        type: "list",
        items: [
          "P2P command line tools and local daemons.",
          "Agent tools that need local storage or peer discovery.",
          "Fast experiments before promoting a feature to desktop or mobile.",
        ],
      },
      {
        type: "code",
        language: "bash",
        code: "us scaffold app -p node-cli -n p2p-tool -f node-sync",
      },
    ],
  },
  {
    slug: "node",
    title: "Unstoppable Node",
    description: "Run a user-controlled P2P hub for app pairing, verified data retention, file seeding, and optional AI inference.",
    category: "Stack",
    blocks: [
      {
        type: "lead",
        text: "The Unstoppable Node is an optional, always-on companion for local-first apps. It discovers apps through Hyperswarm, stores paired-app registrations, replicates app-owned Hypercores and Hyperdrives, and can serve mock or QVAC-backed inference. Apps must remain useful when it is unavailable.",
      },
      { type: "heading", text: "Install And Run" },
      {
        type: "code",
        language: "bash",
        code: "npm install -g unstoppable-node\nunstoppable-node start\n\n# Development without a model download\nunstoppable-node start --ai-mock\n\n# Friendlier background-process wrapper\nus node start --ai-mock\nus node status -n 20\nus node stop",
      },
      {
        type: "callout",
        title: "Default storage",
        body: "The standalone daemon stores state under ~/.unstoppable-node. Pass --storage <path> to use another directory. AI is opt-in: the Personal Node desktop app bundles the pinned QVAC SDK; source checkouts must install @qvac/sdk@0.15.0 beside packages/node. Use --ai-mock when the SDK is unavailable.",
      },
      { type: "heading", text: "Services" },
      {
        type: "cards",
        items: [
          { title: "Data", body: "Corestore-backed replication for app-registered Hypercore and Hyperbee resources." },
          { title: "Files", body: "Hyperdrive metadata replication, optional full blob retention, and seeding." },
          { title: "AI", body: "Optional streaming inference through a mock provider or an installed @qvac/sdk model." },
          { title: "Status", body: "App-scoped service, replication, protection, storage-use, and quota state." },
        ],
      },
      { type: "heading", text: "Pairing And Capabilities" },
      {
        type: "list",
        items: [
          "A node and client on the same user account and machine derive the same machine-local discovery topic.",
          "The node sends nodeHello with protocol version v1, service flags, and supported capabilities before pairing.",
          "Pairing grants only requested methods that the node currently supports. The desktop dashboard can require explicit approval; a headless daemon without an approval callback auto-accepts.",
          "App-facing status is scoped to the requesting app: it cannot reveal another app's registrations, storage paths, or usage.",
        ],
      },
      { type: "heading", text: "Replication And Protection" },
      {
        type: "list",
        items: [
          "Legacy cores/drives registration preserves sparse replication and is equivalent to metadata-only protection.",
          "A schemaVersion 1 resource manifest gives each resource a stable ID and chooses metadata-only or mirror protection.",
          "mirror downloads and verifies every block in the currently observed Hypercore or Hyperbee checkpoint, and file metadata plus every referenced Hyperdrive blob.",
          "protected applies to the observed checkpoint, not future writes. Keep checking protection state after the app writes new data.",
          "Replacing a manifest stops replication for omitted resources but deliberately does not delete bytes already retained by the node.",
        ],
      },
      {
        type: "callout",
        title: "Protection is not a complete backup",
        body: "The settings export contains config, paired-app registry records, and dashboard trust decisions. It does not contain Corestore payloads, stable node identity seeds, or replicated app data. Keep an independent recovery plan for irreplaceable data.",
      },
      { type: "heading", text: "Storage Quotas" },
      {
        type: "paragraph",
        text: "Global and per-app quotas are advisory safety limits. When usage exceeds a configured limit, the node pauses that app's replication announcements; it does not delete existing bytes, and in-flight writes may still arrive. Raise or clear the quota before resuming the app.",
      },
      { type: "heading", text: "Settings Export And Import" },
      {
        type: "code",
        language: "bash",
        code: "unstoppable-node export ./node-settings.uns\nunstoppable-node inspect ./node-settings.uns\nunstoppable-node import ./node-settings.uns --storage ./restored-node",
      },
      {
        type: "cards",
        items: [
          {
            title: "Connect An App",
            body: "Use @unstoppable-stack/node-client from Node.js, Bare, Pear Desktop, or Expo Bare.",
            href: "/docs/node-client",
          },
        ],
      },
    ],
  },
  {
    slug: "node-client",
    title: "Node Client SDK",
    description: "Connect Node.js and Bare apps to a local Unstoppable Node for scoped replication, protection status, and delegated inference.",
    category: "Stack",
    blocks: [
      {
        type: "lead",
        text: "@unstoppable-stack/node-client is the app-side SDK. It runs under Node.js and Bare-based runtimes that provide Hyperswarm, including Pear Desktop and Expo Bare. connectToNode resolves only after discovery, pairing, and resource registration complete.",
      },
      { type: "heading", text: "Install" },
      {
        type: "code",
        language: "bash",
        code: "npm install @unstoppable-stack/node-client\n\n# Start a development node in another terminal\nnpx unstoppable-node start --ai-mock",
      },
      { type: "heading", text: "Connect And Fall Back" },
      {
        type: "code",
        language: "js",
        code: "import { connectToNode, NodeNotFoundError } from '@unstoppable-stack/node-client'\n\nlet nodeClient = null\ntry {\n  nodeClient = await connectToNode({\n    appId: 'com.example.notes',\n    appName: 'Notes',\n    deviceName: 'Simons Laptop',\n    requireServices: ['data'],\n    reconnect: true,\n    cores: [{ key: notes.core.key, type: 'hyperbee', name: 'notes' }]\n  })\n} catch (error) {\n  if (!(error instanceof NodeNotFoundError)) throw error\n  // Continue in device-only mode; retry when appropriate.\n}",
      },
      {
        type: "callout",
        title: "Local-first contract",
        body: "A missing or disconnected node should reduce availability or redundancy, not make the app unusable. Keep the app's primary data locally and expose node state honestly in the UI.",
      },
      { type: "heading", text: "Verified Resource Retention" },
      {
        type: "paragraph",
        text: "Prefer a complete resource manifest when resources can change over time or the product promises that the node retains their full contents. Call replaceResourceManifest with the complete next set whenever a writer or resource is added or removed.",
      },
      {
        type: "code",
        language: "js",
        code: "const client = await connectToNode({\n  appId: 'com.example.photos',\n  appName: 'Photos',\n  reconnect: true,\n  resourceManifest: {\n    schemaVersion: 1,\n    resources: [\n      {\n        id: 'catalog-writer-laptop',\n        kind: 'hyperbee',\n        key: catalog.core.key,\n        name: 'Photo catalog',\n        metadata: { role: 'catalog-writer' },\n        protection: { mode: 'mirror' }\n      },\n      {\n        id: 'originals',\n        kind: 'hyperdrive',\n        key: originals.key,\n        name: 'Original photos',\n        protection: { mode: 'mirror' }\n      }\n    ]\n  }\n})\n\nawait client.replaceResourceManifest(nextCompleteManifest)\nconst { resources } = await client.getProtectionStatus()\nconst protectedNow = resources.every(\n  (resource) => resource.protection?.state === 'protected'\n)",
      },
      {
        type: "list",
        items: [
          "Resource kinds are hypercore, hyperbee, and hyperdrive; protection modes are metadata-only and mirror.",
          "IDs must be stable within the app installation. Keys may be 32-byte buffers in the client API and are normalized to 64-character hex strings.",
          "A manifest is a full replacement, not a patch. Omitted resources stop replicating, while retained blocks remain on disk.",
          "Protection states are metadata-only, pending, syncing, protected, or error. Progress fields differ between cores and drives.",
        ],
      },
      { type: "heading", text: "Client Methods" },
      {
        type: "cards",
        items: [
          { title: "getNodeStatus()", body: "Returns a fresh app-scoped snapshot and emits nodeStatus. The node storage path and other apps remain hidden." },
          { title: "getProtectionStatus()", body: "Returns a normalized protection view for this app's registered cores and drives." },
          { title: "getDiskUsage()", body: "Returns this app's logical replicated bytes with scope: self; it does not expose filesystem paths or global use." },
          { title: "replaceResourceManifest()", body: "Replaces the complete registered resource set. Requires the resources.manifest.replace grant." },
          { title: "requestInference()", body: "Streams token strings as an async generator. Supports AbortSignal and a timeout; require the ai service when it is essential." },
          { title: "peekCore() / peekDrive()", body: "Debug inspection for this app's registered resources. These require an explicit resources.peek capability request and grant." },
          { title: "sendHeartbeat()", body: "Sends the app uptime when paired. It is a notification, not a connection-health guarantee." },
          { title: "close()", body: "Stops reconnect attempts, closes discovery resources, and rejects pending operations." },
        ],
      },
      { type: "heading", text: "Inference" },
      {
        type: "code",
        language: "js",
        code: "const controller = new AbortController()\nfor await (const token of client.requestInference({\n  messages: [{ role: 'user', content: 'Summarize my notes' }],\n  signal: controller.signal,\n  timeout: 120_000\n})) {\n  process.stdout.write(token)\n}",
      },
      { type: "heading", text: "Events And Errors" },
      {
        type: "list",
        items: [
          "Discovery and pairing: searching, candidateFound, nodeHello, registered, and pairDenied.",
          "Lifecycle: disconnected, reconnecting, reconnected, reconnectFailed, and resourceManifestReplaced.",
          "Status and protocol: nodeStatus, nodeError, and message.",
          "Stable primary error codes: NODE_NOT_FOUND, NODE_DENIED, NODE_MISSING_SERVICE, INVALID_OPTION, CLOSED, and INFERENCE_ERROR. Request-specific failures also use NodeClientError with codes such as CAPABILITY_DENIED or a timeout code.",
        ],
      },
      { type: "heading", text: "Discovery And Device Linking" },
      {
        type: "paragraph",
        text: "By default the SDK derives a machine-local topic from the current user, hostname, and protocol version, so same-machine processes meet without configuration. A phone or second computer will not discover that topic automatically. Cross-device products must provide an explicit authenticated device-linking flow before sharing an override topic; the SDK does not yet provide that onboarding flow.",
      },
      {
        type: "code",
        language: "js",
        code: "await client.close()",
      },
    ],
  },
  {
    slug: "modules",
    title: "Modules",
    description: "The core runtime, networking, data, AI, payment, and mobile modules used by the stack.",
    category: "Stack",
    blocks: [
      {
        type: "lead",
        text: "The stack is composed from small modules. Prefer the module that matches the data model instead of forcing everything into one store.",
      },
      {
        type: "cards",
        items: [
          { title: "Pear", body: "Desktop runtime for P2P applications." },
          { title: "Bare", body: "Embeddable JavaScript runtime used by Pear and mobile worklets." },
          { title: "Hyperswarm", body: "Peer discovery and connection over DHT topics." },
          { title: "Hypercore", body: "Append-only log and replication foundation." },
          { title: "Corestore", body: "Manages many Hypercores under shared storage and replication." },
          { title: "Hyperbee", body: "Sorted key-value database built on Hypercore." },
          { title: "Hyperdrive", body: "P2P filesystem for larger files and directory trees." },
          { title: "HyperDB", body: "Multi-writer database pattern built on Autobase." },
          { title: "QVAC", body: "Local AI inference, embeddings, RAG, transcription, vision, and related capabilities." },
          { title: "WDK", body: "Self-custodial wallet and payments toolkit." },
        ],
      },
      { type: "heading", text: "Rules Of Thumb" },
      {
        type: "list",
        items: [
          "Use Hyperbee for small indexed records and range queries.",
          "Use Hyperdrive for blobs, files, and directory trees.",
          "Use Corestore when an app owns more than one core.",
          "Replicate before expecting remote data to be available.",
          "Always close swarms, cores, databases, drives, and model sessions on cleanup.",
        ],
      },
    ],
  },
  {
    slug: "agent-pack",
    title: "Agent Pack",
    description: "Portable assistant instructions for building Unstoppable Stack apps with Claude, Cursor, OpenCode, and Codex.",
    category: "Stack",
    blocks: [
      {
        type: "lead",
        text: "The agent pack gives AI coding assistants stack-specific context: architecture principles, module docs, recipes, skills, hooks, and reusable components.",
      },
      { type: "heading", text: "Supported Assistants" },
      {
        type: "list",
        items: [
          "Claude Code: project instructions and skills.",
          "Cursor: rules and commands.",
          "OpenCode: instructions, skills, agents, and permission-aware workflows.",
          "Codex: AGENTS.md and portable skills.",
        ],
      },
      { type: "heading", text: "Source Of Truth" },
      {
        type: "paragraph",
        text: "Canonical content lives in `packages/agent-pack/src/`. The CLI-bundled copy lives in `packages/cli/agent-pack-src/` and should be synced after agent-pack edits.",
      },
      {
        type: "callout",
        title: "For docs authors",
        body: "Website docs are public human-facing docs. Agent-pack docs are assistant-facing implementation guidance. Keep them aligned, but do not blindly render one as the other.",
      },
    ],
  },
  {
    slug: "recipes",
    title: "Recipes",
    description: "Common implementation paths for P2P data, local AI, mobile, testing, and payments.",
    category: "Stack",
    blocks: [
      {
        type: "lead",
        text: "Recipes are task-oriented guides. They should show working patterns, cleanup behavior, and test strategy rather than only describing APIs.",
      },
      {
        type: "cards",
        items: [
          { title: "P2P RPC", body: "Request/response calls over peer streams discovered by Hyperswarm." },
          { title: "KV Storage", body: "Local-first records with Hyperbee and replication through Corestore." },
          { title: "File Sharing", body: "Hyperdrive for files, manifests, and content-addressed sync." },
          { title: "Local AI Chat", body: "QVAC chat flow with mock mode for reliable tests." },
          { title: "RAG", body: "Embeddings, local search, and context assembly for private knowledge apps." },
          { title: "Mobile Runtime Split", body: "React Native UI plus Bare worklet IPC/RPC patterns." },
        ],
      },
      { type: "heading", text: "Recipe Quality Bar" },
      {
        type: "list",
        items: [
          "State when to use the recipe and when not to use it.",
          "Include a minimal working path before optional enhancements.",
          "Handle disconnection, cleanup, and offline behavior.",
          "Add a test or verification step that does not require live external services.",
        ],
      },
    ],
  },
];

export function getDocPage(slug: string[] | string | undefined) {
  const normalized = Array.isArray(slug) ? slug.join("/") : slug ?? "";
  return docsPages.find((page) => page.slug === normalized);
}

export function getDocStaticParams() {
  return docsPages
    .filter((page) => page.slug)
    .map((page) => ({ slug: page.slug.split("/") }));
}

export function getDocMarkdown(page: DocPage) {
  const lines = [`# ${page.title}`, "", page.description, ""];

  for (const block of page.blocks) {
    if (block.type === "lead" || block.type === "paragraph") {
      lines.push(block.text, "");
    }

    if (block.type === "heading") {
      lines.push(`## ${block.text}`, "");
    }

    if (block.type === "list") {
      lines.push(...block.items.map((item) => `- ${item}`), "");
    }

    if (block.type === "steps") {
      block.items.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.title}`, "", item.body, "");
        if (item.code) lines.push("```bash", item.code, "```", "");
      });
    }

    if (block.type === "code") {
      lines.push(`\`\`\`${block.language}`, block.code, "```", "");
    }

    if (block.type === "callout") {
      lines.push(`> ${block.title}: ${block.body}`, "");
    }

    if (block.type === "cards") {
      block.items.forEach((item) => {
        lines.push(`### ${item.title}`, "", item.body, "");
      });
    }
  }

  return lines.join("\n").trim();
}

export function getAllDocsMarkdown() {
  return docsPages
    .map((page) => `# ${page.title} (/docs/${page.slug})\n\n${getDocMarkdown(page)}`)
    .join("\n\n---\n\n");
}
