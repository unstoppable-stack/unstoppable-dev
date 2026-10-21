import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const technologies = [
  {
    name: "Holepunch",
    role: "Peer-to-peer foundations",
    description: "The ecosystem behind Hypercore, Hyperswarm, and Autobase: building blocks for local data, peer discovery, and replication between devices.",
    href: "https://holepunch.to/",
    linkLabel: "Explore Holepunch",
    logo: "/technologies/holepunch.svg",
  },
  {
    name: "Pear",
    role: "App distribution & updates",
    description: "Holepunch’s platform for building and sharing peer-to-peer apps. Our desktop starter combines an Electron interface with Pear’s over-the-air updates.",
    href: "https://docs.pears.com/",
    linkLabel: "Read Pear docs",
    logo: "/technologies/pear.svg",
  },
  {
    name: "Bare",
    role: "JavaScript runtime",
    description: "A small, modular runtime from Holepunch. In our desktop apps, a Bare worker runs P2P, storage, and native AI away from the interface.",
    href: "https://bare.pears.com/",
    linkLabel: "Explore Bare",
    logo: "/technologies/bare.svg",
  },
  {
    name: "QVAC",
    role: "On-device AI",
    description: "Tether’s local AI platform powers inference on the user’s device. Our runtime adapters handle model loading, cancellation, and shutdown inside the worker.",
    href: "https://docs.qvac.tether.io/",
    linkLabel: "Read QVAC docs",
    logo: "/technologies/qvac.svg",
  },
  {
    name: "WDK",
    role: "Self-custodial wallets",
    description: "Tether’s Wallet Development Kit provides tools for multi-chain, self-custodial wallets. Integration here is planned; current wallet scaffolds are stubs, and payments are outside the core preview.",
    href: "https://docs.wdk.tether.io/",
    linkLabel: "Read WDK docs",
    logo: "/technologies/wdk.svg",
    planned: true,
  },
];

export function TechnologyStack() {
  return (
    <section id="technology" className="section scroll-mt-16 border-t border-border" aria-labelledby="technology-title">
      <div className="section-inner">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">The technology underneath</p>
            <h2 id="technology-title" className="section-title">Built on open foundations.</h2>
            <p className="section-copy">Unstoppable Stack brings Tether and Holepunch technologies together with app starters, runtime adapters, and assistant guidance. Here is what each part does.</p>
          </div>
          <Link href="/docs/packages" className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover">
            Explore our integrations <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          {technologies.map((technology) => (
            <article key={technology.name} className={`card flex flex-col ${technology.planned ? "md:col-span-2 xl:col-span-4" : "xl:col-span-2"}`}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="relative h-16 w-44 max-w-full">
                  <Image src={technology.logo} alt="" fill sizes="176px" className="object-contain object-left" />
                </div>
                {technology.planned && <span className="rounded-full border border-border-light px-3 py-1 text-xs font-medium text-text-secondary">Planned integration</span>}
              </div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">{technology.role}</p>
              <h3 className="sr-only">{technology.name}</h3>
              <p className="mb-6 text-sm leading-6 text-text-secondary">{technology.description}</p>
              <a href={technology.href} className="mt-auto inline-flex w-fit items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover">
                {technology.linkLabel} <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm leading-6 text-text-muted">Each link leads to the upstream project. Availability in Unstoppable Stack follows our <Link href="/docs/support" className="text-text-secondary underline underline-offset-4 hover:text-text-primary">preview support boundaries</Link>.</p>
      </div>
    </section>
  );
}
