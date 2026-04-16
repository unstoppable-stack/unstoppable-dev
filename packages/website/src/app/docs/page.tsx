import Link from "next/link";
import {
  Zap,
  Terminal,
  Radio,
  Database,
  HardDrive,
  Network,
  BrainCircuit,
  Wallet,
  Smartphone,
  BookOpen,
  ArrowRight,
  Wrench,
  Bot,
  ExternalLink,
  Server,
  Search,
  Layers,
  Cpu,
  Lock,
} from "lucide-react";

export const metadata = {
  title: "Documentation — Unstoppable Stack",
  description:
    "Learn about every module in the Unstoppable Stack — P2P networking, local AI, the Unstoppable Node, and more.",
};

const sections = [
  {
    title: "P2P & Runtime",
    description:
      "Build serverless applications with Holepunch's P2P infrastructure",
    parent: "Holepunch",
    parentColor: "text-holepunch",
    modules: [
      {
        icon: Zap,
        name: "Pear",
        description:
          "Desktop runtime for building and deploying P2P applications. The foundation for unstoppable desktop apps.",
        docs: "https://docs.pears.com/",
      },
      {
        icon: Terminal,
        name: "Bare",
        description:
          "Minimal JavaScript runtime for desktop and mobile. Like Node.js, but designed for embedding and cross-device use.",
        docs: "https://docs.pears.com/reference/bare-overview.html",
      },
      {
        icon: Radio,
        name: "Hyperswarm",
        description:
          "P2P networking layer. Find and connect to peers by topic using a distributed hash table (DHT).",
        docs: "https://docs.pears.com/building-blocks/hyperswarm.html",
      },
      {
        icon: Network,
        name: "RPC",
        description:
          "Remote procedure calls over P2P connections. Build request/response patterns on top of Hyperswarm streams.",
        docs: "https://docs.holepunch.to/",
      },
    ],
  },
  {
    title: "Data & Storage",
    description: "Peer-to-peer data storage, synchronization, and replication",
    parent: "Holepunch",
    parentColor: "text-holepunch",
    modules: [
      {
        icon: Layers,
        name: "Hypercore",
        description:
          "Append-only log — the foundation of the entire data stack. Every Hyperbee, Hyperdrive, and Autobase is built on Hypercores.",
        docs: "https://docs.pears.com/building-blocks/hypercore.html",
      },
      {
        icon: Database,
        name: "Hyperbee",
        description:
          "Sorted key-value database built on Hypercore. B-tree based, supports range queries, and replicates efficiently over Hyperswarm.",
        docs: "https://docs.pears.com/building-blocks/hyperbee.html",
      },
      {
        icon: Database,
        name: "HyperDB",
        description:
          "Multi-writer P2P database built on Autobase. Conflict-free, collaborative, and replicated across peers.",
        docs: "https://docs.holepunch.to/",
      },
      {
        icon: HardDrive,
        name: "Hyperdrive",
        description:
          "P2P file system. Store and sync files across peers in real-time with a familiar filesystem API.",
        docs: "https://docs.pears.com/building-blocks/hyperdrive.html",
      },
      {
        icon: Server,
        name: "Corestore",
        description:
          "Manages multiple Hypercores under one storage. The foundation for the Unstoppable Node's replication engine.",
        docs: "https://docs.pears.com/building-blocks/corestore.html",
      },
      {
        icon: Lock,
        name: "SecretStream",
        description:
          "Encrypted transport layer for P2P connections. Handles Noise protocol handshake and key exchange automatically.",
        docs: "https://docs.holepunch.to/",
      },
    ],
  },
  {
    title: "AI & Payments",
    description: "Local AI inference and self-custodial crypto payments",
    parent: "Tether",
    parentColor: "text-tether",
    modules: [
      {
        icon: BrainCircuit,
        name: "QVAC SDK",
        description:
          "Run AI models locally on any device. Vision, RAG, transcription, TTS — cross-platform, P2P native, completely private.",
        docs: "https://qvac.tether.io/",
      },
      {
        icon: Wallet,
        name: "WDK Wallet",
        description:
          "Self-custodial Bitcoin and Tether wallet toolkit. Payments for both humans and machines.",
        docs: "https://wallet.tether.io/",
      },
    ],
  },
  {
    title: "Mobile",
    description: "Take your P2P apps to mobile devices",
    parent: "Holepunch",
    parentColor: "text-holepunch",
    modules: [
      {
        icon: Smartphone,
        name: "Expo Bare",
        description:
          "React Native powered by the Bare runtime. Build mobile P2P apps with the same stack as desktop. Pairs with the Unstoppable Node for data sync and AI inference.",
        docs: "https://docs.pears.com/guide/making-a-bare-mobile-app.html",
      },
    ],
  },
];

