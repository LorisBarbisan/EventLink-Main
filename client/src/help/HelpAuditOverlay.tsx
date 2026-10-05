import { useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import type { HelpEntry } from "./types";

/**
 * Dev-only coverage overlay (`?help=audit`). Outlines every element carrying a
 * help key — green where a registry entry exists, red where it does not — and
 * lists registry entries that no longer match anything on the page. Coverage
 * stays honest through this and the CI key check, not through discipline.
 */
export function HelpAuditOverlay({ registry }: { registry: Map<string, HelpEntry> | null }) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const id = window.setInterval(force, 800);
    return () => window.clearInterval(id);
  }, []);

  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("help") !== "audit") return null;

  const nodes = Array.from(document.querySelectorAll("[data-help], [data-help-key]"));
  const seen = new Set<string>();
  const marks = nodes.map((el, i) => {
    const key = el.getAttribute("data-help") || el.getAttribute("data-help-key") || "";
    seen.add(key);
    return { key, rect: el.getBoundingClientRect(), has: registry?.has(key) ?? false, i };
  });
  const orphans = registry ? Array.from(registry.keys()).filter((k) => !seen.has(k)) : [];
  const missing = marks.filter((m) => !m.has).length;

  return createPortal(
    <>
      {marks.map((m) => (
        <div
          key={m.i}
          style={{
            position: "fixed",
            left: m.rect.left - 2,
            top: m.rect.top - 2,
            width: m.rect.width + 4,
            height: m.rect.height + 4,
            border: `2px solid ${m.has ? "#16a34a" : "#dc2626"}`,
            borderRadius: 4,
            pointerEvents: "none",
            zIndex: 9998,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -15,
              left: 0,
              fontSize: 10,
              lineHeight: "14px",
              background: m.has ? "#16a34a" : "#dc2626",
              color: "#fff",
              padding: "0 4px",
              borderRadius: 2,
              whiteSpace: "nowrap",
            }}
          >
            {m.key || "(no key)"}
          </span>
        </div>
      ))}
      <div
        style={{
          position: "fixed",
          right: 8,
          bottom: 8,
          width: 300,
          maxHeight: "40vh",
          overflow: "auto",
          background: "#111",
          color: "#eee",
          fontSize: 11,
          fontFamily: "monospace",
          padding: 10,
          borderRadius: 6,
          zIndex: 9999,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>Help audit</div>
        <div>
          {marks.length} element(s) — {marks.length - missing} ok,{" "}
          <span style={{ color: missing ? "#f87171" : "#eee" }}>{missing} missing</span>
        </div>
        <div style={{ marginTop: 6 }}>Registry keys not on page ({orphans.length}):</div>
        <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
          {orphans.slice(0, 60).map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
    </>,
    document.body
  );
}
