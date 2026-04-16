import Link from "next/link";
import {
  ArrowRight,
  Globe,
  BrainCircuit,
  Wallet,
  Terminal,
  Layers,
  Bot,
  Zap,
  Database,
  HardDrive,
  Radio,
  Smartphone,
  Network,
  ExternalLink,
  Server,
  Search,
  Cpu,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { TypingPrompt } from "@/components/typing-prompt";

/* ───────────────────────── data ───────────────────────── */

const valuePillars = [
  {
    icon: Globe,
    title: "P2P by Default",
    description:
      "No servers, no infrastructure costs. Your app runs on user devices and syncs peer-to-peer through Holepunch's battle-tested stack.",
  },
  {
    icon: Server,
    title: "Your Personal Node",
    description:
      "The Unstoppable Node is your always-on P2P hub — syncs data, seeds files, runs local AI, and powers search. Apps pair automatically over Hyperswarm.",
  },
  {
    icon: BrainCircuit,
    title: "Local AI, Total Privacy",
    description:
      "Run inference models directly on-device with QVAC. Delegate heavy workloads to your Node. Your data never leaves your network.",
  },
  {
    icon: Wallet,
    title: "Crypto Payments Built In",
    description:
      "Self-custodial wallets for humans and machines with Tether's WDK. Accept payments without intermediaries.",
  },
];

const technologies = [
  {
    name: "Pear Runtime",
    description: "Zero-infrastructure P2P apps for Desktop, Terminal & Mobile",
    href: "https://docs.pears.com/",
    parent: "Holepunch",
  },
  {
    name: "Holepunch P2P",
    description:
      "Hypercore, Hyperswarm, HyperDB, Hyperdrive — the modular P2P stack",
    href: "https://holepunch.to/",
    parent: "Holepunch",
  },
  {
    name: "QVAC",
    description: "Local AI inference. Private, cross-platform, P2P native.",
    href: "https://qvac.tether.io/",
    parent: "Tether",
  },
  {
    name: "WDK Wallet",
    description: "Self-custodial Bitcoin & Tether wallet toolkit",
    href: "https://wallet.tether.io/",
    parent: "Tether",
  },
];

const steps = [
  {
    number: "01",
    icon: Terminal,
    title: "Install the CLI",
    description: "One command to get started. Works with npm, pnpm, or yarn.",
    code: "us init",
  },
  {
    number: "02",
    icon: Layers,
    title: "Scaffold Your App",
    description:
      "Pick your platform (Pear Desktop, Expo Mobile, Node CLI), choose features (P2P, AI, KV storage), and select your AI assistant.",
    code: "us scaffold app -p pear-desktop -f p2p,kv-storage",
  },
  {
    number: "03",
    icon: Bot,
    title: "Vibe-Code with AI",
    description:
      "Your project comes pre-loaded with an agent pack — architecture rules, recipes, and patterns for Claude, Cursor, OpenCode, or Codex.",
  },
  {
    number: "04",
    icon: Server,
    title: "Connect to Your Node",
    description:
      "Your app auto-pairs with the Unstoppable Node over Hyperswarm. Data replicates, files sync, AI inference delegates — all P2P, zero config.",
  },
];

const modules = [
  {
    icon: Zap,
    name: "Pear",
    description: "Desktop P2P runtime",
    parent: "hp" as const,
  },
  {
    icon: Terminal,
    name: "Bare",
    description: "Minimal JS runtime",
    parent: "hp" as const,
  },
  {
    icon: Radio,
    name: "Hyperswarm",
    description: "P2P networking / DHT",
    parent: "hp" as const,
  },
  {
    icon: Database,
    name: "HyperDB",
    description: "P2P key-value database",
    parent: "hp" as const,
  },
  {
    icon: HardDrive,
    name: "Hyperdrive",
    description: "P2P file storage",
    parent: "hp" as const,
  },
  {
    icon: Network,
    name: "RPC",
    description: "Remote procedure calls",
    parent: "hp" as const,
  },
  {
    icon: BrainCircuit,
    name: "QVAC SDK",
    description: "Local AI inference",
    parent: "tether" as const,
  },
  {
    icon: Wallet,
    name: "WDK Wallet",
    description: "Crypto payments",
    parent: "tether" as const,
  },
  {
    icon: Smartphone,
    name: "Expo Bare",
    description: "React Native + Bare",
    parent: "hp" as const,
  },
];

/* ───────────────────────── page ───────────────────────── */

export default function Home() {
  return (
    <div className="relative">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.08)_0%,_transparent_50%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-32 md:pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-text-secondary mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Now in early development
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Build{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-tether">
                Unstoppable
              </span>{" "}
              Apps
            </h1>

            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              Scaffold P2P apps with your favorite AI assistant. Sync data, run local AI,
              <br className="hidden sm:block" />
              and power search through your personal Unstoppable Node. No servers. No gatekeepers.
            </p>

            <div className="max-w-lg mx-auto mb-10">
              <CodeBlock code="npm i -g @unstoppable-stack/cli && us init" />
            </div>

            <div className="mb-12">
              <TypingPrompt />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/getting-started"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-background transition-all hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(0,212,170,0.3)]"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/nicosoftware/unstoppable-stack"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
              >
                View on GitHub
              </a>
            </div>

            <p className="text-xs text-text-muted">
              Built on technology by{" "}
              <a
                href="https://holepunch.to/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-holepunch hover:underline"
              >
                Holepunch
              </a>{" "}
              &{" "}
              <a
                href="https://tether.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-tether hover:underline"
              >
                Tether
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Value Pillars ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Why Unstoppable?
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Traditional apps depend on servers you don&apos;t control. Unstoppable apps run on your
              users&apos; devices, communicate directly, and can&apos;t be shut down.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {valuePillars.map((pillar) => (
              <div
                key={pillar.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent mb-6 transition-colors group-hover:bg-accent/15">
                  <pillar.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{pillar.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Powered By ── */}
      <section className="py-20 md:py-28 border-t border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Powered by Industry Leaders
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              The Unstoppable Stack combines battle-tested P2P infrastructure from Holepunch with
              Tether&apos;s AI and financial technology.
            </p>
          </div>

          {/* Parent brands */}
          <div className="flex items-center justify-center gap-12 md:gap-20 mb-16">
            <a
              href="https://holepunch.to/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-3 transition-opacity hover:opacity-80"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-holepunch/10 border border-holepunch/20">
                <span className="text-2xl font-bold text-holepunch">H</span>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-text-primary">Holepunch</div>
                <div className="text-xs text-text-muted">The P2P Company</div>
              </div>
            </a>

            <div className="h-16 w-px bg-border" />

            <a
              href="https://tether.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-3 transition-opacity hover:opacity-80"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tether/10 border border-tether/20">
                <span className="text-2xl font-bold text-tether">T</span>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-text-primary">Tether</div>
                <div className="text-xs text-text-muted">AI & Financial Technology</div>
              </div>
            </a>
          </div>

          {/* Technology cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {technologies.map((tech) => (
              <a
                key={tech.name}
                href={tech.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border bg-background p-6 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      tech.parent === "Holepunch"
                        ? "bg-holepunch/10 text-holepunch"
                        : "bg-tether/10 text-tether"
                    }`}
                  >
                    {tech.parent}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-base font-semibold mb-1">{tech.name}</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {tech.description}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              From Zero to Unstoppable
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Four steps. One CLI. Your app is scaffolded with P2P wiring, AI agent instructions,
              and a personal Node that keeps everything synced.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <div className="text-6xl font-black text-border/50 mb-4 font-mono">
                  {step.number}
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {step.description}
                </p>
                {step.code && (
                  <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-xs">
                    <span className="text-text-muted">$ </span>
                    <span className="text-accent">{step.code}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack Modules Grid ── */}
      <section className="py-20 md:py-28 border-t border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              The Full Stack
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Mix and match modules to build exactly what you need. Every module is independent but
              composable.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <div
                key={mod.name}
                className="group flex items-start gap-4 rounded-xl border border-border bg-background p-5 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    mod.parent === "hp"
                      ? "bg-holepunch/10 text-holepunch"
                      : "bg-tether/10 text-tether"
                  }`}
                >
                  <mod.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{mod.name}</h3>
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none ${
                        mod.parent === "hp"
                          ? "bg-holepunch/10 text-holepunch"
                          : "bg-tether/10 text-tether"
                      }`}
                    >
                      {mod.parent === "hp" ? "Holepunch" : "Tether"}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">{mod.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Unstoppable Node ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              The Unstoppable Node
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Your personal always-on P2P hub. It runs on a desktop, mini-PC, or server and
              provides four services to every app that connects.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                icon: Database,
                title: "Data Sync",
                description: "Replicates Hyperbees and Hypercores. Corestore-based. Your data is always available, even when your phone isn\u2019t.",
              },
              {
                icon: HardDrive,
                title: "File Sync",
                description: "Seeds and mirrors Hyperdrives. Photos, documents, backups \u2014 all synced P2P across your devices.",
              },
              {
                icon: Cpu,
                title: "AI Provider",
                description: "Delegates QVAC inference over P2P. Your phone sends a prompt, the Node runs a 7B model, and streams tokens back.",
              },
              {
                icon: Search,
                title: "P2P Search",
                description: "Crawls, indexes, and searches locally. Tavily-compatible API for AI agents. No API keys, no cloud dependency.",
              },
            ].map((svc) => (
              <div
                key={svc.title}
                className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-holepunch/10 text-holepunch mb-4 transition-colors group-hover:bg-holepunch/15">
                  <svc.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold mb-2">{svc.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{svc.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface-light px-6 py-5 text-center mb-12">
            <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mx-auto">
              Apps pair with the Node over Hyperswarm. Data replicates automatically.
              The same protocol scales to a hosted cloud later — swap a key, nothing else changes.
            </p>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold mb-2">Plus the Ecosystem</h3>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              Beyond the Node, the stack includes a local coding agent and a P2P search engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <div className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-border-light hover:bg-surface-light">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Unstoppable Agent</h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                A terminal-based AI coding assistant with 19 tools, subagent orchestration, and
                a skill system. Runs on any OpenAI-compatible provider — LM Studio, Ollama, or cloud.
              </p>
            </div>
            <div className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-border-light hover:bg-surface-light">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Unstoppable Search</h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                A P2P search engine that crawls and indexes locally with QVAC. Three-tier replication:
                metadata syncs automatically, content on demand, remote queries via RPC.
              </p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              See the full roadmap
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Start Building Unstoppable Apps Today
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto mb-10">
            One CLI command. Pick your AI assistant. Choose your modules. Ship apps that no one can
            shut down.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/getting-started"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-sm font-semibold text-background transition-all hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(0,212,170,0.3)]"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/nicosoftware/unstoppable-stack"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-8 py-3.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
