import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BrainCircuit, Database, Network, ShoppingCart } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { siteConfig } from "@/lib/release";

export const metadata: Metadata = {
  title: "App examples: Local Goods and Personal Node",
  description: "Explore Notebook + Briefing with Personal Node, and Local Goods ecommerce: a first-party desktop example with a product catalog, persistent cart, demo checkout, local AI, and trusted peer order sharing.",
  alternates: { canonical: "/showcase" },
};

const exampleSource = `${siteConfig.publicRepositoryUrl}/tree/main/examples/ecommerce-assistant`;
const exampleReadme = `${siteConfig.publicRepositoryUrl}/blob/main/examples/ecommerce-assistant/README.md`;

const capabilities = [
  { icon: ShoppingCart, label: "Catalog and cart", detail: "Search six everyday products, adjust quantities and keep your cart across app restarts." },
  { icon: BrainCircuit, label: "Local shopping assistant", detail: "A real QVAC run recommended the catalog’s daypack for carrying a laptop. Retry, Stop, and wider native acceptance remain separate checks." },
  { icon: Database, label: "Saved orders", detail: "Worker-calculated prices, persistent cart, and local demo order receipts." },
  { icon: Network, label: "Peer order sharing", detail: "Retrieve a saved order from a reachable trusted peer through a scoped, validated RPC invitation." },
];

export default function ShowcasePage() {
  return (
    <div>
      <header className="section-inner pt-16"><p className="eyebrow">Build from working examples</p><h1 className="text-4xl font-bold tracking-tight md:text-5xl">Apps built with the stack</h1></header>
      <section className="section border-b border-border bg-surface/40" aria-labelledby="node-example-title">
        <div className="section-inner grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Notebook + Briefing · Experimental source example</p>
            <h2 id="node-example-title" className="section-title">Two apps. Shared data. Your desktop node.</h2>
            <p className="section-copy mb-6">Notebook shares notes. Personal Node keeps verified copies. Briefing reads those notes while Notebook is stopped, then saves its own report. A separate service contract demonstrates permitted calls while Notebook is running.</p>
            <Link href="/getting-started/personal-node" className="button-primary">Run the Personal Node example <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            <p className="mt-5 text-sm leading-6 text-text-muted">Independent command-line apps with a real desktop dashboard. Tested on one computer; cross-device acceptance and full backup/recovery remain unfinished.</p>
          </div>
          <Image unoptimized src="/examples/personal-node-report.png" alt="Briefing report displayed as a readable card in Personal Node" width={2200} height={1376} className="h-auto w-full rounded-xl border border-border" />
        </div>
      </section>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 md:py-28">
          <p className="eyebrow">First-party developer-preview example</p>
          <h2 className="mb-5 text-4xl font-bold tracking-tight md:text-6xl">Local Goods</h2>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-text-secondary">A local-first ecommerce example. Browse everyday products, keep a cart on your device, and save a demo order. An on-device shopping assistant and trusted peer retrieval show how local AI, storage, and networking fit together.</p>
          <p className="mt-5 text-sm text-text-muted">Demo checkout saves a local receipt. No payment or fulfillment is connected. Local Goods demonstrates direct peer RPC; it does not currently integrate Personal Node. Use Notebook + Briefing above for node replication.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><a href={exampleSource} className="button-primary">View example source <ArrowRight aria-hidden="true" className="h-4 w-4" /></a><a href="#reproduce-title" className="button-secondary">Run the example</a></div>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <figure className="mx-auto max-w-2xl">
          <Image unoptimized src="/examples/ecommerce-assistant.png" alt="Actual Local Goods desktop window showing products, cart, and a saved demo order" width={1100} height={1600} className="h-auto w-full rounded-xl border border-border" />
          <figcaption className="mt-3 text-xs leading-5 text-text-muted">Actual Local Goods capture from the scoped-RPC desktop regression on 16 October 2026. This run did not load an AI model. See the README for validation scope and remaining acceptance checks.</figcaption>
        </figure>
        <section className="section" aria-labelledby="outcome-title">
          <h2 id="outcome-title" className="section-title">Example capabilities</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">{capabilities.map(item => <div key={item.label} className="card"><item.icon className="mb-4 h-6 w-6 text-accent" /><h3 className="font-semibold">{item.label}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p></div>)}</div>
          <p className="mt-6 text-sm leading-6 text-text-muted">Developer preview derived from CLI 0.4.0-beta.1. Commerce flow checks are separate from native inference, public-network discovery, offline acceptance, and release certification. Installation and the initial approximately 532 MB model download need networking.</p>
        </section>
        <section className="section" aria-labelledby="built-title">
          <h2 id="built-title" className="section-title">A narrow bridge keeps runtime work outside the UI.</h2>
          <p className="mt-5 leading-7 text-text-secondary">Electron displays the interface. A Bare worker owns private Hyperbee storage, the P2P runtime, and QVAC inference. The bridge sends commands and streamed responses between them. The current example uses ordinary JavaScript and the same runtime integration as the desktop scaffold.</p>
          <p className="mt-5 leading-7 text-text-secondary">The AI gives product advice; cart controls and demo checkout write records. Checkout has no payment, tax, shipping, or fulfillment integration. A single-use invitation grants one trusted device receipt lookups by reference. The cart remains local; receipt fields are validated before transmission. Pairings retain access after invitation expiry, and recipients can keep returned receipts. Use demo data only.</p>
        </section>
        <section className="section" aria-labelledby="reproduce-title">
          <h2 id="reproduce-title" className="section-title">Reproduce the example</h2>
          <p className="mt-5 leading-7 text-text-secondary">From a checkout of the repository containing <code>examples/ecommerce-assistant</code>, run the commands below. Use Node.js 22.17 or newer and npm. macOS Apple Silicon is the maintainer validation platform; other platforms remain unverified.</p>
          <div className="mt-6"><CodeBlock code={"npm ci --prefix packages/p2p\ncd examples/ecommerce-assistant\nnpm ci\nnpm run dev"} /></div>
          <p className="mt-5 leading-7 text-text-secondary">Browse and check out without loading the model. The shopping assistant needs an approximately 532 MB download on first use. This is a source example; a packaged desktop download is not available.</p>
          <div className="mt-5 flex flex-wrap gap-4"><a href={exampleReadme} className="text-accent hover:underline">Setup, peer sharing and validation</a><a href={exampleSource} className="text-accent hover:underline">Browse the source</a></div>
          <ol className="mt-6 list-decimal space-y-3 pl-6 text-text-secondary"><li>Install dependencies and open the app using the example README.</li><li>Add products to the cart and save a demo order.</li><li>Restart and look up the saved order by reference.</li><li>Load the shopping assistant; after the model is cached, test another question with external networking disconnected.</li><li>Use your coding assistant to change a button label and verify the change.</li></ol>
        </section>
        <div className="mt-10 text-center"><Link href="/getting-started" className="button-primary">Open the quickstart <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </div>
  );
}
