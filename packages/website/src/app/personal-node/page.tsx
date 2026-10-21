import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { NodeArchitecture } from "@/components/node-architecture";
import { ArrowRight, Monitor, Network, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Personal Node",
  description: "Keep another copy of shared app data, see what has synced, and browse saved notes and reports. Personal Node is experimental alpha, with recovery still unfinished.",
  alternates: { canonical: "/personal-node" },
};

const paths = [
  {
    icon: Network,
    title: "Connect your app",
    body: "Keep your app’s own interface and local storage. Pair its compatible P2P runtime with Personal Node, declare the resources to replicate, and request only the services it needs. The desktop owner approves access.",
  },
  {
    icon: Monitor,
    title: "Build your own desktop app",
    body: "Use the desktop source as an architectural reference: an Electron interface, a restricted IPC bridge, and a Bare worker for P2P and inference. Compose the shared library and optional services around your own product.",
  },
  {
    icon: ShieldCheck,
    title: "Share across apps by agreement",
    body: "Publish a versioned data or service contract that other apps can implement. Pair peers and grant specific methods. Each app keeps its own interface and business logic; compatible services can run in your app or another trusted host.",
  },
];

export default function PersonalNodePage() {
  return (
    <div>
      <section className="section border-b border-border bg-surface/40">
        <div className="section-inner max-w-4xl">
          <p className="eyebrow">Personal Node · Experimental alpha</p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">A home for your apps’ shared data.</h1>
          <p className="section-copy mb-8">Your apps keep their own data and work independently. Personal Node is their desktop companion: it keeps a copy of the data they share, shows what has synced, and lets you browse saved notes and reports. We recommend this architecture when an app needs another data copy or needs to make shared data available while the original app is closed.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/docs/node-desktop" className="button-primary">Try the desktop alpha <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            <Link href="/getting-started/personal-node" className="button-secondary">Connect your app</Link>
          </div>
          <p className="mt-5 text-sm leading-6 text-text-muted">Available for source experimentation, outside the core supported preview. Signed distribution, real-model platform acceptance, and the full linking and recovery journey remain release gates.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="everyday-title">
        <div className="section-inner">
          <p className="eyebrow">A simple desktop home</p>
          <h2 id="everyday-title" className="section-title">See your apps. Read what they’ve shared.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["Connect an app", "Pair a compatible app with a code. You control which apps can share data and which services they may use."],
              ["Know what is copied", "See connection and copy status separately. An app can be closed while its last verified copy stays available on the node."],
              ["Browse your saved content", "Read notes and reports as friendly cards. Developers can switch to Advanced for complete records and technical details."],
            ].map(([title, body]) => <article key={title} className="card"><h3 className="mb-3 text-lg font-semibold">{title}</h3><p className="text-sm leading-6 text-text-secondary">{body}</p></article>)}
          </div>
          <figure className="mx-auto mt-8 max-w-4xl rounded-2xl border border-border bg-background p-3">
            <Image unoptimized src="/examples/personal-node-report.png" alt="Simple saved-data view showing a Briefing report as a card with its note title and excerpt, without technical metadata" width={2200} height={1376} className="h-auto w-full rounded-xl" />
            <figcaption className="mt-3 text-sm leading-6 text-text-muted">Actual desktop alpha, using the Notebook + Briefing example. Browsing is read-only; edit content in its original app. Supported note and report formats have cards; other formats may require the original app.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section border-y border-border bg-surface/40" aria-labelledby="architecture-title">
        <div className="section-inner">
          <p className="eyebrow">Recommended companion architecture</p>
          <h2 id="architecture-title" className="section-title">Local first. Another copy when connected.</h2>
          <p className="section-copy mb-8">Build basic use around the app’s own storage. Add Personal Node for selected data copies and permitted services. Compatibility is an explicit integration; generated or existing apps do not connect automatically.</p>
          <NodeArchitecture />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <article className="card"><h3 className="mb-3 text-lg font-semibold">Verified copies today</h3><p className="text-sm leading-6 text-text-secondary">The node can verify the last shared version of supported data. Notebook and Briefing have been tested with actual desktop pairing, offline edits, reconnection, and access to copied notes while Notebook is stopped. These tests ran on one computer.</p></article>
            <article className="card"><h3 className="mb-3 text-lg font-semibold">Full backup and recovery are still ahead</h3><p className="text-sm leading-6 text-text-secondary">Sync is not a complete backup service. Retention, restoring lost app data, and the full device-linking journey remain unfinished. Separate-device operation needs further acceptance testing. Keep an independent backup for important data.</p></article>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="paths-title">
        <div className="section-inner">
          <p className="eyebrow">Two ways to build. Shared foundations.</p>
          <h2 id="paths-title" className="section-title">Your product chooses the experience.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {paths.map((path) => (
              <article key={path.title} className="card">
                <path.icon aria-hidden="true" className="mb-5 h-6 w-6 text-accent" />
                <h3 className="mb-3 text-lg font-semibold">{path.title}</h3>
                <p className="text-sm leading-6 text-text-secondary">{path.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-4xl text-sm leading-6 text-text-secondary">The stack is not tied to one app category: notes, catalogs, creative tools, and other products can use the same foundations. Compatibility requires an integration in a supported runtime; arbitrary existing apps and browser-only code do not connect automatically. The desktop source is a reference composition, not a one-command white-label template.</p>
        </div>
      </section>

      <section className="section border-y border-border bg-surface/40" aria-labelledby="contracts-title">
        <div className="section-inner max-w-4xl">
          <p className="eyebrow">What compatibility means</p>
          <h2 id="contracts-title" className="section-title">Shared protocols are the beginning.</h2>
          <ol className="mt-8 space-y-5 text-sm leading-6 text-text-secondary">
            <li><strong className="text-text-primary">1. Keep local ownership.</strong> Your app owns its storage, schemas, migrations, and offline behavior. Networking adds services when a peer is available.</li>
            <li><strong className="text-text-primary">2. Declare data explicitly.</strong> Replicate supported Hypercore, Hyperbee, or Hyperdrive resources. Agree on schema versions, encryption access, and writer rules before another app interprets or edits them.</li>
            <li><strong className="text-text-primary">3. Share functionality deliberately.</strong> Define versioned capabilities with validated inputs and outputs. A matching contract does not grant permission; access still requires pairing and method grants.</li>
            <li><strong className="text-text-primary">4. Test independence and reconnection.</strong> Handle denied access, missing peers, cancellation, and incompatible versions. Avoid replaying mutations blindly after a disconnect.</li>
          </ol>
          <p className="mt-7 text-sm leading-6 text-text-secondary">Try Notebook and Briefing, two command-line source examples. Briefing calls Notebook’s summary service through a shared contract, then builds its own report from replicated notes. Tests cover a restarted desktop worker serving notes while Notebook is stopped, plus real dashboard pairing, verified copies, and updated reports on one computer. Personal Node hosts the data; live Notebook service calls still need Notebook running.</p>
          <div className="mt-7 flex flex-wrap gap-5">
            <Link href="/docs/p2p/rpc" className="text-accent underline underline-offset-4">Service contracts</Link>
            <Link href="/docs/p2p/sync" className="text-accent underline underline-offset-4">Resource replication</Link>
            <Link href="/docs/p2p/examples" className="text-accent underline underline-offset-4">Runnable P2P examples</Link>
            <a href="https://github.com/unstoppable-stack/unstoppable-dev/blob/main/examples/personal-node-ecosystem/README.md" className="text-accent underline underline-offset-4">Run Notebook + Briefing</a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="status-title">
        <div className="section-inner max-w-4xl">
          <p className="eyebrow">Current scope</p>
          <h2 id="status-title" className="section-title">Useful foundations. More work before everyday use.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <article className="card">
              <h3 className="mb-3 text-lg font-semibold">Implemented in the alpha</h3>
              <p className="text-sm leading-6 text-text-secondary">Simple Home and Advanced views, app pairing and permissions, verified copies, readable note and report cards, storage limits, and pause/resume controls. Notebook and Briefing demonstrate shared data and a versioned service contract on one computer. Optional AI controls exist; real-model acceptance is separate.</p>
            </article>
            <article className="card">
              <h3 className="mb-3 text-lg font-semibold">Next priorities</h3>
              <p className="text-sm leading-6 text-text-secondary">A complete device-linking journey, recovery and retention controls, clearer failure recovery, real-model and signed installer acceptance, and extending the two-app proof to physical devices and desktop interfaces.</p>
            </article>
          </div>
          <p className="mt-6 text-sm leading-6 text-text-secondary">A verified replica covers an observed checkpoint, not guaranteed future writes or full recovery. Settings export includes sensitive identity material in plaintext and excludes app payloads. Removing an app revokes access but leaves downloaded blocks; per-app purge is not implemented. Collaborative database hosting with Node sync is not yet a supported combination.</p>
          <Link href="/docs/node" className="mt-7 inline-flex items-center gap-2 text-accent underline underline-offset-4">Read the current Personal Node boundaries <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
