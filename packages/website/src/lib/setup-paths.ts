import { siteConfig } from "./release";

// Shared by the homepage chooser, setup directory and documentation links.
// Add an available path here; the layouts wrap without a fixed option count.
export const gettingStartedPaths = [
  {
    id: "claude",
    icon: "sparkles",
    title: "Claude Code",
    badge: "Plugin preview",
    description: "Add the stack’s workflows to Claude. Describe your app and build with guided P2P, storage and local AI patterns.",
    action: "Install Claude plugin",
    href: "/docs/start/claude",
    detail: "Download, install locally, then start a new session.",
  },
  {
    id: "codex",
    icon: "code",
    title: "Codex",
    badge: "Plugin preview",
    description: "Give Codex the same stack knowledge. Build, extend and diagnose apps from your chosen workspace.",
    action: "Install Codex plugin",
    href: "/docs/start/codex",
    detail: "Download, register the local catalog, then install.",
  },
  {
    id: "cli",
    icon: "terminal",
    title: "Raw CLI",
    badge: siteConfig.cli.published ? `Published · ${siteConfig.cli.version}` : "Source preview",
    description: "Work directly in your terminal. Initialize a workspace, scaffold a desktop app and check your environment.",
    action: "Install the CLI",
    href: "/docs/start/cli",
    detail: siteConfig.cli.published ? "Install from npm. An AI assistant is optional." : "Use the matching source candidate until its npm release.",
  },
] as const;
