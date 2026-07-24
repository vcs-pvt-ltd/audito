"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#031b18", color: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", boxSizing: "border-box" }}>
          <section style={{ width: "100%", maxWidth: "440px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", background: "#053B36", padding: "32px", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", boxSizing: "border-box" }}>
            <div style={{ width: "56px", height: "56px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "16px", color: "#fcd34d", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <AlertTriangle size={26} />
            </div>
            <p style={{ margin: "20px 0 0", color: "#85d4c4", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Temporary issue</p>
            <h1 style={{ margin: "10px 0 0", fontSize: "25px" }}>We couldn&apos;t open Audito</h1>
            <p style={{ margin: "14px 0 0", color: "#cbd5d1", fontSize: "14px", lineHeight: 1.6 }}>Please try again in a moment. Your data has not been changed.</p>
            <button type="button" onClick={reset} style={{ width: "100%", minHeight: "46px", marginTop: "24px", border: 0, borderRadius: "12px", color: "#05251f", background: "#00d494", fontWeight: 700, cursor: "pointer" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><RefreshCw size={16} /> Try again</span>
            </button>
            <a href="/" style={{ display: "inline-block", marginTop: "16px", color: "#a8d0af", fontSize: "14px" }}>Return home</a>
          </section>
        </main>
      </body>
    </html>
  );
}
