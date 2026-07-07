import { docsPages } from "@/lib/docs";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Unstoppable Stack Docs",
    "",
    "Developer documentation for building local-first P2P apps with local AI and crypto payments.",
    "",
    "Full text: /llms-full.txt",
    "",
    ...docsPages.map((page) => `- ${page.title}: /docs/${page.slug}`),
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
