import * as Sentry from "@sentry/node";

/**
 * Error reporting (Sentry). Inert unless SENTRY_DSN is set.
 *
 * Every event is tagged with the release (the deployed commit) and scrubbed
 * before it leaves the server: no request bodies, cookies or auth headers,
 * and any field whose name looks like money, a token or an identifier is
 * redacted — the same rule as the request log (sanitize-log-data.ts).
 */
const SENSITIVE =
  /pass|token|secret|key|auth|cookie|email|phone|address|pence|amount|total|profit|rate|earning|expense|income|salary|tax|vat|utr|sort_code|account|iban|reference_number|note/i;

let enabled = false;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[REDACTED]" : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function initErrorReporting(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("ℹ️  Error reporting off (no SENTRY_DSN)");
    return;
  }
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
          event.request.headers = scrub(event.request.headers) as Record<string, string>;
        }
      }
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.user) event.user = { id: event.user.id }; // id only
      return event;
    },
    beforeBreadcrumb(b) {
      if (b.data) b.data = scrub(b.data) as Record<string, unknown>;
      return b;
    },
  });
  enabled = true;
  console.log("✅ Error reporting on");
}

/** Report an error, with optional (scrubbed) context and tags. Never throws. */
export function reportError(
  err: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  console.error(err);
  if (!enabled) return;
  try {
    Sentry.captureException(err, {
      tags: context?.tags,
      extra: context?.extra ? (scrub(context.extra) as Record<string, unknown>) : undefined,
    });
  } catch {
    /* reporting must never take anything down */
  }
}

/** An informational event (e.g. what a destructive job is about to delete). */
export function reportInfo(message: string, extra?: Record<string, unknown>): void {
  console.log(`[info] ${message}`, extra ?? "");
  if (!enabled) return;
  try {
    Sentry.captureMessage(message, { level: "info", extra });
  } catch {
    /* never throw */
  }
}

/** Send anything queued before the process exits. */
export async function flushErrors(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* ignore */
  }
}

export { Sentry };
export const errorReportingEnabled = () => enabled;
