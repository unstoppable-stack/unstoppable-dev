import type { DocBlock, DocPage } from "@/lib/docs";
import { libraries } from "@/lib/discovery-docs";
import examples from "@/lib/library-examples.json";
import profiles from "../../../cli/src/compatibility/profiles.json";
import p2pManifest from "../../../p2p/package.json";
import { siteConfig } from "@/lib/release";

type Guide = {
  concepts: string[];
  api: string[];
  problems: string[];
  next: string;
  reference: string;
  note?: string;
};

const guides: Record<string, Guide> = {
  pear: {
    concepts: ["The scaffold creates an Electron desktop shell with pear-runtime and a Bare worker. The shell displays the app; the worker owns networking, persistent data and native inference.", "A narrow IPC bridge carries application messages between UI and worker. A renderer component should request a note, not open Corestore or load a native model.", "Local development and OTA distribution are separate steps. A running scaffold does not establish signed, packaged or cross-platform release acceptance."],
    api: ["PearRuntime.ready(): initialize the host runtime before starting worker work.", "PearRuntime.run(workerPath, args): launch a Bare worker. In that worker, Bare.IPC is the pipe and Bare.argv contains arguments.", "PearRuntime.close(): release host resources after the worker has closed its own stores and connections."],
    problems: ["Do not copy legacy pear run / global.Pear examples into this scaffold: the current host is Electron plus pear-runtime.", "If the window opens but storage fails, inspect the worker error in the launch terminal and run us doctor -p pear-desktop.", "Close the application window to end the example. Reopen with the same storage to test persistence."],
    next: "architecture", reference: "https://github.com/holepunchto/pear-runtime",
  },
  bare: {
    concepts: ["Bare executes JavaScript outside the browser. In this stack it runs long-lived worker code while the renderer handles the UI.", "It has a small runtime surface. File access, operating-system details and other services come from installed bare-* packages rather than Node's built-in modules.", "The example runs a finite worker-style task in Bare. Hosting it inside a desktop app additionally requires the scaffold's IPC bridge."],
    api: ["bare example.mjs: run an ES module with the Bare executable.", "Bare.IPC: the communication pipe supplied when a host launches a worker; it is not supplied by this standalone example.", "bare-fs, bare-process and b4a: explicit dependencies when code needs filesystem, process or Buffer-like functionality."],
    problems: ["A node:* import belongs to Node.js, not this runtime. Choose the corresponding bare-* module and install it.", "Do not assume browser APIs or a global Buffer are available. Keep browser-dependent UI code in the renderer.", "If bare is not found after installation, check your npm global bin directory and open a new terminal."],
    next: "modules/pear", reference: "https://github.com/holepunchto/bare",
  },
  hyperswarm: {
    concepts: ["A topic is a 32-byte discovery identifier. Peers looking for the same topic can find one another without your own application directory server.", "The connection event supplies an encrypted byte stream. Your protocol still needs framing, validation and a decision about which remote identities may access data.", "This example creates two peers and a local DHT bootstrap in one process. It exercises topic discovery without announcing anything to the public network."],
    api: ["join(topic, { server, client }): announce, discover, or do both. Await the discovery handle's flushed() when announcement must finish first.", "on('connection', socket): handle a peer stream; attach error handling and define an application protocol.", "destroy(): close swarm activity during shutdown. Leaving a topic alone does not close existing connections."],
    problems: ["Run one networking demo at a time: the local bootstrap uses UDP port 49777. Change it if that port is occupied.", "Discovery timeout: local UDP may be blocked. The example stops waiting after ten seconds and cleans up its swarms.", "A shared topic is not authorization. Use the P2P runtime's grants and invites for permissioned app services.", "For a real multi-process app, share the topic explicitly and persist identities. This random topic is only shared in memory."],
    next: "p2p", reference: "https://docs.pears.com/building-blocks/hyperswarm",
  },
  hyperdht: {
    concepts: ["HyperDHT is the discovery and connection layer under Hyperswarm. Use it directly when your application already knows which public key it wants to reach.", "A server listens using a keypair; a client dials its public key. That key identifies a peer, while your application separately controls access to its services.", "The local bootstrap in this example keeps the network isolated. It demonstrates a connection and finite message, not Internet NAT traversal acceptance."],
    api: ["DHT.keyPair(): generate a peer identity. Persist real application identities securely if they must survive restarts.", "createServer(handler) and server.listen(keyPair): accept encrypted peer streams.", "connect(publicKey): dial the peer; consume the stream and handle errors. Close the server and destroy DHT instances on exit."],
    problems: ["Run one networking demo at a time: the local bootstrap uses UDP port 49777. Change it if that port is occupied.", "Use DHT.keyPair(), the static API, rather than assuming a method on a node instance.", "A missing peer or blocked UDP can prevent a connection; handle deadlines and disconnected state in the UI.", "If all you need is topic discovery, use Hyperswarm. If you need pairing and permissions, use the P2P runtime."],
    next: "modules/hyperswarm", reference: "https://docs.pears.com/building-blocks/hyperdht",
  },
  hypercore: {
    concepts: ["A Hypercore is an ordered log. A writer appends entries and readers address them by zero-based position.", "This example stores JSON events locally and reads the latest entry. Restarting with the same directory opens the same log.", "Replication exchanges log data; it does not invent an application schema, a query index or a conflict-resolution policy."],
    api: ["ready(): initialize the core before reading properties such as length and key.", "append(value): add an entry using the configured encoding. get(index) reads an entry.", "close(): release local resources. For replicated reads, establish replication before waiting for unavailable blocks."],
    problems: ["Entries increase on each run because the example intentionally retains ./data.", "Use a separate storage directory for each writer process; do not open one directory concurrently.", "For lookup by record name, use Hyperbee over a core instead of scanning the entire log."],
    next: "modules/hyperbee", reference: "https://docs.pears.com/building-blocks/hypercore",
  },
  corestore: {
    concepts: ["Corestore manages multiple Hypercores under one storage root. Names let an application reopen the same local cores without manually tracking each key.", "The example separates note data from an activity log. The first note stays the same while the activity count grows on each run.", "A shared store can supply cores for a database or file drive. The owner of the store also owns its lifetime."],
    api: ["get({ name, valueEncoding }): open or create a named core. Await that core's ready() before inspecting its metadata.", "replicate(connection): attach replication to a peer stream; connect before requesting missing remote data.", "close(): close the store after consumers have finished. Child sessions and separately owned resources need their own cleanup."],
    problems: ["A changed storage directory creates a different store and identity; use a stable app-owned path.", "Names are local identifiers. Peers need the appropriate public dataset keys to open replicated data.", "Do not replicate sensitive cores merely because another peer is connected; define which resources the app shares."],
    next: "modules/hyperdrive", reference: "https://docs.pears.com/building-blocks/corestore",
  },
  hyperbee: {
    concepts: ["Hyperbee adds sorted keys and values to a Hypercore. Use it for settings, note records or indexes that must survive app restarts.", "The example uses UTF-8 keys and JSON values. It writes one note, retrieves it and scans the note: key range.", "Replicas can read the writer's dataset; replication alone does not authorize a second writer. Choose a collaborative layer when several devices must edit."],
    api: ["put(key, value), get(key), del(key): write, look up and remove records. get() returns an entry containing key and value, or null.", "createReadStream(range): iterate an ordered range rather than loading every record.", "batch() and batch.flush(): group writes. close() releases the database and its core."],
    problems: ["Access entry.value, not the entry object itself, when reading your JSON payload.", "Reuse the same encodings whenever reopening the store.", "A remote key with no available data can wait on replication. Connect first and give reads a bounded waiting policy."],
    next: "p2p/sync", reference: "https://docs.pears.com/building-blocks/hyperbee",
  },
  hyperdb: {
    concepts: ["HyperDB organizes records into schema-defined collections and query indexes. Choose it when a key-value API is too low-level for your domain.", "The builder generates a schema and database definition before runtime code opens the database. Both files needed for this example are included below.", "This example uses the local RocksDB engine. The generated collection is not automatically replicated or multi-writer."],
    api: ["Builder collections.register(): define the schema and primary key used by a collection.", "HyperDB.rocks(path, definition): open a device-local engine. insert() stages records and flush() persists the changes.", "get(collection, key): retrieve a record. find() queries collections or indexes. close() releases the engine."],
    problems: ["Cannot find ./spec/db/index.js: run node build.cjs before the runtime script.", "A record disappears after restart: check that flush() completed and the data directory is unchanged.", "Changing schemas requires an intentional migration; rebuilding a definition is not a data migration."],
    next: "modules/autobee", reference: "https://github.com/holepunchto/hyperdb",
  },
  hyperdrive: {
    concepts: ["Hyperdrive stores versioned files using Corestore-backed metadata and content cores. Use it for attachments, images and other path-addressed data.", "The example writes a text file, reads its bytes and lists the notes directory. Its storage remains in ./data.", "A replicated file entry may be visible before all content blocks are available. Your app must represent missing or partially downloaded files."],
    api: ["put(path, bytes): save file content. get(path): read the bytes, or null if the file does not exist.", "list(directory): iterate file entries. createReadStream(path): consume a large file incrementally.", "close(): close the drive, then close its owning Corestore. /sync can register drives for replication."],
    problems: ["Buffer is used here because the script runs under Node. Use a compatible byte utility in Bare.", "Do not call a mirrored drive a complete backup: identity recovery, encryption keys and restore testing are separate work.", "Persist the drive key and store directory if another device needs to open the same drive."],
    next: "p2p/sync", reference: "https://docs.pears.com/building-blocks/hyperdrive",
  },
  autobase: {
    concepts: ["Autobase orders independent writer logs and runs your reducer to produce a shared view. Your reducer determines what an operation means.", "The small example uses one writer to show append → apply → view. Follow the collaborative notes guide next to run offline edits with two writers.", "The P2P /db prototype uses Autobase. It is distinct from the separate experimental Autobee scaffold."],
    api: ["new Autobase(store, key, { open, apply }): create a base or join by key and define its view.", "append(operation) and update(): write locally and process available operations. Read the derived result from base.view.", "close(): close the base before its store. Multi-writer applications also need explicit admission rules and indexer availability."],
    problems: ["Keep apply deterministic: no random values, current timestamps or external service calls inside the reducer.", "An append or locally updated view does not prove every peer has received or durably indexed it.", "Pairing and database write authority are different permissions; the /db prototype manages membership separately."],
    next: "p2p/database", reference: "https://github.com/holepunchto/autobase",
  },
  autobee: {
    concepts: ["Autobee merges writer operations into a Hyperbee-style view. Applications append operations rather than writing directly into the read view.", "The example appends one key-value operation and applies it through a write batch. It demonstrates the local reducer API, not a multi-device acceptance test.", "Autobee is a separate implementation from Autobase. The experimental scaffold uses Autobee; the P2P /db prototype uses Autobase."],
    api: ["new Autobee(store, key, { apply }): create or join a dataset with an application reducer.", "append(bytes), update(), view.get(key): append an operation, update the view and read its value. Keys and values in this example are byte buffers.", "Inside apply: view.write(), batch.tryPut(), batch.flush(). This is not the ordinary Hyperbee put() API."],
    problems: ["A joining peer starts read-only until admitted as a writer. The local writer key and dataset key have different roles.", "Do not use the multi-writer scaffold with node-sync; that resource graph is not supported.", "Use the version in the compatibility profile. Experimental API updates require deliberate review."],
    next: "modules/hyperdb", reference: "https://github.com/holepunchto/autobee",
  },
  qvac: {
    concepts: ["QVAC loads a model and performs inference on the device running the SDK. Your application supplies prompts and decides which actions a model may request.", "The Node example uses the SDK's event stream. It downloads a model on first use, prints generated text and unloads the model while retaining its cached files.", "Desktop scaffolds use a worker adapter and private lifecycle helpers. The renderer should call the worker rather than import native inference packages."],
    api: ["loadModel({ modelSrc }): prepare a model and obtain its identifier.", "completion({ modelId, history, stream }): start generation; consume events for incremental content and await final for completion.", "unloadModel({ modelId, clearStorage: false }): release the model while preserving downloaded files."],
    problems: ["A first run needs model-download connectivity, disk space and compatible hardware. No universal memory requirement is implied.", "Check the installed SDK version before copying upstream snippets; this example uses the repository's Node SDK profile.", "Mock output does not establish native inference, cancellation or cached offline startup. Validate those independently on your target."],
    next: "runtime-ai", reference: "https://docs.qvac.tether.io/sdk/ai-capabilities/text-generation/",
    note: "Native example: model and platform requirements apply. This documentation change does not revalidate real inference. For the desktop UI path, use the Local AI guide.",
  },
  "expo-bare": {
    concepts: ["React Native owns the mobile UI, while a Bare worklet owns P2P and storage. The worklet is bundled separately from the renderer.", "Native modules require a native app build. Expo Go does not contain the native libraries required by this scaffold.", "The optional mobile AI implementation is separate from the desktop runtime. Its compatibility graph includes Expo, React Native, BareKit, the bundler and native addons."],
    api: ["npm run build:bare: bundle the generated worklet for the configured native targets.", "npm run prebuild: bundle the worklet and generate native projects.", "npm run ios or npm run android: compile and launch a native development build with the corresponding platform tooling installed."],
    problems: ["Missing native module in Expo Go: use the generated native build workflow.", "Do not fix a native graph failure by mixing arbitrary package upgrades; preserve the scaffold's compatibility profile.", "A successful bundle is not physical-device or native-inference acceptance. Record device, architecture and SDK versions when reporting problems."],
    next: "compatibility", reference: "https://github.com/holepunchto/react-native-bare-kit",
  },
  wdk: {
    concepts: ["WDK composes wallet modules around a common account API. A chain-specific module derives accounts and implements that chain's operations.", "This isolated upstream demonstration derives a disposable address. It does not implement a checkout, send money or connect the generated wallet stub to an app.", "The seed exists only for this process and is not saved. Application wallet integration would need a separate design for secret storage, recovery and user approval."],
    api: ["WDK.getRandomSeedPhrase(): create temporary seed material for the demonstration.", "registerWallet(name, module, config): select a chain implementation. getAccount(name, index) selects an account; getAddress() returns its public address.", "dispose(): release SDK-managed wallet resources. Application-owned copies of secrets need their own lifecycle."],
    problems: ["Never fund the displayed disposable address: this example intentionally provides no recovery flow.", "The configured provider is not a managed service supplied by this project. Provider failures should be surfaced by the consuming app.", "Wallet scaffolds remain stubs. A working upstream address example does not establish a supported payment feature."],
    next: "experiments", reference: "https://docs.wdk.tether.io/start-building/nodejs-bare-quickstart",
    note: "Upstream-only experiment. Wallets remain outside the core preview. This example performs no balance lookup, signing or transfer.",
  },
};

