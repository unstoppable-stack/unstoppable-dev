export const siteConfig = {
  name: "Unstoppable Stack",
  url: "https://unstoppable-stack.dev",
  publicRepositoryUrl: null,
  publicIssuesUrl: null,
  status: "Developer preview",
  verifiedOn: "25 September 2026",
  cli: {
    packageName: "@unstoppable-stack/cli",
    publishedVersion: "0.3.0",
    candidateVersion: "0.4.0-beta.1",
    installCommand: "npm install -g @unstoppable-stack/cli@0.3.0",
    versionCommand: "us --version",
  },
} as const;

export const supportMatrix = [
  {
    capability: "Pear Desktop scaffold",
    maturity: "Preview",
    detail: "Primary documented path; generated with a renderer and worker boundary.",
  },
  {
    capability: "Local P2P data",
    maturity: "Preview",
    detail: "Hyperswarm discovery and local Hyperbee storage are included in base scaffolds.",
  },
  {
    capability: "Local AI",
    maturity: "Being validated",
    detail: "QVAC integration exists; model size, hardware fit, and first-run download vary.",
  },
  {
    capability: "Personal Node",
    maturity: "Deferred alpha",
    detail: "Source exists, but packaging, trust defaults, and replication-status gates exclude it from the core preview.",
  },
  {
    capability: "Expo Mobile",
    maturity: "Deferred",
    detail: "Generated source exists, but native device evidence does not yet support a public claim.",
  },
  {
    capability: "Wallet payments",
    maturity: "Planned",
    detail: "The CLI contains a stub; no production payment path is claimed.",
  },
] as const;

export const defaultScaffoldCommand =
  "us scaffold app -p pear-desktop -n coffee-notes";
