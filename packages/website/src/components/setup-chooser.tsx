"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, SquareTerminal, Terminal } from "lucide-react";
import { gettingStartedPaths } from "@/lib/setup-paths";

const icons = { sparkles: Sparkles, code: SquareTerminal, terminal: Terminal };
type SetupId = (typeof gettingStartedPaths)[number]["id"];

export function SetupChooser() {
  const groupId = useId();
  const [selectedId, setSelectedId] = useState<SetupId>(gettingStartedPaths[0].id);
  const selected = gettingStartedPaths.find((path) => path.id === selectedId) ?? gettingStartedPaths[0];

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface/90 p-5 text-left shadow-2xl shadow-black/15 sm:p-7">
      <fieldset>
        <legend className="mb-4 text-sm font-semibold text-text-secondary">Choose your setup</legend>
        <div className="flex flex-wrap gap-2">
          {gettingStartedPaths.map((path) => {
            const Icon = icons[path.icon];
            const id = `${groupId}-${path.id}`;
            return (
              <div key={path.id} className="min-w-0">
                <input id={id} type="radio" name={groupId} value={path.id} checked={selectedId === path.id} onChange={() => setSelectedId(path.id)} className="peer sr-only" />
                <label htmlFor={id} className="inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-border-light px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {path.title}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-6 border-t border-border pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Build with {selected.title === "Raw CLI" ? "the CLI" : selected.title}</h2>
          <span className="rounded-full border border-border-light px-2.5 py-1 text-xs text-text-secondary">{selected.badge}</span>
        </div>
        <p className="max-w-xl text-sm leading-6 text-text-secondary">{selected.description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={selected.href} className="button-primary min-h-12">{selected.action}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          <Link href="/getting-started" className="button-secondary min-h-12">View all setup options<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
        <p className="mt-3 text-xs leading-5 text-text-muted">{selected.detail}</p>
      </div>
    </div>
  );
}
