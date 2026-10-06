import { docsPages } from "@/lib/docs";
import { siteConfig } from "@/lib/release";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Unstoppable Stack Docs",
    "",
    "Developer preview documentation for building local-first apps with direct peer communication and optional local AI.",
    `Verified: ${siteConfig.verifiedOn}`,
    `Published CLI: ${siteConfig.cli.publishedVersion}`,
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
