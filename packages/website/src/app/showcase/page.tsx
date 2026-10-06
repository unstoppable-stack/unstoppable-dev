import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BrainCircuit, Database, Network } from "lucide-react";

export const metadata: Metadata = {
  title: "Examples",
  description: "Coffee Assistant: a first-party desktop example with real local AI, saved coffee orders, and trusted peer order sharing being validated.",
  alternates: { canonical: "/showcase" },
};

const capabilities = [
  { icon: BrainCircuit, label: "Real local AI", detail: "QVAC inference, Retry, Stop, and recovery passed on macOS Apple Silicon." },
  { icon: Database, label: "Saved orders", detail: "A saved value survived a full restart with external networking denied." },
  { icon: Network, label: "Peer order sharing", detail: "Two isolated apps exchanged a saved order through a real local DHT network; public DHT retrieval, visible disconnect and a fresh order after reconnect passed on the validation Mac." },
];

export default function ShowcasePage() {
  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 md:py-28">
          <p className="eyebrow">First-party developer-preview example</p>
          <h1 className="mb-5 text-4xl font-bold tracking-tight md:text-6xl">Coffee Assistant</h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-text-secondary">Ask an on-device assistant about coffee and save named orders locally. A small desktop example shows how the renderer, Bare worker, local database, and model fit together.</p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <figure className="mx-auto max-w-2xl">
          <Image src="/examples/coffee-assistant.png" alt="Actual Coffee Assistant window showing saved-order storage, peer-sharing controls, and real local model cancellation and recovery" width={1100} height={1600} className="h-auto w-full rounded-xl border border-border" />
          <figcaption className="mt-3 text-xs leading-5 text-text-muted">Actual application capture from the 5 October 2026 network-isolated validation run. The conversation shows test prompts, cancellation, and a subsequent real response; it is not a mockup or a customer deployment.</figcaption>
        </figure>
        <section className="section" aria-labelledby="outcome-title">
          <h2 id="outcome-title" className="section-title">What has been tested</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">{capabilities.map(item => <div key={item.label} className="card"><item.icon className="mb-4 h-6 w-6 text-accent" /><h3 className="font-semibold">{item.label}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p></div>)}</div>
          <p className="mt-6 text-sm leading-6 text-text-muted">Source version: CLI 0.4.0-beta.1, unfrozen working tree. These are local implementation checks, not final release or independent pilot evidence. Installation and the initial approximately 532 MB model download need networking. Cached inference works offline after that download.</p>
        </section>
        <section className="section" aria-labelledby="built-title">
          <h2 id="built-title" className="section-title">A narrow bridge keeps runtime work outside the UI.</h2>
          <p className="mt-5 leading-7 text-text-secondary">Electron displays the interface. A Bare worker owns Hyperbee storage, Hyperswarm networking, and QVAC inference. The bridge sends commands and streamed responses between them. The current example uses ordinary JavaScript and the same runtime integration as the desktop scaffold.</p>
          <p className="mt-5 leading-7 text-text-secondary">The AI gives advice; the saved-order controls write records. It does not place orders, manage a cart, or make payments. Sharing a database key exposes saved orders to whoever knows it, and recipients can retain downloaded copies.</p>
        </section>
        <section className="section" aria-labelledby="reproduce-title">
          <h2 id="reproduce-title" className="section-title">Reproduce the example</h2>
          <p className="mt-5 leading-7 text-text-secondary">The maintained source is now in the repository at <code>examples/coffee-assistant</code>, with setup instructions, troubleshooting, and a demo checklist. Public source access and a frozen candidate remain release gates, so a public download link is not available yet.</p>
          <ol className="mt-6 list-decimal space-y-3 pl-6 text-text-secondary"><li>Install dependencies and open the app using the example README.</li><li>Load the assistant and ask a coffee question.</li><li>Save a named order, restart, and fetch it again.</li><li>After the model is cached, disconnect external networking and ask another question.</li><li>Use your coding assistant to change a button label and verify the change.</li></ol>
        </section>
        <div className="mt-10 text-center"><Link href="/getting-started" className="button-primary">Open the quickstart <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </div>
  );
}
