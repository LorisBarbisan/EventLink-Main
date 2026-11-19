import * as Sentry from "@sentry/react";

/**
 * Browser error reporting (Sentry). Inert unless VITE_SENTRY_DSN is set at
 * build time. Tagged with the deployed commit; no request bodies, cookies or
 * form values are sent, and money/identifier-looking fields are redacted.
 */
const SENSITIVE =
  /pass|token|secret|key|auth|cookie|email|phone|address|pence|amount|total|profit|rate|earning|expense|income|salary|tax|vat|utr|sort_code|account|iban|reference_number|note/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = SENSITIVE.test(k) ? "[REDACTED]" : scrub(v, depth + 1);
    return out;
  }
  return value;
}

export function initErrorReporting(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE as string | undefined) || undefined,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
    beforeBreadcrumb(b) {
      // Typed text and form values never leave the browser
      if (b.category === "ui.input") return null;
      if (b.data) b.data = scrub(b.data) as Record<string, unknown>;
      return b;
    },
  });
  return true;
}

export { Sentry };
