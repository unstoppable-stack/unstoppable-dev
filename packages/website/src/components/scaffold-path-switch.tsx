"use client";

import { useState } from "react";
import { Bot, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/code-block";

const paths = {
  manual: {
    label: "Manual CLI",
    icon: Terminal,
    title: "Scaffold directly from your terminal",
    description:
      "Use this path when you already know the platform and feature flags you want. The CLI writes the full app immediately.",
    code: "us scaffold app -p pear-desktop -n my-chat -f local-ai,node-sync\ncd my-chat\nnpm install\nnpm run dev",
    output: [
      "Creates a Pear Desktop app",
      "Adds base P2P + Hyperbee storage",
      "Adds QVAC local AI and Node sync wiring",
      "Includes assistant docs if you initialized the project first",
    ],
  },
  agent: {
    label: "With Agent",
    icon: Bot,
    title: "Initialize once, then ask your agent",
    description:
      "Use this path when you want Claude, Cursor, OpenCode, or Codex to pick the right scaffold command and continue wiring the app with stack-aware context.",
    code: "us init my-workspace\ncd my-workspace\n\n# In your AI assistant:\nBuild me a Pear Desktop chat app with local AI and Node sync.\nUse the Unstoppable Stack CLI to scaffold it first.",
    output: [
      "Agent reads the generated project instructions",
      "Agent runs `us scaffold app ...` with the right platform and features",
      "Agent explains generated files and next steps",
      "You keep control: review commands before they run if your assistant asks",
    ],
  },
};

export function ScaffoldPathSwitch() {
  const [active, setActive] = useState<keyof typeof paths>("manual");
  const selected = paths[active];
  const Icon = selected.icon;

  return (
    <div className="mb-8 rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-2 border-b border-border bg-background/40 p-1">
        {(Object.keys(paths) as Array<keyof typeof paths>).map((key) => {
          const item = paths[key];
          const ItemIcon = item.icon;
          const isActive = active === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-background"
                  : "text-text-secondary hover:bg-surface-light hover:text-text-primary"
              }`}
            >
              <ItemIcon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{selected.title}</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {selected.description}
            </p>
          </div>
        </div>

        <CodeBlock code={selected.code} />

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {selected.output.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
