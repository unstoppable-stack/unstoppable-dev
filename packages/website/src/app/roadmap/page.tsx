import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Telescope } from "lucide-react";
import { siteConfig } from "@/lib/release";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Available, being validated, and later work for the Unstoppable Stack developer preview.",
  alternates: { canonical: "/roadmap" },
};

const groups = [
  {
    icon: CheckCircle2,
    title: "Available in this preview",
    tone: "text-accent",
    items: [
      ["Published CLI beta", `Version ${siteConfig.cli.version} is the public quickstart: init, scaffold, doctor and compatibility checks. Research is outside the minimal release.`],
      ["Published P2P alpha", `Version ${siteConfig.p2p.version} provides pairing, grants, calls, streams and optional /sync replication.`],
      ["Pear Desktop baseline", "Generated renderer/worker app with P2P discovery and local Hyperbee storage."],
      ["Assistant guidance", "Portable project context for Claude Code, Cursor, OpenCode, and Codex."],
    ],
  },
  {
    icon: Clock3,
    title: "Being validated",
    tone: "text-amber-400",
    items: [
      ["Next CLI and P2P candidates", `CLI ${siteConfig.cli.sourceVersion} and P2P ${siteConfig.p2p.sourceVersion} are unpublished source. Typed /rpc and the /db prototype require that candidate source, not the published alpha.1 package.`],
      ["Real local inference", "Model compatibility, download behavior, hardware guidance, and recovery paths."],
      ["Personal Node alpha", "Packaging, explicit trust defaults, and truthful replication status before it can become an optional public path."],
      ["Expo Mobile", "Generated app and Bare worklet integration across the selected support matrix."],
      ["Multi-writer and Node sync", "Both work independently; their combination is rejected until full writer-set registration is implemented."],
      ["Ecommerce example release package", "Public source, matching screenshot, transcript, and reproducible version pin."],
    ],
  },
  {
    icon: Telescope,
    title: "Later",
    tone: "text-blue-400",
    items: [
      ["Wallet payments", "A validated WDK payment path; the current scaffold surface is only a stub."],
      ["Hosted optional services", "Paid inference or backup without changing the local-first default."],
      ["Local-first identity", "Device linking and recovery with explicit trust semantics."],
      ["Broader discovery", "Search, community examples, and richer ecosystem pages after core onboarding is proven."],
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.08)_0%,_transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <p className="eyebrow">Reviewed {siteConfig.verifiedOn}</p>
          <h1 className="mb-5 text-4xl font-bold tracking-tight md:text-6xl">Roadmap</h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-text-secondary">A small public view of what developers can use, what still needs evidence, and what comes later. Internal sprint detail stays in the repository.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {groups.map((group) => <section key={group.title} className="rounded-2xl border border-border bg-surface p-7"><group.icon className={`mb-5 h-7 w-7 ${group.tone}`} /><h2 className="text-xl font-semibold">{group.title}</h2><ul className="mt-6 space-y-6">{group.items.map(([title, body]) => <li key={title}><h3 className="text-sm font-semibold text-text-primary">{title}</h3><p className="mt-1 text-sm leading-6 text-text-secondary">{body}</p></li>)}</ul></section>)}
        </div>
        <section className="mt-12 rounded-2xl border border-border bg-background p-7 text-center"><h2 className="text-xl font-semibold">Roadmap labels are not release promises.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary">An item moves to “Available” only when there is a released artifact, a maintained guide, and a repeatable validation path. See support and limitations for current trust, data, and connectivity boundaries.</p><Link href="/docs/support" className="button-primary mt-6">Read support & limitations <ArrowRight className="h-4 w-4" /></Link></section>
      </div>
    </div>
  );
}
