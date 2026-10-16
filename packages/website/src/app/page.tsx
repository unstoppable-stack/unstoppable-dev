import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BrainCircuit, CheckCircle2, Database, Network, Plug, Terminal } from "lucide-react";
import { SetupChooser } from "@/components/setup-chooser";
import { CodeBlock } from "@/components/code-block";
import { defaultScaffoldCommand, siteConfig, supportMatrix } from "@/lib/release";

const benefits = [
  { icon: Database, title: "Local data", body: "Start with storage on the user’s device. The generated app remains useful when a service or peer is unavailable." },
  { icon: BrainCircuit, title: "On-device AI", body: "Add QVAC-backed inference without making a hosted model the default place for app data." },
  { icon: Network, title: "Direct peer communication", body: "Discover and connect devices with Holepunch protocols instead of requiring an application backend." },
];

const included = [
  { icon: Terminal, title: "CLI and assistant plugins", body: "Scaffold directly, or install the Claude and Codex plugin previews for guided workflows from one shared knowledge base." },
  { icon: Network, title: "One P2P library", body: "Identity, pairing, permissions and capability calls, with replication under /sync. Install the published alpha directly from npm." },
  { icon: Plug, title: "Upstream SDKs, directly", body: "Use QVAC for local inference and WDK for future wallet integration. Small lifecycle helpers stay inside generated apps; wallet scaffolds are stubs." },
];

