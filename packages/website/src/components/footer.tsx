import Link from "next/link";
import { Zap } from "lucide-react";
import { siteConfig } from "@/lib/release";
import { gettingStartedPaths } from "@/lib/getting-started";

const links = [
  { label: "Get started", href: "/getting-started" },
  { label: "Documentation", href: "/docs" },
  { label: "Packages & integrations", href: "/docs/packages" },
  { label: "Examples", href: "/showcase" },
  { label: "Personal Node", href: "/personal-node" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Support & limitations", href: "/docs/support" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="mb-4 flex items-center gap-2" aria-label="Unstoppable Stack home">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent"><Zap className="h-4 w-4" /></span>
              <span className="text-lg font-bold tracking-tight">Unstoppable<span className="font-normal text-text-muted">Stack</span></span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-text-muted">Tested starters and guidance for private apps with local data, on-device AI, and direct peer communication.</p>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Install</h2>
            <ul className="space-y-2">{gettingStartedPaths.map((path) => <li key={path.id}><Link href={path.href} className="text-sm text-text-muted transition-colors hover:text-text-primary">{path.action}</Link></li>)}</ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Explore</h2>
            <ul className="space-y-2">{links.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-text-muted transition-colors hover:text-text-primary">{link.label}</Link></li>)}</ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold">Project</h2>
            <p className="text-sm leading-6 text-text-muted">{siteConfig.status}. Built with Tether and Holepunch technology.</p>
            <div className="mt-3 flex flex-col gap-2 text-sm"><a href={siteConfig.publicRepositoryUrl} className="text-text-muted hover:text-text-primary">Source on GitHub</a><a href={siteConfig.publicIssuesUrl} className="text-text-muted hover:text-text-primary">Report an issue</a></div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-8 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Unstoppable Stack. MIT licensed.</p>
          <p>Last support review: {siteConfig.verifiedOn}</p>
        </div>
      </div>
    </footer>
  );
}
