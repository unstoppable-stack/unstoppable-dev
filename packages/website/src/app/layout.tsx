import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { siteConfig } from "@/lib/release";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Unstoppable Stack — Private apps with local AI and P2P sync",
    template: "%s — Unstoppable Stack",
  },
  description:
    "Tested starters, implementation guides, and reusable components for private apps with local AI and peer-to-peer sync.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "Build private apps with local AI and peer-to-peer sync",
    description: "Tested starters and guidance built with Tether and Holepunch technology.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build private apps with local AI and peer-to-peer sync",
    description: "Tested starters and guidance built with Tether and Holepunch technology.",
  },
  keywords: [
    "P2P",
    "peer-to-peer",
    "local AI",
    "Holepunch",
    "Pear",
    "QVAC",
    "WDK",
    "unstoppable",
    "local-first",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background transition-transform focus:translate-y-0">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
