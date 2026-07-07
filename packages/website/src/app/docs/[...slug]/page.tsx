import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsShell } from "@/components/docs-shell";
import { getDocPage, getDocStaticParams } from "@/lib/docs";

export const dynamicParams = false;

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) notFound();

  return <DocsShell page={page} />;
}

export function generateStaticParams() {
  return getDocStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) notFound();

  return {
    title: `${page.title} - Unstoppable Stack Docs`,
    description: page.description,
  };
}
