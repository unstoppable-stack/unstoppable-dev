import { ArrowDown, ArrowRight, Database, Monitor } from "lucide-react";

export function NodeArchitecture() {
  return (
    <figure className="rounded-2xl border border-accent/25 bg-surface/40 p-6 md:p-8">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-3">
          {["Your notes app", "Your reports app"].map((name) => (
            <div key={name} className="rounded-xl border border-border bg-background p-5">
              <Database aria-hidden="true" className="mb-3 h-5 w-5 text-accent" />
              <p className="font-semibold">{name}</p>
              <p className="mt-1 text-sm text-text-secondary">Own interface · Own local data</p>
              <p className="mt-2 text-xs text-text-muted">Works without the node</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 text-center text-sm text-accent">
          <ArrowRight aria-hidden="true" className="hidden h-7 w-7 md:block" />
          <ArrowDown aria-hidden="true" className="h-7 w-7 md:hidden" />
          <span>Selected data<br />with permission</span>
        </div>
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-6">
          <Monitor aria-hidden="true" className="mb-4 h-7 w-7 text-accent" />
          <p className="text-xl font-semibold">Your Personal Node</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
            <li>Keeps verified copies of shared data</li>
            <li>Shows what has synced</li>
            <li>Lets you browse saved content</li>
            <li>Serves copied data to permitted, compatible apps</li>
          </ul>
        </div>
      </div>
      <figcaption className="mt-6 border-t border-border pt-5 text-sm leading-6 text-text-muted">Recommended companion pattern for apps that need another data copy. Apps keep working offline; new copies require the node to be running and reachable. A node on the same computer does not protect against losing that computer.</figcaption>
    </figure>
  );
}
