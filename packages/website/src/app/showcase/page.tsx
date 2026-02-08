import Link from "next/link";
import { ArrowRight, Rocket, Send } from "lucide-react";

export const metadata = {
  title: "Showcase — Unstoppable Stack",
  description:
    "Projects and apps built with the Unstoppable Stack. P2P, local AI, crypto payments in action.",
};

export default function ShowcasePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.06)_0%,_transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Showcase
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Discover what developers are building with the Unstoppable Stack.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Coming Soon */}
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface border border-border mb-8">
            <Rocket className="h-10 w-10 text-text-muted" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-3 text-center">
            Coming Soon
          </h2>
          <p className="text-text-secondary text-center max-w-md mb-10">
            We&apos;re collecting the first projects built with the Unstoppable Stack. Once the CLI
            and templates are stable, this page will showcase real apps from the community.
          </p>

          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <Send className="h-6 w-6 text-accent mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Built something?</h3>
            <p className="text-sm text-text-muted mb-6">
              If you&apos;re building with the Unstoppable Stack, we&apos;d love to feature your project.
              Open an issue on GitHub to submit your app.
            </p>
            <a
              href="https://github.com/nicosoftware/unstoppable-stack/issues/new?title=Showcase+Submission&labels=showcase"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent-hover"
            >
              Submit Your Project
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-text-muted mb-4">
              In the meantime, start building your own unstoppable app:
            </p>
            <Link
              href="/getting-started"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
