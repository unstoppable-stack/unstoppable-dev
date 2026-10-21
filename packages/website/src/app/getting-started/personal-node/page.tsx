import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { siteConfig } from "@/lib/release";

export const metadata: Metadata = {
  title: "Connect an app to Personal Node",
  description: "When to add Personal Node, how to pair Notebook and Briefing, and how to integrate selected app data with an experimental desktop node.",
  alternates: { canonical: "/getting-started/personal-node" },
};
const source = `${siteConfig.publicRepositoryUrl}/blob/main/examples/personal-node-ecosystem`;

export default function NodeQuickstart() {
  return <div className="section"><div className="section-inner max-w-4xl">
    <p className="eyebrow">After your first local app · Experimental alpha</p>
    <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">Connect an app to Personal Node.</h1>
    <p className="section-copy">Start with an app that saves data and works offline. Add a node when you want another copy of selected data, or want a compatible app to read that copy while the original app is closed.</p>
    <section className="mt-10 grid gap-5 md:grid-cols-2" aria-label="Choose your architecture">
      <article className="card"><h2 className="mb-3 text-xl font-semibold">Use a node when…</h2><p className="text-sm leading-6 text-text-secondary">Users want to keep shared data on a trusted desktop, inspect sync status, or make copied data available to permitted apps. Design this as an optional connection; basic app use must work without it.</p></article>
      <article className="card"><h2 className="mb-3 text-xl font-semibold">Keep the app independent when…</h2><p className="text-sm leading-6 text-text-secondary">Local storage is enough, or you only need direct calls between reachable peers. A node does not automatically host your app’s functions, connect arbitrary apps, or provide a complete backup and restore service.</p></article>
    </section>
    <section className="mt-12" aria-labelledby="try-title">
      <h2 id="try-title" className="section-title">1. Try the working two-app example</h2>
      <p className="my-5 leading-7 text-text-secondary">Use a repository checkout, Node.js 22.17+ and npm. These are command-line apps backed by the actual desktop node. Use disposable notes. The demonstrated desktop flow uses public discovery with all processes on one computer; it does not establish physical-device or signed-installer acceptance.</p>
      <CodeBlock code={"# From the repository root\nnpm ci --prefix packages/p2p\nnpm ci --prefix packages/node\nnpm ci --prefix packages/node-desktop\nnpm ci --prefix examples/personal-node-ecosystem\nnpm run dev --prefix packages/node-desktop"} />
      <p className="my-5 leading-7 text-text-secondary">Keep the desktop running. In another terminal, create a note, then choose <strong>Connect an app</strong> in Simple Home. Replace NODE_CODE_FOR_NOTEBOOK below with the new code. Simple codes allow data sharing, not AI access.</p>
      <CodeBlock code={'cd examples/personal-node-ecosystem\nnode notebook.js put launch "Launch plan" "Ship a useful local app"\nnode notebook.js serve --node-invite NODE_CODE_FOR_NOTEBOOK'} />
      <p className="my-5 leading-7 text-text-secondary">Wait for <code>verified checkpoint</code>. Notebook prints a separate invitation for its own service. In another terminal, from the same example directory, link Briefing with that Notebook invitation:</p>
      <CodeBlock code={"node briefing.js link --invite NOTEBOOK_CODE"} />
      <p className="my-5 leading-7 text-text-secondary">Now stop Notebook with Ctrl+C. Create a fresh code in Personal Node for Briefing, then run:</p>
      <CodeBlock code={"node briefing.js sync --node-invite NODE_CODE_FOR_BRIEFING --stay-open"} />
      <p className="my-5 leading-7 text-text-secondary">Briefing retrieves the copied notes from the node and saves its report. In Simple Home, choose <strong>Browse saved data</strong> on each app to see the note and report cards. Notebook should be disconnected with its copy still available. To show both apps connected, restart Notebook with the node public key printed during pairing:</p>
      <CodeBlock code={"node notebook.js serve --node-key NODE_PUBLIC_KEY"} />
      <p className="mt-5 text-sm leading-6 text-text-muted">The node stores replicated data. Live Notebook summary or watch calls still require Notebook running. Stop each process with Ctrl+C before opening its local store in another process.</p>
    </section>
    <section className="mt-12" aria-labelledby="integrate-title">
      <h2 id="integrate-title" className="section-title">2. Connect your own app deliberately</h2>
      <p className="my-5 leading-7 text-text-secondary">The scaffold does not do this automatically. Follow the example runtime in a supported Node or Bare worker; renderer code talks to that worker through IPC.</p>
      <ol className="list-decimal space-y-4 pl-6 leading-7 text-text-secondary">
        <li><strong>Choose what to share.</strong> Keep private data separate. Register only supported Hypercore, Hyperbee, or Hyperdrive resources that the user intends to copy. Apps own schemas, migrations, and writer rules.</li>
        <li><strong>Attach replication to your existing storage.</strong> Add <code>syncPack({"{ store }"})</code> to the app’s P2P runtime. Reuse its owned store and identity; avoid opening a second writer over the same directory.</li>
        <li><strong>Pair with permission.</strong> Use <code>node.pair(invite)</code> with a desktop-created code. Save the paired node public key for <code>node.connect(publicKey)</code> on later runs. Keep invitations private; a remembered key does not bypass revocation.</li>
        <li><strong>Declare resources.</strong> Call <code>peer.call(&apos;sync&apos;, &apos;manifest.replace&apos;, {"{ manifest }"})</code> with the complete intended resource list, stable IDs, keys, names, and <code>protection.mode: &apos;mirror&apos;</code>. Registration alone does not mean the data has been copied.</li>
        <li><strong>Confirm the checkpoint.</strong> Query <code>sync.status</code> and verify the intended resource and version are protected. Handle refusal, quotas, disconnections, timeouts, and cancellation without blocking local use.</li>
        <li><strong>Share across apps through a contract.</strong> Agree on schema versions and capabilities. Attach replication and download the required checkpoint before reading. A data replica does not transfer domain handlers to the node.</li>
      </ol>
      <div className="mt-6 flex flex-wrap gap-5 text-accent underline underline-offset-4"><a href={`${source}/src/runtime.js`}>Runtime and manifest implementation</a><a href={`${source}/src/contract.js`}>Shared app contract</a><Link href="/docs/p2p/sync">Replication API</Link><Link href="/docs/p2p/rpc">Service contracts</Link></div>
    </section>
    <section className="mt-12 rounded-xl border border-border bg-surface p-6" aria-labelledby="verify-title">
      <h2 id="verify-title" className="mb-4 text-2xl font-semibold">3. Verify the behavior you promise</h2>
      <p className="leading-7 text-text-secondary">Test local writes without the node, reconnection and updated copies, reads with the source app stopped, denied access, and node restarts. Check both connection and copy status. Use the example’s automated proof and desktop acceptance runner as starting points.</p>
      <p className="mt-4 leading-7 text-text-secondary">Personal Node remains outside the core preview. Retention, complete recovery, and the full device-linking journey are unfinished. A same-computer node does not protect against losing that computer. Collaborative database hosting with Node sync is not yet a supported combination.</p>
      <div className="mt-5 flex flex-wrap gap-5 text-accent underline underline-offset-4"><a href={`${source}/README.md`}>Example setup and acceptance tests</a><Link href="/personal-node">Capabilities and limitations</Link><Link href="/docs/node-desktop">Desktop setup</Link></div>
    </section>
  </div></div>;
}
