import type { DocBlock, DocPage } from "@/lib/docs";
import { siteConfig } from "@/lib/release";

const source = `${siteConfig.publicRepositoryUrl}/blob/main`;

export const capabilityCards = [
  { title: "Create a desktop app", body: "Preview · Generate a renderer, worker, local Hyperbee storage and peer networking. Start with a notes app, inventory tool or personal dashboard.", href: "/docs/start/cli" },
  { title: "Save data on the device", body: "Preview · Keep settings, notes and records available without an application server. Choose key-value records, indexed collections or files for your data model.", href: "/docs/modules#local-storage" },
  { title: "Call a trusted peer", body: "Alpha · Pair two apps and expose only approved methods, such as fetching a receipt or streaming a list of notes. No Personal Node is required.", href: "/docs/p2p/rpc" },
  { title: "Replicate records and files", body: "Alpha · Let another peer retain registered Hyperbee or Hyperdrive data and report replication progress. Replication alone is not a complete recovery workflow.", href: "/docs/p2p/sync" },
  { title: "Add a private AI assistant", body: "Being validated · Stream model responses on-device and connect app-owned tools. The Local Goods example combines a catalog, persistent cart and QVAC shopping assistant.", href: "/docs/local-ai" },
  { title: "Edit together, including offline", body: "Experimental source · The collaborative notes prototype merges writer logs after reconnecting. Your app defines the conflict rule; rich-text merging is not included.", href: "/docs/p2p/database" },
  { title: "Use an always-on peer", body: "Deferred alpha · Personal Node can retain declared resources or offer delegated completion streaming. Desktop controls manage trust and quotas; full recovery remains unfinished.", href: "/docs/node" },
  { title: "Explore planned capabilities", body: "Outside the core preview · Find the status of mobile, wallets, Memory, Search and other experiments before depending on them. Wallet scaffolds do not process payments.", href: "/docs/experiments" },
];