const products = [
  {
    icon: Server,
    name: "Unstoppable Node",
    description:
      "Your personal always-on P2P hub. Replicates data (Hyperbee, Hypercore), seeds files (Hyperdrive), delegates AI inference (QVAC), and powers P2P search. Apps pair automatically over Hyperswarm.",
    features: [
      "Data Sync — Corestore-based replication",
      "File Sync — Hyperdrive mirroring",
      "AI Provider — QVAC inference delegation",
      "P2P Search — Tavily-compatible API",
    ],
    href: "/roadmap",
  },
  {
    icon: Search,
    name: "Unstoppable Search",
    description:
      "A P2P search engine for AI agents. Crawls and indexes locally with QVAC. Three-tier replication: index metadata syncs automatically, content downloads on demand, remote peers queried via RPC.",
    features: [
      "Tavily-compatible API — drop-in replacement",
      "No API keys required",
      "HyperDB index syncs between peers",
      "Local QVAC for ranking and answers",
    ],
    href: "/roadmap",
  },
  {
    icon: Bot,
    name: "Unstoppable Agent",
    description:
      "A terminal-based AI coding assistant that runs on any OpenAI-compatible provider (LM Studio, Ollama, cloud). 19 tools, subagent orchestration, skill system, and full agent-pack integration.",
    features: [
      "19 tools — file, terminal, skills, knowledge, memory",
      "Subagent orchestration with context isolation",
      "Skill system with progressive disclosure",
      "Permission system with glob patterns",
    ],
    href: "/roadmap",
  },
];

const quickLinks = [
  {
    icon: Wrench,
    title: "CLI Reference",
    description: "us init, us scaffold, us doctor — commands and flags",
    href: "/getting-started",
  },
  {
    icon: Bot,
    title: "Agent Pack",
    description: "How the AI assistant integration works",
    href: "/getting-started#step-3",
  },
  {
    icon: BookOpen,
    title: "Roadmap",
    description: "Development phases, coverage, and what's next",
    href: "/roadmap",
  },
];

export default function DocsPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.06)_0%,_transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Documentation
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Everything you need to know about the Unstoppable Stack — modules,
              products, and how they fit together.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-24">
        {/* Quick Links */}
        <section className="mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-5 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <link.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5 group-hover:text-accent transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-xs text-text-muted">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Products */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Products</h2>
          <p className="text-text-secondary text-sm mb-6">
            Higher-level products built on the Unstoppable Stack modules.
          </p>

          <div className="space-y-4">
            {products.map((product) => (
              <div
                key={product.name}
                className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-border-light hover:bg-surface-light"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <product.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <Link
                        href={product.href}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                      >
                        Roadmap
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-3">
                      {product.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {product.features.map((feat) => (
                        <div
                          key={feat}
                          className="flex items-center gap-2 text-xs text-text-muted"
                        >
                          <span className="h-1 w-1 rounded-full bg-accent shrink-0" />
                          {feat}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Module Sections */}
        {sections.map((section) => (
          <section key={section.title} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold tracking-tight">
                {section.title}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                  section.parent === "Holepunch"
                    ? "bg-holepunch/10 text-holepunch"
                    : "bg-tether/10 text-tether"
                }`}
              >
                {section.parent}
              </span>
            </div>
            <p className="text-text-secondary text-sm mb-6">
              {section.description}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.modules.map((mod) => (
                <div
                  key={mod.name}
                  className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-border-light hover:bg-surface-light"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          section.parent === "Holepunch"
                            ? "bg-holepunch/10 text-holepunch"
                            : "bg-tether/10 text-tether"
                        }`}
                      >
                        <mod.icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold">{mod.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {mod.description}
                  </p>
                  <a
                    href={mod.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    Official docs
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Coming Soon */}
        <section className="rounded-2xl border border-border bg-surface p-8 md:p-10 text-center">
          <BookOpen className="h-8 w-8 text-text-muted mx-auto mb-4" />
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            More Documentation Coming
          </h2>
          <p className="text-text-secondary mb-6 max-w-lg mx-auto">
            We&apos;re working on detailed guides, tutorials, and API references
            for each module. Per-module docs with code examples, pitfalls, and
            best practices are on the way.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/getting-started"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent-hover"
            >
              Get Started Now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-light hover:text-text-primary transition-colors"
            >
              View Roadmap
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
