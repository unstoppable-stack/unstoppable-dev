import type { Metadata } from "next";
import { DocsShell } from "@/components/docs-shell";
import { getDocPage } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation - Unstoppable Stack",
  description:
    "Build local-first apps with P2P networking, local AI, self-custodial payments, and assistant-aware scaffolding.",
};

export default function DocsIndexPage() {
  const page = getDocPage("");

  if (!page) return null;

  return <DocsShell page={page} />;
}