const desktop = profiles.profiles["pear-desktop"];
const dependencyVersions: Record<string, string> = {
  ...desktop.dependencies,
  ...desktop.featureDependencies["multi-writer"],
  ...profiles.profiles["node-cli"].featureDependencies["local-ai"],
  hyperdrive: p2pManifest.dependencies.hyperdrive,
  autobase: p2pManifest.peerDependencies.autobase,
};

function exampleBlocks(id: string): DocBlock[] {
  if (id === "pear") return [
    { type: "paragraph", text: "Use Node 22.17+ and npm in a terminal on your desktop. Run this in a parent directory where a new workspace can be created; no existing app is overwritten." },
    { type: "code", language: "bash", code: `${siteConfig.cli.setupInstallCommand}\nus init pear-demo-workspace --assistant none --no-install\ncd pear-demo-workspace\nus scaffold app -p pear-desktop -n pear-demo\ncd pear-demo\nnpm install\nnpm run dev` },
    { type: "heading", text: "Expected result" },
    { type: "paragraph", text: "A desktop window opens using the generated renderer and worker. This base example does not download an AI model. Keep the terminal open for worker errors and close the app when finished." },
  ];
  if (id === "expo-bare") return [
    { type: "paragraph", text: "This is an experimental source-only scaffold, not a command exposed by the published minimal beta. Use Node 22.17+, pnpm, and the native toolchain: Xcode on macOS for iOS or Android Studio/SDK for Android. Start in a directory for a fresh repository checkout." },
    { type: "code", language: "bash", code: `git clone ${siteConfig.publicRepositoryUrl}.git mobile-stack-source\ncd mobile-stack-source\npnpm --dir packages/cli install --frozen-lockfile\npnpm --dir packages/cli build:full\nnode packages/cli/dist/us.js scaffold app -p expo-mobile -n mobile-demo\ncd mobile-demo\nnpm install\nnpm run prebuild\nnpm run ios` },
    { type: "paragraph", text: "For Android, replace the final command with npm run android and select a configured device or emulator. This base example omits local AI. Run from a source checkout that contains the experimental target; keep its dependency lockfile when investigating native failures." },
    { type: "heading", text: "Expected result" },
    { type: "paragraph", text: "The generated app compiles into a native development build and opens on the selected simulator or device with its bundled Bare worklet. This flow has not been rerun as part of this docs change; mobile remains outside the core preview." },
  ];
  const example = examples[id as keyof typeof examples];
  const dependencies = example.packages.map((name) => dependencyVersions[name] ? `${name}@'${dependencyVersions[name]}'` : name).join(" ");
  return [
    { type: "paragraph", text: `Use Node 22.17+ and npm for installation. Start in a new directory for this example so its ./data storage cannot collide with another example. ${id === "bare" ? "Install the Bare executable first with npm install -g bare. The script runs in Bare, not Node." : "Save each file below with the exact filename shown, then run the commands in order."}` },
    { type: "code", language: "bash", code: `mkdir ${id}-demo\ncd ${id}-demo\nnpm init -y${dependencies ? `\nnpm install ${dependencies}` : ""}` },
    ...example.files.flatMap((file): DocBlock[] => [
      { type: "paragraph", text: `Save as ${file.name}:` },
      { type: "code", language: "js", code: file.code },
    ]),
    { type: "paragraph", text: "Run from this example directory:" },
    { type: "code", language: "bash", code: example.run },
    { type: "heading", text: "Expected result" },
    { type: "paragraph", text: example.expected },
  ];
}

