import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Terminal,
  FolderOpen,
  Bot,
  Sparkles,
  Server,
  Database,
  HardDrive,
  Cpu,
  Search,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { ScaffoldPathSwitch } from "@/components/scaffold-path-switch";

export const metadata = {
  title: "Getting Started — Unstoppable Stack",
  description:
    "Install the CLI, scaffold your first app, connect to your Unstoppable Node, and start building with AI-powered P2P development.",
};

const prerequisites = [
  "Node.js 20+ (LTS recommended)",
  "pnpm, npm, or yarn",
  "An AI coding assistant (Claude Code, Cursor, OpenCode, or Codex) — optional but recommended",
];

const assistants = [
  { name: "Claude Code", description: "Claude's terminal-based coding agent" },
  { name: "Cursor", description: "AI-first code editor with rules & commands" },
  { name: "OpenCode", description: "Open source AI coding agent" },
  { name: "Codex", description: "OpenAI terminal coding agent" },
  { name: "None", description: "Skip AI assistant configuration" },
];

const platforms = [
  { name: "Pear Desktop", description: "Desktop P2P app with React UI and worker bridge" },
  { name: "Expo Mobile", description: "React Native + Bare runtime for iOS & Android" },
  { name: "Node CLI", description: "Terminal app on Bare runtime, no UI" },
];

const features = [
  { name: "local-ai", description: "QVAC SDK for offline inference and mockable AI flows" },
  { name: "node-sync", description: "Register app data with the Unstoppable Node" },
  { name: "wallet", description: "WDK wallet integration stub where supported" },
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
              <h2 className="text-2xl font-bold tracking-tight">Install the CLI</h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            Install the <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono text-accent">us</code> command globally:
          </p>

          <div className="space-y-3">
            <CodeBlock code="npm install -g @unstoppable-stack/cli" />
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>Or run directly:</span>
              <code className="rounded bg-surface px-2 py-1 font-mono">
                npx @unstoppable-stack/cli init
              </code>
            </div>
          </div>
        </section>

        {/* Step 2: Init */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 2</div>
              <h2 className="text-2xl font-bold tracking-tight">Initialize Your Workspace</h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            Run <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono text-accent">us init</code> first when you want the project configured for Claude, Cursor, OpenCode, or Codex. The generated agent pack tells your assistant how to use the CLI and stack correctly.
          </p>

          <div className="rounded-xl border border-border bg-surface overflow-hidden mb-8">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-light">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-xs text-text-muted ml-2 font-mono">us init</span>
            </div>
            <div className="p-4 font-mono text-sm space-y-3 overflow-x-auto">
              <div>
                <span className="text-text-muted">? </span>
                <span className="text-text-primary">What is your project name? </span>
                <span className="text-accent">my-workspace</span>
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
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-light px-5 py-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              You can still skip this step and run <code className="rounded bg-background px-1.5 py-0.5 text-xs font-mono text-accent">us scaffold</code> manually. The init flow is recommended when you want an AI assistant to continue the build from a stack-aware workspace.
            </p>
          </div>
        </section>

        {/* Step 3: Scaffold */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 3</div>
              <h2 className="text-2xl font-bold tracking-tight">Scaffold Your App</h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            You can scaffold manually with the CLI, or initialize a workspace with an agent pack and ask your AI assistant
            to call <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono text-accent">us scaffold</code> for you.
          </p>

          <ScaffoldPathSwitch />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-sm font-semibold mb-3 text-text-primary">Platforms</h3>
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                {platforms.map((p, i) => (
                  <div key={p.name} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? "border-t border-border" : ""}`}>
                    <span className="text-accent font-mono text-xs mt-0.5">▸</span>
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      <p className="text-xs text-text-muted">{p.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 text-text-primary">Features</h3>
              <p className="text-xs text-text-muted mb-3">
                Base P2P networking, Corestore, and Hyperbee storage are included in every scaffold. Feature flags add specialized capabilities.
              </p>
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                {features.map((f, i) => (
                  <div key={f.name} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? "border-t border-border" : ""}`}>
                    <code className="text-accent font-mono text-xs mt-0.5">{f.name}</code>
                    <p className="text-xs text-text-muted">{f.description}</p>
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
                <span className="text-text-secondary">Scaffolded <span className="text-text-primary">pear-desktop</span> app</span>
              </div>
              <div>
                <span className="text-accent">✓</span>{" "}
                <span className="text-text-secondary">Features: <span className="text-text-primary">local-ai, node-sync</span></span>
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
              <div className="text-accent pl-2">npm install</div>
              <div className="text-accent pl-2">npm run dev</div>
            </div>
          </div>
        </section>

        {/* Step 4: Vibe-Code with AI */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 4</div>
              <h2 className="text-2xl font-bold tracking-tight">
                Vibe-Code with Your AI Assistant
              </h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            Your project comes pre-loaded with an <strong className="text-text-primary">agent pack</strong> — architecture
            rules, module documentation, and battle-tested recipes tailored for your chosen AI assistant.
            It knows how to wire Hyperswarm, set up Hyperbee, integrate QVAC, and connect to your Node.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                icon: Sparkles,
                title: "Architecture Rules",
                description: "Project structure, P2P patterns, and coding conventions",
              },
              {
                icon: FolderOpen,
                title: "Module Docs",
                description: "Deep knowledge of Hyperswarm, HyperDB, QVAC, and more",
              },
              {
                icon: Bot,
                title: "Recipes & Patterns",
                description: "Battle-tested patterns for P2P sync, RPC, tool calling",
              },
              {
                icon: Server,
                title: "Node Integration",
                description: "Knows how to pair with and replicate through your Node",
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <feat.icon className="h-5 w-5 text-accent mb-3" />
                <h3 className="text-sm font-semibold mb-1">{feat.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Step 5: Connect to Your Node */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-text-muted mb-0.5">Step 5</div>
              <h2 className="text-2xl font-bold tracking-tight">
                Connect to Your Unstoppable Node
              </h2>
            </div>
          </div>

          <p className="text-text-secondary mb-6">
            The <strong className="text-text-primary">Unstoppable Node</strong> is your personal always-on P2P hub.
            It runs on a desktop, mini-PC, or server and provides services to every app that pairs with it over Hyperswarm.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {[
              {
                icon: Database,
                title: "Data Sync",
                description: "Replicates Hyperbees and Hypercores. Your data is always available.",
              },
              {
                icon: HardDrive,
                title: "File Sync",
                description: "Seeds and mirrors Hyperdrives across your devices.",
              },
              {
                icon: Cpu,
                title: "AI Provider",
                description: "Delegates QVAC inference. Phone asks, Node runs the model.",
              },
              {
                icon: Search,
                title: "P2P Search",
                description: "Tavily-compatible search API — no API keys required.",
              },
            ].map((svc) => (
              <div key={svc.title} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-holepunch/10 text-holepunch">
                  <svc.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5">{svc.title}</h3>
                  <p className="text-xs text-text-muted leading-relaxed">{svc.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface-light px-5 py-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              Apps discover the Node automatically over Hyperswarm. Data replicates in the background.
              The same protocol works locally today and scales to a hosted cloud later — swap a key, nothing else changes.
            </p>
          </div>
        </section>

        {/* What's Next */}
        <section className="rounded-2xl border border-border bg-surface p-8 md:p-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">What&apos;s Next?</h2>
          <p className="text-text-secondary mb-6 max-w-lg mx-auto">
            Explore the documentation, see what&apos;s coming on the roadmap, or check out what others
            have built with the stack.
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
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-light hover:text-text-primary transition-colors"
            >
              View Roadmap
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
