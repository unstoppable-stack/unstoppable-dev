import Link from "next/link";
import {
  ArrowRight,
  Terminal,
  Bot,
  BrainCircuit,
  Server,
  Search,
  Globe,
  Database,
  HardDrive,
  Cpu,
  Radio,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
} from "lucide-react";

export const metadata = {
  title: "Roadmap — Unstoppable Stack",
  description:
    "Where we are and where we're going. Track the development of the CLI, Agent Pack, Unstoppable Node, and more.",
};

/* ───────────────────────── data ───────────────────────── */

type BadgeVariant = "green" | "yellow" | "blue";

const workstreams = [
  {
    icon: Terminal,
    title: "CLI",
    tagline: "us command",
    badge: "Shipped" as const,
    badgeVariant: "green" as BadgeVariant,
    description:
      "us init, us scaffold, us doctor. Scaffolds Pear Desktop, Expo Mobile, and Node CLI apps with P2P, KV storage, local AI, and multi-writer features.",
  },
  {
    icon: Bot,
    title: "Agent Pack",
    tagline: "AI rules for every assistant",
    badge: "Shipped" as const,
    badgeVariant: "green" as BadgeVariant,
    description:
      "Pre-built rules, recipes, and patterns injected into Claude, Cursor, OpenCode, and Codex. Your AI assistant knows P2P architecture, QVAC, and the full Holepunch stack.",
  },
  {
    icon: BrainCircuit,
    title: "Unstoppable Agent",
    tagline: "Local AI coding assistant",
    badge: "Phase 2 done" as const,
    badgeVariant: "green" as BadgeVariant,
    description:
      "A terminal-based AI coding agent that runs on any OpenAI-compatible provider (LM Studio, Ollama, cloud). 19 tools, subagent orchestration, skill system.",
  },
  {
    icon: Server,
    title: "Unstoppable Node",
    tagline: "Personal P2P sync hub",
    badge: "Pairing & replication built" as const,
    badgeVariant: "yellow" as BadgeVariant,
    description:
      "Your personal always-on node. Replicates Hyperbees/Hypercores (Data Sync), mirrors Hyperdrives (File Sync), delegates QVAC inference (AI Provider). Apps pair automatically over Hyperswarm.",
  },
  {
    icon: Search,
    title: "Unstoppable Search",
    tagline: "P2P search engine",
    badge: "In progress" as const,
    badgeVariant: "blue" as BadgeVariant,
    description:
      "A P2P search engine for AI agents. Crawls, indexes, and searches locally with QVAC. Indexes sync between peers. Tavily-compatible API — drop-in replacement, no API keys needed. Three-tier replication: index metadata syncs automatically, content downloads on demand, remote peers queried via RPC.",
  },
  {
    icon: Globe,
    title: "Website",
    tagline: "unstoppable.dev",
    badge: "Scaffolded" as const,
    badgeVariant: "yellow" as BadgeVariant,
    description:
      "Landing page, getting started guide, documentation, and showcase.",
  },
];

const phases = [
  {
    name: "Phase 0: Foundation",
    status: "Done",
    statusIcon: CheckCircle2,
    statusColor: "text-accent",
    description: "Planning docs, monorepo structure, research.",
  },
  {
    name: "Phase 1: POC",
    status: "In progress",
    statusIcon: Clock,
    statusColor: "text-amber-400",
    description: "CLI skeleton, agent pack v0, website v0, reference apps.",
  },
  {
    name: "Phase 2: Content & Mobile",
    status: "Partially done",
    statusIcon: Clock,
    statusColor: "text-amber-400",
    description:
      "Mobile support (Expo Bare), per-module documentation, more recipes.",
  },
  {
    name: "Phase 3: Unstoppable Auth",
    status: "Planned",
    statusIcon: Circle,
    statusColor: "text-blue-400",
    description: "Local-first identity model, device linking and recovery.",
  },
  {
    name: "Phase 4: Cloud Services",
    status: "Vision",
    statusIcon: Eye,
    statusColor: "text-text-muted",
    description:
      "Hosted node (same protocol, subscription-based), inference hosting, backup services.",
  },
];

const nodeServices = [
  {
    icon: Database,
    title: "Data Sync",
    description:
      "Replicates Hyperbees, Hypercores. Corestore-based. Always available.",
  },
  {
    icon: HardDrive,
    title: "File Sync",
    description: "Replicates Hyperdrives, mirrors to local filesystem.",
  },
  {
    icon: Cpu,
    title: "AI Provider",
    description:
      "Delegates QVAC inference over P2P. Phone sends request, Node runs 7B model, streams tokens back.",
  },
  {
    icon: Search,
    title: "Search",
    description:
      "P2P search with HyperDB index, Tavily-compatible API, three-tier replication.",
  },
];

