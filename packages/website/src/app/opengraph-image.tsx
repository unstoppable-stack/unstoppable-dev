import { ImageResponse } from "next/og";

export const alt = "Unstoppable Stack — build private apps with local AI and peer-to-peer sync";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0a", color: "#fafafa", padding: "72px 80px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}><div style={{ width: 48, height: 48, borderRadius: 12, background: "#00d4aa", color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>U</div>Unstoppable Stack</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}><div style={{ maxWidth: 1000, fontSize: 68, lineHeight: 1.08, fontWeight: 700, letterSpacing: -2 }}>Build private apps with local AI and peer-to-peer sync.</div><div style={{ fontSize: 26, color: "#a1a1aa" }}>Developer preview · Tested starters and implementation guides</div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#00d4aa", fontSize: 22 }}>Built with Tether and Holepunch technology</div>
    </div>,
    size,
  );
}
