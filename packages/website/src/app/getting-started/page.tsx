import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { GettingStartedCards } from "@/components/getting-started-cards";

export const metadata: Metadata = {
  title: "Get started with Claude, Codex or the CLI",
  description: "Install the Claude Code or Codex plugin preview, or use the raw CLI to build a local-first desktop app.",
  alternates: { canonical: "/getting-started" },
};

export default function GettingStartedPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.08)_0%,_transparent_55%)]" />
        <div className="relative section-inner py-16 md:py-24">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="eyebrow">Choose your workflow</p>
            <h1 className="mb-5 text-4xl font-bold tracking-tight md:text-6xl">Your tool. The same stack.</h1>
            <p className="text-lg leading-8 text-text-secondary">Start with a plugin for your coding assistant or use the CLI directly. Choose a setup below to build a desktop app with local storage and peer networking.</p>
          </div>
          <GettingStartedCards />
          <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-6 text-text-muted">Claude and Codex use downloadable plugin previews. Each guide includes the matching CLI setup; install the published CLI beta from npm.</p>
        </div>
      </section>
      <section className="section border-b border-border">
        <div className="section-inner grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">How the pieces fit</p>
            <h2 className="section-title">Guidance, tools and capabilities.</h2>
            <p className="section-copy">The plugins guide your assistant. The CLI creates workspaces and apps. One P2P library provides pairing, permissions and replication; QVAC and wallet features use their upstream SDKs directly.</p>
            <Link href="/docs/packages" className="button-secondary mt-6">Explore the package structure <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-7">
            <h2 className="mb-5 text-xl font-semibold">Your first milestone</h2>
            <ul className="space-y-4">{["Open a Pear Desktop app from its generated folder.", "Save an entry and find it after a restart.", "Make one small change and check the result."].map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-text-secondary"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />{item}</li>)}</ul>
            <p className="mt-6 border-t border-border pt-5 text-sm leading-6 text-text-muted">Add local AI once the baseline works. Personal Node is optional and deferred; the consolidated P2P alpha is available on npm. Wallet scaffolds are stubs, and Memory and Search are excluded from this release.</p>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-inner flex flex-col justify-between gap-6 rounded-2xl md:flex-row md:items-center">
          <div><h2 className="text-2xl font-semibold">Already have a project?</h2><p className="mt-2 text-text-secondary">Keep your app and its instructions. Review the assistant workflow before adding a plugin.</p></div>
          <Link href="/docs/agent-pack" className="button-secondary shrink-0">Read the assistant workflow <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
