import { ImageResponse } from "next/og";

// Default share image for pages that do not set their own (listing pages use
// the listing photo). Brand colours come from the logo kit.
export const alt = "RightProperty365: property for sale and to rent in Zimbabwe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INDIGO = "#1900AC";
const TURQUOISE = "#21DDBA";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: INDIGO,
          color: "#ffffff",
        }}
      >
        <svg width="246" height="160" viewBox="0 0 246 160">
          <path d="M0 104 93 12l91 66h62l-13 21h-59L93 42 0 134Z" fill="#ffffff" />
          <path
            d="M92 111h18v18H92zm24 0h18v18h-18zM92 135h18v18H92zm24 0h18v18h-18z"
            fill="#ffffff"
          />
        </svg>
        <div style={{ display: "flex", marginTop: 40, fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
          rightproperty<span style={{ color: TURQUOISE }}>365</span>.com
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 40, opacity: 0.9 }}>
          Property for sale and to rent in Zimbabwe
        </div>
      </div>
    ),
    size,
  );
}