const faqs = [
  { question: "Does an app work offline?", answer: "Local UI and storage can keep working offline. Peer discovery, replication, and delegated inference need reachable peers; local inference works after its model is installed." },
  { question: "What does local AI require?", answer: "A compatible machine, disk space for the selected model, and an initial model download. Exact memory and disk guidance is model-specific and still being measured for the preview." },
  { question: "Which coding assistants are supported?", answer: "Claude Code and Codex have downloadable plugin previews and dedicated setup guides. The raw CLI also generates project guidance for Cursor and OpenCode, or works without an assistant." },
  { question: "Do I need a Personal Node?", answer: "No. The recommended app runs without it, and the current Personal Node alpha is deferred from the core preview while its release gates are completed." },
  { question: "Are payments available?", answer: "Not as a supported preview path. WDK integration is planned and the current generator surface is a stub, so this site does not present payments as shipped." },
  { question: "Does this eliminate every infrastructure cost?", answer: "No. It removes the mandatory application backend from the core architecture. Devices, model downloads, peer availability, website hosting, and any optional services still have real costs." },
];

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.10)_0%,_transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 text-center sm:px-6 md:pb-32 md:pt-32 lg:px-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />{siteConfig.status}
          </div>
          <h1 className="mx-auto mb-6 max-w-5xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-7xl">Build private apps with local AI and peer-to-peer sync.</h1>
          <p className="mx-auto mb-10 max-w-3xl text-base leading-relaxed text-text-secondary sm:text-lg md:text-xl">Start with your coding assistant or work directly from the terminal. Choose the workflow that fits you, with local-first app starters, P2P capabilities and direct QVAC integration underneath.</p>
          <SetupChooser />
          <p className="mt-6 text-sm text-text-muted">Your workflow. The same stack. Switch paths as your project grows.</p>
        </div>
      </section>

      <section className="section border-t border-border bg-surface/40" aria-labelledby="example-title">
        <div className="section-inner grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">Ecommerce example</p>
            <h2 id="example-title" className="section-title">Local Goods: ecommerce on your device</h2>
            <p className="section-copy mb-7">Browse a product catalog, build a persistent cart, and save a demo order on your device. Ask an on-device shopping assistant for product advice and retrieve orders from a trusted peer. Checkout is a local demonstration with no payment or fulfillment.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/showcase" className="button-primary">Explore the example <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <figure className="rounded-2xl border border-border bg-background p-3 shadow-2xl shadow-black/30">
            <Image unoptimized src="/examples/ecommerce-assistant.png" alt="Local Goods ecommerce desktop app with product catalog and demo checkout" width={1100} height={1600} className="h-80 w-full rounded-xl object-cover object-top" />
            <figcaption className="mt-3 text-xs leading-5 text-text-muted">Actual ecommerce app capture. See the example for validation scope and remaining acceptance checks.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section border-t border-border" aria-labelledby="benefits-title">
        <div className="section-inner"><p className="eyebrow">Why local-first</p><h2 id="benefits-title" className="section-title">Control stays with the app’s users.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{benefits.map((benefit) => <div key={benefit.title} className="card"><benefit.icon className="mb-5 h-6 w-6 text-accent" /><h3 className="mb-2 text-lg font-semibold">{benefit.title}</h3><p className="text-sm leading-6 text-text-secondary">{benefit.body}</p></div>)}</div>
        </div>
      </section>

      <section className="section border-t border-border bg-surface/40" aria-labelledby="build-title">
        <div className="section-inner grid gap-10 lg:grid-cols-2">
          <div className="min-w-0"><p className="eyebrow">How to build</p><h2 id="build-title" className="section-title">From workspace to running app.</h2>
            <ol className="mt-8 space-y-5">{[["Choose your starting path", "Install the Claude or Codex plugin preview, or use the raw CLI."], ["Scaffold and run", "Create the supported Pear Desktop baseline, install its dependencies, and open it locally."], ["Extend deliberately", "Ask the assistant for one change at a time, using the included recipes and runtime boundaries."]].map(([title, body], index) => <li key={title} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-background">{index + 1}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-text-secondary">{body}</p></div></li>)}</ol>
          </div>
          <div className="min-w-0 self-center"><CodeBlock code={defaultScaffoldCommand} /><p className="mt-3 text-xs leading-5 text-text-muted">This creates the base desktop app. Local AI is an optional follow-on; Personal Node remains outside the core preview.</p></div>
        </div>
      </section>

      <section className="section border-t border-border" aria-labelledby="included-title">
        <div className="section-inner"><p className="eyebrow">What is included</p><h2 id="included-title" className="section-title">A small toolkit. Clear boundaries.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{included.map((item) => <div key={item.title} className="card"><item.icon className="mb-5 h-6 w-6 text-accent" /><h3 className="mb-2 text-lg font-semibold">{item.title}</h3><p className="text-sm leading-6 text-text-secondary">{item.body}</p></div>)}</div>
        </div>
      </section>

      <section className="section border-t border-border bg-surface/40" aria-labelledby="status-title">
        <div className="section-inner"><p className="eyebrow">Verified {siteConfig.verifiedOn}</p><h2 id="status-title" className="section-title">What works today</h2>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-surface-light text-text-muted"><tr><th className="px-5 py-3 font-medium">Capability</th><th className="px-5 py-3 font-medium">Maturity</th><th className="px-5 py-3 font-medium">What that means</th></tr></thead><tbody className="divide-y divide-border bg-background">{supportMatrix.map((item) => <tr key={item.capability}><th className="px-5 py-4 font-medium text-text-primary">{item.capability}</th><td className="px-5 py-4"><span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">{item.maturity}</span></td><td className="px-5 py-4 leading-6 text-text-secondary">{item.detail}</td></tr>)}</tbody></table></div>
        </div>
      </section>

      <section className="section border-t border-border" aria-labelledby="faq-title">
        <div className="section-inner max-w-4xl"><p className="eyebrow">FAQ</p><h2 id="faq-title" className="section-title">Practical constraints, up front.</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">{faqs.map((faq) => <details key={faq.question} className="group py-5"><summary className="cursor-pointer list-none font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="flex items-center justify-between gap-4">{faq.question}<span aria-hidden="true" className="text-accent group-open:rotate-45">+</span></span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{faq.answer}</p></details>)}</div>
        </div>
      </section>

      <section className="section border-t border-border text-center"><div className="section-inner max-w-3xl"><CheckCircle2 className="mx-auto mb-5 h-8 w-8 text-accent" /><h2 className="section-title">Start where you already work.</h2><p className="section-copy mx-auto mb-8">Find the setup that fits your tools, whether you build with an assistant or directly from the terminal.</p><Link href="/getting-started" className="button-primary">Explore setup options <ArrowRight className="h-4 w-4" /></Link></div></section>
    </div>
  );
}
