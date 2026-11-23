import { ImageResponse } from "next/og";

export const alt = "Sandbox — put your next big idea to the test";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f4f4f0",
          color: "#242423",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 78% 20%, #f7c8ed 0, transparent 34%), radial-gradient(circle at 92% 88%, #9bd6c8 0, transparent 35%)" }} />
        <div style={{ position: "absolute", right: 75, top: 72, width: 420, height: 420, border: "1px solid rgba(36,36,35,.16)", borderRadius: 210, display: "flex" }} />
        <div style={{ position: "absolute", right: 125, top: 122, width: 320, height: 320, border: "1px solid rgba(36,36,35,.13)", borderRadius: 160, display: "flex" }} />
        <div style={{ position: "absolute", right: 184, top: 181, width: 202, height: 202, borderRadius: 36, transform: "rotate(-8deg)", background: "rgba(255,255,255,.72)", border: "1px solid rgba(36,36,35,.13)", boxShadow: "0 24px 70px rgba(36,36,35,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#176a5e", fontSize: 80, fontWeight: 700, letterSpacing: -8 }}>SD</div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "58px 68px", width: "100%", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, fontWeight: 650, letterSpacing: -1 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "#ff90e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>SD</div>
            sandbox<span style={{ color: "#176a5e" }}>.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 720, marginTop: -12 }}>
            <div style={{ display: "flex", color: "#176a5e", fontSize: 17, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>A clearer way to explore what’s next</div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 66, lineHeight: 1.04, fontWeight: 750, letterSpacing: -3.5, marginTop: 22 }}>
              <span>Your next big idea,</span>
              <span style={{ color: "#176a5e" }}>put to the test.</span>
            </div>
            <div style={{ display: "flex", fontSize: 23, lineHeight: 1.45, color: "#52524f", marginTop: 22, maxWidth: 630 }}>Shape the idea. Explore the market. See what your assumptions could mean before you build.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: "#52524f", letterSpacing: 1 }}>IDEAS, RESEARCH &amp; SCENARIOS <span style={{ color: "#176a5e" }}>·</span> JOIN THE WAITLIST</div>
        </div>
      </div>
    ),
    size,
  );
}