// One entry per library keeps purpose, use case and reference together.
export const libraries = [
  { group: "Application runtimes", entries: [
    { name: "Pear", purpose: "Desktop application runtime and distribution tooling.", example: "Use the Pear Desktop scaffold when you want an app window backed by a separate worker.", boundary: "The CLI's pear-desktop target is the preview entry point; individual examples may use Electron for their shell.", module: "pear" },
    { name: "Bare", purpose: "JavaScript runtime for the worker that owns native storage, networking and inference.", example: "Keep the UI responsive while a worker loads a model or exchanges data with a peer.", boundary: "Bare is not `Node.js`: use the documented bare-* modules and communicate with the renderer through IPC.", module: "bare" },
  ] },
  { group: "Peer networking", entries: [
    { name: "Hyperswarm", purpose: "Discovers peers on shared topics and establishes encrypted connections.", example: "Find another instance of your notes app and connect its replication stream.", boundary: "Discovery does not grant permission. Use application pairing and grants for access control.", module: "hyperswarm" },
    { name: "HyperDHT", purpose: "Underlying distributed discovery and public-key connections.", example: "Connect to a known peer key without a central application directory.", boundary: "Most apps should begin with the P2P library or Hyperswarm instead of owning low-level transport policy.", module: "hyperdht" },
  ] },
  { group: "Local storage", entries: [
    { name: "Hypercore", purpose: "Append-only data log that can be replicated between peers.", example: "Record a sequence of events and let another device read the replicated history.", boundary: "A log is a storage primitive; your app still defines its records and queries.", module: "hypercore" },
    { name: "Corestore", purpose: "Manages a collection of Hypercores and their storage lifecycle.", example: "Open named cores for settings and notes, then replicate the application's store through a peer connection.", boundary: "Keep the store in the worker and close it when the application shuts down.", module: "corestore" },
    { name: "Hyperbee", purpose: "Sorted key-value database over a Hypercore, with ranges and batched writes.", example: "Save a note under note:welcome and retrieve it after restarting the app. Base scaffolds include Hyperbee storage.", boundary: "Single-writer storage does not automatically become a collaborative database when replicated.", module: "hyperbee" },
    { name: "HyperDB", purpose: "Schema-driven collections and indexes with generated definitions.", example: "Define product collections and an index for finding products by category.", boundary: "Requires a schema build step. It is not the base scaffold's Hyperbee API or the `/db` prototype.", module: "hyperdb" },
    { name: "Hyperdrive", purpose: "Versioned file storage backed by Hypercore data and metadata.", example: "Store document attachments or images, then register the drive for replication.", boundary: "Files still need available blocks and application access controls; complete backup and restore are separate concerns.", module: "hyperdrive" },
  ] },
  { group: "Collaborative data", entries: [
    { name: "Autobase", purpose: "Orders multiple writer logs so an application can build a deterministic shared view.", example: "The experimental P2P `/db` notes example allows two writers to edit offline and converge after reconnecting.", boundary: "The source prototype uses Autobase. Writer admission and the conflict reducer belong to the application.", module: "autobase" },
    { name: "Autobee", purpose: "A separate experimental `multi-writer` Hyperbee implementation.", example: "Explore the deferred `multi-writer` scaffold for an app-owned shared key-value view.", boundary: "Autobee and Autobase have different APIs. The `multi-writer` scaffold cannot be combined with node-sync.", module: "autobee" },
  ] },
  { group: "AI and experimental integrations", entries: [
    { name: "QVAC", purpose: "Upstream local model SDK and inference engines.", example: "Add streaming chat or a shopping assistant that answers questions about your app's catalog.", boundary: "This project integrates selected text-generation workflows. QVAC's broader upstream capabilities are not all implemented or validated here. Keep native inference in the worker.", module: "qvac" },
    { name: "Expo Bare", purpose: "Experimental route to running Bare worklets in an Expo mobile application.", example: "Explore a mobile UI with native work handled outside the React renderer.", boundary: "Mobile remains outside the core preview and has a separate experimental AI implementation.", module: "expo-bare" },
    { name: "WDK", purpose: "Upstream wallet SDK intended for future wallet integration.", example: "A future app could add wallet functionality through WDK directly.", boundary: "Current generated wallet code is a stub. This project provides no working payment path.", module: "wdk" },
  ] },
];

export const moduleBlocks: DocBlock[] = [
  { type: "lead", text: "Choose libraries by the job your app needs to do. These are upstream building blocks; Unstoppable Stack supplies scaffolding, integration guidance and its own P2P library. You do not need every library to build an app." },
  { type: "actions", items: [{ label: "Unstoppable package APIs", href: "/docs/packages" }, { label: "Runnable examples", href: "/docs/examples" }] },
  ...libraries.flatMap(({ group, entries }): DocBlock[] => [
    { type: "heading", text: group },
    { type: "cards", items: entries.map((entry) => ({
      title: entry.name,
      body: `${entry.purpose} ${entry.example}`,
      href: `/docs/modules/${entry.module}`,
    })) },
  ]),
  { type: "heading", text: "Not sure where to start?" },
  { type: "paragraph", text: "Start with Hyperbee to save local records, Hyperswarm to understand peer discovery, or Pear to generate a desktop app. Each library page includes prerequisites, example files or scaffold commands, expected results, API essentials and troubleshooting. Experimental integrations remain labeled on their pages." },
  { type: "actions", items: [{ label: "Save your first note", href: "/docs/modules/hyperbee" }, { label: "Run a complete app", href: "/docs/examples" }, { label: "Check supported combinations", href: "/docs/compatibility" }] },
];

