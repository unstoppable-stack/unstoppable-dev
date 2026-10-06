import type { Metadata } from "next";
import { DocsShell } from "@/components/docs-shell";
import { getDocPage } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Task-based developer preview documentation for local-first apps, peer communication, and optional local AI.",
  alternates: { canonical: "/docs" },
};

export default function DocsIndexPage() {
  const page = getDocPage("");

  if (!page) return null;

  return <DocsShell page={page} />;
}
