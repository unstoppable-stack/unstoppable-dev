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
} from "lucide-react";

export const metadata = {
  title: "Documentation — Unstoppable Stack",
  description:
    "Learn about every module in the Unstoppable Stack — P2P networking, local AI, crypto payments, and more.",
};

const sections = [
  {
    title: "P2P & Runtime",
    description: "Build serverless applications with Holepunch's P2P infrastructure",
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
    title: "Data",
    description: "Peer-to-peer data storage and synchronization",
    parent: "Holepunch",
    parentColor: "text-holepunch",
    modules: [
      {
        icon: Database,
        name: "HyperDB",
        description:
          "P2P key-value database built on Autobase. Multi-writer, conflict-free, and replicated across peers.",
        docs: "https://docs.holepunch.to/",
      },
      {
        icon: HardDrive,
        name: "Hyperdrive",
        description:
          "P2P file system. Store and sync files across peers in real-time with a familiar filesystem API.",
        docs: "https://docs.pears.com/building-blocks/hyperdrive.html",
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
          "Run AI models locally on any device. Cross-platform, P2P native, completely private. No cloud required.",
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
          "React Native powered by the Bare runtime. Build mobile P2P apps with the same stack as desktop.",
        docs: "https://docs.pears.com/guide/making-a-bare-mobile-app.html",
      },
    ],
  },
];

const quickLinks = [
  {
    icon: Wrench,
    title: "CLI Reference",
    description: "Commands, flags, and configuration options",
    href: "/getting-started",
  },
  {
    icon: Bot,
    title: "Agent Pack",
    description: "How the AI assistant integration works",
    href: "/docs",
  },
  {
    icon: BookOpen,
    title: "Recipes",
    description: "Common patterns and working examples",
    href: "/docs",
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
              Everything you need to know about the Unstoppable Stack. Each module is independent
              but composable — pick what you need.
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

        {/* Module Sections */}
        {sections.map((section) => (
          <section key={section.title} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
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
            <p className="text-text-secondary text-sm mb-6">{section.description}</p>

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
          <h2 className="text-2xl font-bold tracking-tight mb-3">More Documentation Coming</h2>
          <p className="text-text-secondary mb-6 max-w-lg mx-auto">
            We&apos;re working on detailed guides, tutorials, and API references for each module. Full
            per-module docs with code examples, pitfalls, and best practices are on the way.
          </p>
          <Link
            href="/getting-started"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background transition-all hover:bg-accent-hover"
          >
            Get Started Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