export const discoveryDocs: DocPage[] = [{
  slug: "examples",
  title: "Learn by running an app",
  description: "Three examples that connect library APIs to visible application behavior.",
  category: "Get started",
  verifiedOn: siteConfig.docsUpdatedOn,
  blocks: [
    { type: "lead", text: "Run these examples from a repository checkout with Node 22.17 or later. Each uses the local P2P source; the typed RPC and database APIs are available in published 0.6.0-alpha.2. Clone the repository first with the commands below. Each example section starts at that repository root; open a new terminal there when switching examples." },
    { type: "actions", items: [{ label: "Get the repository", href: siteConfig.publicRepositoryUrl }, { label: "Prefer a fresh scaffold?", href: "/docs/start/cli" }] },
    { type: "code", language: "bash", code: `git clone ${siteConfig.publicRepositoryUrl}.git unstoppable-examples\ncd unstoppable-examples` },
    { type: "actions", items: [{ label: "Prefer an isolated local-network example?", href: "/docs/connect" }] },
    { type: "heading", text: "Replicate notes between peers" },
    { type: "paragraph", text: "Use `openCollection` to copy JSON between two app instances. The library owns storage, discovery and replication; the example needs public UDP peer discovery and prints the copied note." },
    { type: "code", language: "bash", code: "npm ci --prefix packages/p2p\nnpm ci --prefix examples/p2p-data\nnpm run mirror --prefix examples/p2p-data" },
    { type: "list", items: ["**Look for:** Hello from another app, read from the second app’s local copy.", "**API:** `openCollection`, put, sync, get and close.", "**Boundary:** one writer, read-only replicas and a known download checkpoint. No automatic backup or conflict resolution."] },
    { type: "actions", items: [{ label: "Full replication walkthrough", href: "/docs/p2p/sync" }, { label: "Typed RPC reference", href: "/docs/p2p/rpc" }] },
    { type: "heading", text: "Merge offline edits" },
    { type: "paragraph", text: "Start with the managed collaborative database: Alice explicitly admits Bob, Bob writes a note, and Alice reads it. The advanced offline example also tests restart and conflict convergence." },
    { type: "code", language: "bash", code: "npm ci --prefix packages/p2p\nnpm ci --prefix examples/p2p-data\nnpm run collaborate --prefix examples/p2p-data" },
    { type: "list", items: ["**Look for:** Written by Bob, read from Alice’s local view.", "**API:** `openCollaborativeDatabase`, `members.add`, put, get and close.", "**Boundary:** no rich-text merge, administrator recovery, schema migration or complete backup. **Pairing alone does not authorize database writes.**"] },
    { type: "actions", items: [{ label: "Advanced offline example", href: `${source}/examples/p2p-database/README.md` }, { label: "Database reference", href: "/docs/p2p/database" }] },
    { type: "heading", text: "Build a local shopping assistant" },
    { type: "paragraph", text: "Local Goods combines a product catalog, persistent cart, demo order lookup, scoped peer receipt retrieval and optional QVAC chat. Electron displays the UI; a Bare worker owns storage, P2P and inference. The maintainer validation platform is macOS Apple Silicon; other platforms remain unverified." },
    { type: "code", language: "bash", code: "npm ci --prefix packages/p2p\ncd examples/ecommerce-assistant\nnpm ci\nnpm run dev" },
    { type: "list", items: ["**Try it:** add products, save a demo order, restart and look up its receipt. Load Assistant separately to ask about the catalog.", "**Libraries:** Bare worker, Hyperbee persistence, P2P scoped RPC and QVAC with vendored lifecycle helpers.", "**Boundary:** checkout records a demo order only; it does not charge money or fulfill purchases. AI requires a model download and separate native/offline acceptance."] },
    { type: "actions", items: [{ label: "Shopping walkthrough and requirements", href: `${source}/examples/ecommerce-assistant/README.md` }, { label: "Local AI integration", href: "/docs/local-ai" }] },
    { type: "heading", text: "Build your own version" },
    { type: "paragraph", text: "Start with the desktop scaffold, choose a local data model, then add one peer or AI interaction. Use the examples to learn contracts and behavior; keep your own schemas, prompts and UI in the app." },
    { type: "actions", items: [{ label: "Create a desktop app", href: "/docs/start/cli" }, { label: "Library guide", href: "/docs/modules" }, { label: "Validation and acceptance boundaries", href: `${source}/docs/validation.md` }] },
  ],
}];
