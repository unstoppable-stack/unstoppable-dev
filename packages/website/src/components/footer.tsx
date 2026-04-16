import Link from "next/link";
import { Github, Twitter, Zap } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Getting Started", href: "/getting-started" },
    { label: "Documentation", href: "/docs" },
    { label: "Showcase", href: "/showcase" },
    { label: "Roadmap", href: "/roadmap" },
  ],
  stack: [
    { label: "Holepunch", href: "https://holepunch.to/", external: true },
    { label: "Pear Runtime", href: "https://docs.pears.com/", external: true },
    { label: "QVAC", href: "https://qvac.tether.io/", external: true },
    { label: "WDK Wallet", href: "https://wallet.tether.io/", external: true },
  ],
  community: [
    { label: "GitHub", href: "https://github.com/nicosoftware/unstoppable-stack", external: true },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-text-primary">Unstoppable</span>
                <span className="text-text-muted font-normal">Stack</span>
              </span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              Build truly unstoppable applications with P2P protocols, local AI, and crypto payments.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Stack */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">The Stack</h3>
            <ul className="space-y-2">
              {footerLinks.stack.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Community</h3>
            <ul className="space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 mt-4">
              <a
                href="https://github.com/nicosoftware/unstoppable-stack"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-secondary transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Unstoppable Stack. Open source under MIT license.
          </p>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Built on technology by</span>
            <a
              href="https://holepunch.to/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-holepunch hover:underline"
            >
              Holepunch
            </a>
            <span>&</span>
            <a
              href="https://tether.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-tether hover:underline"
            >
              Tether
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