const coverage = [
  { label: "Platform / Runtime", done: 10, total: 12 },
  { label: "QVAC (Local AI)", done: 7, total: 18 },
  { label: "P2P & Data", done: 7, total: 15 },
  { label: "Build Tooling", done: 5, total: 7 },
  { label: "WDK (Payments)", done: 0, total: 6, note: "Blocked on SDK" },
];

const coverageTotal = { done: 29, total: 58 };

function badgeClasses(variant: BadgeVariant) {
  switch (variant) {
    case "green":
      return "bg-accent/10 text-accent";
    case "yellow":
      return "bg-amber-400/10 text-amber-400";
    case "blue":
      return "bg-blue-400/10 text-blue-400";
  }
}

/* ───────────────────────── page ───────────────────────── */

export default function RoadmapPage() {
  return (
    <div className="relative">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.06)_0%,_transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-12 md:pt-32 md:pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Roadmap
            </h1>
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Where we are and where we&apos;re going. The Unstoppable Stack is
              in active development.
            </p>
          </div>
        </div>
      </section>

      {/* ── Workstreams ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              What We&apos;re Building
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Six workstreams, one goal: make it trivially easy to build apps
              that no one can shut down.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workstreams.map((ws) => (
              <div
                key={ws.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                    <ws.icon className="h-6 w-6" />
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${badgeClasses(ws.badgeVariant)}`}
                  >
                    {ws.badge}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-1">{ws.title}</h3>
                <p className="text-xs text-text-muted mb-3">{ws.tagline}</p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {ws.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Development Phases ── */}
      <section className="py-20 md:py-28 border-t border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              The Journey
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              From foundation to cloud services — a phased approach to building
              the unstoppable ecosystem.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {phases.map((phase, i) => (
              <div key={phase.name} className="relative flex gap-6">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface ${phase.statusColor}`}
                  >
                    <phase.statusIcon className="h-5 w-5" />
                  </div>
                  {i < phases.length - 1 && (
                    <div className="w-px flex-1 bg-border my-2" />
                  )}
                </div>

                {/* Content */}
                <div className={i < phases.length - 1 ? "pb-10" : "pb-0"}>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold">{phase.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        phase.status === "Done"
                          ? "bg-accent/10 text-accent"
                          : phase.status === "In progress" ||
                              phase.status === "Partially done"
                            ? "bg-amber-400/10 text-amber-400"
                            : phase.status === "Planned"
                              ? "bg-blue-400/10 text-blue-400"
                              : "bg-surface-light text-text-muted"
                      }`}
                    >
                      {phase.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {phase.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Node Architecture ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              The Unstoppable Node
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Your personal always-on P2P hub. Four services, one device, zero
              cloud dependency.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nodeServices.map((svc) => (
              <div
                key={svc.title}
                className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-holepunch/10 text-holepunch mb-4 transition-colors group-hover:bg-holepunch/15">
                  <svc.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold mb-2">{svc.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {svc.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-border bg-surface-light px-6 py-5 text-center">
            <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mx-auto">
              Apps pair with the Node over Hyperswarm. Data replicates
              automatically. The same protocol scales to hosted cloud later —
              swap a key, nothing else changes.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stack Coverage ── */}
      <section className="py-20 md:py-28 border-t border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Stack Coverage
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              How much of the stack is battle-tested with validated patterns and
              recipes.
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            {coverage.map((item) => {
              const pct = Math.round((item.done / item.total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {item.label}
                      {item.note && (
                        <span className="text-text-muted font-normal">
                          {" "}
                          — {item.note}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-text-muted font-mono">
                      {item.done}/{item.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 0
                          ? "bg-text-muted"
                          : pct >= 70
                            ? "bg-accent"
                            : pct >= 40
                              ? "bg-amber-400"
                              : "bg-blue-400"
                      }`}
                      style={{ width: `${Math.max(pct, pct === 0 ? 0 : 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
              <span className="text-lg font-bold">Total</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-accent font-mono">
                  {Math.round(
                    (coverageTotal.done / coverageTotal.total) * 100
                  )}
                  %
                </span>
                <span className="text-sm text-text-muted font-mono">
                  {coverageTotal.done}/{coverageTotal.total} battle-tested
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Want to Build With Us?
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto mb-10">
            The stack is open source and in active development. Try the CLI,
            explore the agent pack, or contribute on GitHub.
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
