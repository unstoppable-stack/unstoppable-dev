"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";

const navLinks = [
  { href: "/getting-started", label: "Get started" },
  { href: "/docs", label: "Docs" },
  { href: "/showcase", label: "Examples" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2" aria-label="Unstoppable Stack home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20"><Zap className="h-4 w-4" /></span>
            <span className="text-lg font-bold tracking-tight"><span>Unstoppable</span><span className="font-normal text-text-muted">Stack</span></span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={`rounded-md px-3 py-2 text-sm transition-colors ${isActive(link.href) ? "bg-surface-light text-text-primary" : "text-text-secondary hover:bg-surface-light hover:text-text-primary"}`}>{link.label}</Link>)}
          </div>

          <button ref={menuButton} type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" className="rounded-md p-2 text-text-secondary hover:bg-surface-light hover:text-text-primary md:hidden" onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={`block rounded-md px-3 py-3 text-sm ${isActive(link.href) ? "bg-surface-light text-text-primary" : "text-text-secondary hover:bg-surface-light hover:text-text-primary"}`} onClick={() => setMobileOpen(false)}>{link.label}</Link>)}
          </div>
        </div>
      )}
    </nav>
  );
}
