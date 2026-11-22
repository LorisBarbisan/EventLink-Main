import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorReporting, Sentry } from "./lib/error-reporting";

initErrorReporting();

// A page's code file failed to download: usually a release went out while the
// tab was open, or a flaky in-app browser dropped the request. Reload once to
// pick up the current files. The timestamp stops a reload loop if the file is
// genuinely missing; in that case the error falls through to CrashFallback.
const RELOAD_KEY = "chunk-reload-at";
window.addEventListener("vite:preloadError", () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: we can't guard against a loop, so don't auto-reload
    return;
  }
  window.location.reload();
});

// If a screen crashes, report it and show something better than a white page
function CrashFallback() {
  return (
    <div
      style={{
        padding: 32,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 480,
        margin: "64px auto",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        This page hit an error and we&apos;ve been told about it. Reloading usually fixes it.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          background: "#D8690E",
          color: "white",
          border: 0,
        }}
      >
        Reload
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<CrashFallback />}>
    <App />
  </Sentry.ErrorBoundary>
);
