import Link from "next/link";
import { ArrowRight, Sparkles, SquareTerminal, Terminal } from "lucide-react";
import { gettingStartedPaths } from "@/lib/setup-paths";

const icons = { sparkles: Sparkles, code: SquareTerminal, terminal: Terminal };

export function GettingStartedCards() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-5">
      {gettingStartedPaths.map((path) => {
        const Icon = icons[path.icon];
        return (
          <div key={path.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-6 text-left transition-colors hover:border-accent/40">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-accent" />
              <span className="rounded-full border border-border-light px-2.5 py-1 text-xs text-text-secondary">{path.badge}</span>
            </div>
            <h3 className="mb-3 text-2xl font-semibold tracking-tight">{path.title}</h3>
            <p className="mb-6 text-sm leading-6 text-text-secondary">{path.description}</p>
            <div className="mt-auto">
              <Link href={path.href} className="button-primary min-h-16 w-full px-3">{path.action}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
              <p className="mt-3 text-xs leading-5 text-text-muted">{path.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
