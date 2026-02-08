import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Terminal,
  FolderOpen,
  Bot,
  Sparkles,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";

export const metadata = {
  title: "Getting Started — Unstoppable Stack",
  description:
    "Install the CLI, scaffold your first app, and start building with AI-powered P2P development.",
};

const prerequisites = [
  "Node.js 20+ (LTS recommended)",
  "pnpm, npm, or yarn",
  "An AI coding assistant (Claude Code, Cursor, or OpenCode) — optional but recommended",
];

const assistants = [
  { name: "Claude Code", description: "Claude's terminal-based coding agent" },
  { name: "Cursor", description: "AI-first code editor with rules & commands" },
  { name: "OpenCode", description: "Open source AI coding agent" },
  { name: "None", description: "Skip AI assistant configuration" },
];

const templates = [
  {
    name: "Blank",
    description: "Pear + Bare minimal starter. A clean slate to build anything.",
  },
  {
    name: "P2P Sync",
    description: "HyperDB + Hyperswarm. Synced data across peers out of the box.",
  },
  {
    name: "QVAC AI",
    description:
      "QVAC SDK integrated. Run local AI inference from day one.",
  },
];

export default function GettingStartedPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.06)_0%,_transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Getting Started
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Go from zero to a running P2P app in under two minutes.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Prerequisites */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Prerequisites</h2>
          <div className="rounded-xl border border-border bg-surface p-6">
            <ul className="space-y-3">
              {prerequisites.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-text-secondary">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Step 1: Install */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 1</div>
              <h2 className="text-2xl font-bold tracking-tight">Install & Run the CLI</h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            Run the create command with your preferred package manager:
          </p>

          <div className="space-y-3">
            <CodeBlock code="npx create-unstoppable-app" />
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>Or with pnpm:</span>
              <code className="rounded bg-surface px-2 py-1 font-mono">
                pnpm dlx create-unstoppable-app
              </code>
            </div>
          </div>
        </section>

        {/* Step 2: Interactive Flow */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 2</div>
              <h2 className="text-2xl font-bold tracking-tight">Scaffold Your App</h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            The CLI walks you through an interactive setup:
          </p>

          {/* Terminal mockup */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden mb-8">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-light">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-xs text-text-muted ml-2 font-mono">terminal</span>
            </div>
            <div className="p-4 font-mono text-sm space-y-3 overflow-x-auto">
              <div>
                <span className="text-text-muted">? </span>
                <span className="text-text-primary">What is your project name? </span>
                <span className="text-accent">my-app</span>
              </div>
              <div>
                <span className="text-text-muted">? </span>
                <span className="text-text-primary">Select your AI assistant:</span>
              </div>
              <div className="pl-4 space-y-1 text-text-secondary">
                {assistants.map((a, i) => (
                  <div key={a.name} className={i === 0 ? "text-accent" : ""}>
                    {i === 0 ? "❯ " : "  "}
                    {a.name}
                    <span className="text-text-muted"> — {a.description}</span>
                  </div>
                ))}
              </div>
              <div>
                <span className="text-text-muted">? </span>
                <span className="text-text-primary">Select a template:</span>
              </div>
              <div className="pl-4 space-y-1 text-text-secondary">
                {templates.map((t, i) => (
                  <div key={t.name} className={i === 0 ? "text-accent" : ""}>
                    {i === 0 ? "❯ " : "  "}
                    {t.name}
                    <span className="text-text-muted"> — {t.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Output mockup */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-light">
              <span className="text-xs text-text-muted font-mono">output</span>
            </div>
            <div className="p-4 font-mono text-sm space-y-2">
              <div className="text-text-secondary">Creating my-app...</div>
              <div>
                <span className="text-accent">✓</span>{" "}
                <span className="text-text-secondary">Scaffolded from blank template</span>
              </div>
              <div>
                <span className="text-accent">✓</span>{" "}
                <span className="text-text-secondary">Configured Claude Code agent pack</span>
              </div>
              <div>
                <span className="text-accent">✓</span>{" "}
                <span className="text-text-secondary">Installed dependencies</span>
              </div>
              <div className="pt-2 text-text-primary">Next steps:</div>
              <div className="text-accent pl-2">cd my-app</div>
              <div className="text-accent pl-2">pnpm dev</div>
            </div>
          </div>
        </section>

        {/* Step 3: Start Building */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 3</div>
              <h2 className="text-2xl font-bold tracking-tight">
                Start Building with Your AI Assistant
              </h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            Your project comes pre-loaded with an <strong className="text-text-primary">agent pack</strong> — a
            set of architecture rules, module documentation, and recipes tailored for your chosen AI
            assistant. Open your project and start coding:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                icon: Sparkles,
                title: "Architecture Rules",
                description: "Your AI knows the project structure and conventions",
              },
              {
                icon: FolderOpen,
                title: "Module Docs",
                description: "Deep knowledge of every P2P, AI, and payment module",
              },
              {
                icon: Bot,
                title: "Recipes & Patterns",
                description: "Battle-tested patterns for common tasks",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <feature.icon className="h-5 w-5 text-accent mb-3" />
                <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Next Steps */}
        <section className="rounded-2xl border border-border bg-surface p-8 md:p-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">What&apos;s Next?</h2>
          <p className="text-text-secondary mb-6 max-w-lg mx-auto">
            Explore the documentation to learn about each module, browse recipes for common
            patterns, or check out what others have built.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent-hover"
            >
              Read the Docs
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/showcase"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-light hover:text-text-primary transition-colors"
            >
              View Showcase
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
