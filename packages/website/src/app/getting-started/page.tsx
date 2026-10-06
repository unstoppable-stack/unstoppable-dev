import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { defaultScaffoldCommand, siteConfig } from "@/lib/release";

export const metadata: Metadata = {
  title: "Get started",
  description: "Install the released CLI and build the supported Pear Desktop baseline.",
  alternates: { canonical: "/getting-started" },
};

const steps = [
  {
    title: "Check the required tools",
    body: "The desktop generator needs Node.js 20 or newer and npm. The generated project installs Electron and pear-runtime locally. An AI coding assistant is optional; a Personal Node, wallet, and local model are not required for this baseline.",
    code: "node --version\nnpm --version",
  },
  {
    title: "Install the published CLI",
    body: `Install the exact public version used by this guide, then confirm which binary your shell resolves. The repository is preparing ${siteConfig.cli.candidateVersion}; this guide stays on the published release until that candidate is verified on the registry.`,
    code: `${siteConfig.cli.installCommand}\n${siteConfig.cli.versionCommand}`,
  },
  {
    title: "Configure an assistant workspace",
    body: "The init flow creates a workspace and writes guidance for Claude Code, Cursor, OpenCode, Codex, or no assistant. Open the generated folder in your chosen tool after this step.",
    code: "us init coffee-workspace\ncd coffee-workspace",
  },
  {
    title: "Create the desktop app",
    body: "This command creates coffee-notes as a child folder. Base P2P networking and local key-value storage are included, so obsolete p2p or kv-storage feature flags are not needed.",
    code: defaultScaffoldCommand,
  },
  {
    title: "Install and run",
    body: "Run these commands from the generated application folder. A Pear window should open. Dependency or runtime errors belong to this step; a model is not downloading in the baseline.",
    code: "cd coffee-notes\nnpm install\nnpm run dev",
  },
  {
    title: "Make one observable change",
    body: "Ask your coding assistant to make a small UI change, then reload the app and confirm it. This verifies that the generated project guidance is being used before you add another runtime capability.",
    prompt: "In the generated Pear Desktop app, show saved entries newest first and add a visible “Newest first” label. Keep storage and peer networking in the worker. Run the existing checks when finished.",
  },
  {
    title: "Verify local persistence",
    body: "Create an entry, close the app normally, start it again, and confirm the entry remains. Disconnecting from the network must not prevent local reads or writes; it only pauses peer discovery and replication.",
  },
  {
    title: "Add local AI or another peer separately",
    body: "After the baseline works, consult the local AI and connection guides. Local AI requires a model download and compatible hardware. Personal Node pairing may require explicit approval and is never part of first-run success.",
  },
];

const troubleshooting = [
  ["us: command not found", "Run npm prefix -g and check that its bin directory is on PATH.", "Open a new terminal after installation or add the reported bin directory to PATH."],
  ["Desktop dependencies are missing", "Run npm ls --depth=0 inside coffee-notes.", "Run npm install in that generated folder and address the first meaningful npm error."],
  ["The package version is unavailable", "Run npm view @unstoppable-stack/cli versions --json.", `Use the documented public version ${siteConfig.cli.publishedVersion}; do not substitute the repository candidate.`],
  ["npm install fails", "Read the first error above the final npm summary.", "Resolve that specific network, permission, or native dependency error, then rerun npm install in coffee-notes."],
  ["The app window does not open", "Run us doctor -p pear-desktop and confirm npm run dev is being run inside coffee-notes.", "Fix the failed doctor check, then restart the dev command."],
  ["A local model does not download or load", "Confirm free disk space and read the first QVAC/model error.", "Return to the base scaffold, or choose a smaller compatible model before retrying the optional local-ai path."],
  ["Personal Node is not found", "Confirm the Node is running and that the app is requesting supported capabilities.", "Continue device-only, or review pairing approval and network reachability; the app should not fail locally."],
];

export default function GettingStartedPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,170,0.08)_0%,_transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <p className="eyebrow">Supported first path</p>
          <h1 className="mb-5 text-4xl font-bold tracking-tight md:text-6xl">Build the Pear Desktop baseline.</h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-text-secondary">One linear walkthrough: install the public CLI, configure your assistant, run a local-first app, make a change, and verify persistence.</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5">
          <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div><h2 className="font-semibold text-amber-300">Preview boundary</h2><p className="mt-1 text-sm leading-6 text-text-secondary">This path verifies scaffolding and local persistence. Real local-inference requirements are still being measured, so this page does not pretend that downloading or loading a model is part of the baseline.</p></div></div>
        </div>

        <ol className="space-y-8">
          {steps.map((step, index) => (
            <li key={step.title} className="grid gap-4 sm:grid-cols-[48px_1fr]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-background">{index + 1}</span>
              <div className="min-w-0 rounded-2xl border border-border bg-surface p-6">
                <h2 className="text-xl font-semibold">{step.title}</h2>
                <p className="mt-3 leading-7 text-text-secondary">{step.body}</p>
                {step.code ? <div className="mt-5"><CodeBlock code={step.code} /></div> : null}
                {step.prompt ? <div className="mt-5 rounded-xl border border-border bg-background p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Prompt for your assistant</p><p className="text-sm leading-6 text-text-secondary">{step.prompt}</p></div> : null}
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-20" aria-labelledby="troubleshooting-title">
          <p className="eyebrow">Recognize, diagnose, recover</p>
          <h2 id="troubleshooting-title" className="section-title">Troubleshooting</h2>
          <div className="mt-8 space-y-4">{troubleshooting.map(([symptom, diagnostic, recovery]) => <details key={symptom} className="rounded-xl border border-border bg-surface p-5"><summary className="cursor-pointer font-semibold">{symptom}</summary><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="mb-1 font-medium text-text-primary">Check</dt><dd className="leading-6 text-text-secondary">{diagnostic}</dd></div><div><dt className="mb-1 font-medium text-text-primary">Recover</dt><dd className="leading-6 text-text-secondary">{recovery}</dd></div></dl></details>)}</div>
        </section>

        <section className="mt-16 rounded-2xl border border-accent/20 bg-accent/10 p-7 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-7 w-7 text-accent" />
          <h2 className="text-xl font-semibold">Baseline working?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">Read the architecture and support boundaries before enabling local AI, multi-writer data, or Personal Node sync.</p>
          <Link href="/docs" className="button-primary mt-6">Continue to docs <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </div>
  );
}
