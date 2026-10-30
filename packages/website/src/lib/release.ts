import pluginDownload from "./plugin-download.json";
import pluginRelease from "../../../agent-pack/release.json";
import cliPackage from "../../../cli/package.json";
import p2pPackage from "../../../p2p/package.json";

const installVersion = pluginRelease.cliInstallVersion;
const setupInstallCommand = pluginRelease.cliRegistryPublished
  ? `npm install -g @unstoppable-stack/cli@${installVersion}`
  : `git clone https://github.com/unstoppable-stack/unstoppable-dev.git unstoppable-cli-source
cd unstoppable-cli-source
git checkout ${pluginRelease.cliSourceRef}
cd packages/cli
npm ci --ignore-scripts
npm run build
mkdir -p ../../cli-artifacts
npm pack --pack-destination ../../cli-artifacts
npm install --global --prefix "$HOME/.local" ../../cli-artifacts/unstoppable-stack-cli-${installVersion}.tgz
export PATH="$HOME/.local/bin:$PATH"
cd ~`;

export const siteConfig = {
  name: "Unstoppable Stack",
  url: "https://unstoppable-stack.dev",
  publicRepositoryUrl: "https://github.com/unstoppable-stack/unstoppable-dev",
  publicIssuesUrl: "https://github.com/unstoppable-stack/unstoppable-dev/issues",
  status: "Developer preview",
  verifiedOn: "25 September 2026",
  docsUpdatedOn: "30 October 2026",
  plugins: {
    version: pluginDownload.version,
    downloadPath: `/downloads/${pluginDownload.filename}`,
    checksumPath: "/downloads/plugin-release.json",
    filename: pluginDownload.filename,
    directory: pluginDownload.directory,
  },
  cli: {
    packageName: "@unstoppable-stack/cli",
    version: installVersion,
    published: pluginRelease.cliRegistryPublished,
    latestVersion: pluginRelease.registryLatestObserved,
    sourceVersion: cliPackage.version,
    installCommand: setupInstallCommand,
    versionCommand: "us --version",
  },
  p2p: {
    version: "0.6.0-alpha.4",
    sourceVersion: p2pPackage.version,
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
  "us scaffold app -p pear-desktop -n shop-starter";