export const libraryPages: DocPage[] = libraries.flatMap(({ entries }) => entries.map((entry): DocPage => {
  const guide = guides[entry.module];
  return {
    slug: `modules/${entry.module}`,
    title: entry.name,
    description: entry.purpose,
    category: "Libraries",
    verifiedOn: "19 October 2026",
    blocks: [
      { type: "lead", text: entry.example },
      { type: "callout", title: "Status in Unstoppable Stack", body: entry.boundary },
      { type: "heading", text: "How it works" },
      ...guide.concepts.map((text): DocBlock => ({ type: "paragraph", text })),
      { type: "heading", text: "Run an example" },
      ...(guide.note ? [{ type: "callout", title: "Before you run", body: guide.note } as DocBlock] : []),
      ...exampleBlocks(entry.module),
      { type: "callout", title: "Example verification", body: ["pear", "expo-bare", "qvac"].includes(entry.module)
        ? "Setup and API instructions were reviewed against the repository and upstream references. This docs update did not rerun the desktop/mobile native build or real-model acceptance flow."
        : "The code shown here ran successfully in a local check on 19 October 2026. This verifies the small example, not production readiness, public-network reachability or every platform." },
      { type: "heading", text: "API essentials" },
      { type: "list", items: guide.api },
      { type: "heading", text: "Troubleshooting and limits" },
      { type: "list", items: guide.problems },
      { type: "heading", text: "Next steps" },
      { type: "actions", items: [
        { label: "Continue the integration", href: `/docs/${guide.next}` },
        { label: "All libraries", href: "/docs/modules" },
        { label: "Upstream reference (optional)", href: guide.reference },
      ] },
    ],
  };
}));

export const libraryNav = libraries.map(({ group, entries }) => ({
  title: group,
  pages: entries.map((entry) => ({ title: entry.name, slug: `modules/${entry.module}` })),
}));
