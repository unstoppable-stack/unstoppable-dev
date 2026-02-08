import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unstoppable Stack — Build P2P, Local AI & Crypto Apps",
  description:
    "Scaffold and vibe-code truly unstoppable applications with P2P protocols, local AI inference, and crypto payments. No servers. No gatekeepers.",
  keywords: [
    "P2P",
    "peer-to-peer",
    "local AI",
    "crypto payments",
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
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
