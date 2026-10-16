import type { MetadataRoute } from "next";
import { docsPages } from "@/lib/docs";
import { siteConfig } from "@/lib/release";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/getting-started", "/docs", "/showcase", "/roadmap", "/llms.txt", "/llms-full.txt"];
  const docs = docsPages.filter((page) => page.slug).map((page) => `/docs/${page.slug}`);

  return [...routes, ...docs].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date("2026-10-16"),
    changeFrequency: route.startsWith("/docs") ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/getting-started" || route.startsWith("/docs/start/") ? 0.9 : 0.7,
  }));
}
