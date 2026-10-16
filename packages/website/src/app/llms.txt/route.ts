import { docsPages } from "@/lib/docs";
import { siteConfig } from "@/lib/release";
import { gettingStartedPaths } from "@/lib/getting-started";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Unstoppable Stack Docs",
    "",
    "Developer preview documentation for building local-first apps with direct peer communication and optional local AI.",
    `Verified: ${siteConfig.verifiedOn}`,
    `Published CLI: ${siteConfig.cli.publishedVersion}`,
    `Published CLI beta: ${siteConfig.cli.candidateVersion}`,
    "",
    "## Three primary getting-started paths",
    ...gettingStartedPaths.map((path) => `- ${path.title} (${path.badge}): ${path.href}`),
    `- Plugin preview download: ${siteConfig.plugins.downloadPath}`,
    `- Plugin checksum and source identity: ${siteConfig.plugins.checksumPath}`,
    "",
    "Package structure: CLI + one P2P capabilities library; Claude/Codex plugins share guidance. QVAC and wallet integrations use upstream SDKs. P2P alpha 0.6.0-alpha.1 is published on npm, wallet scaffolds are stubs, and Memory and Search are excluded from this release.",
    "",
    "Full text: /llms-full.txt",
    "",
    ...docsPages.map((page) => `- ${page.title}: ${page.slug ? `/docs/${page.slug}` : "/docs"}`),
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
