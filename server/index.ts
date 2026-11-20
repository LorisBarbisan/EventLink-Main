import cors from "cors";
import { sendgridEventWebhook } from "./api/routes/email-events.route";
import { LOCK, runExclusive, scheduleExclusive } from "./api/utils/scheduled-lock";
import { allowedOrigins, isAllowedOrigin } from "./api/utils/cors-origins";
import dotenv from "dotenv";
import express, { NextFunction, type Request, Response } from "express";
import helmet from "helmet";
import { ogTagMiddleware } from "./api/middleware/ogTags";
import { reconcileAdminUsers } from "./api/utils/reconcile-admin-users";
import { seedProductionJobs } from "./api/utils/seed-production-jobs";
import { backfillSlugs, backfillCountry, correctCountries } from "./api/utils/backfill-slugs";
import { registerJobNotificationScheduler } from "./api/services/job-notification-scheduler.service";
import { registerGuestJobNudgeScheduler } from "./api/services/guest-job-nudge.service";

import { registerProfileNudgeScheduler } from "./api/services/profile-nudge-scheduler.service";
import { registerInvoiceChaserScheduler } from "./api/services/invoice-chaser.service";
import { registerCredentialReminderScheduler } from "./api/services/credential-reminder-scheduler.service";
import { registerCalendarScheduler } from "./api/services/calendarScheduler.service";
import { sweepStuckParseJobs } from "./api/services/import-parse-worker.service";
import { sweepStuckCommits } from "./api/services/import-commit.service";
import { sweepArchived } from "./api/services/undo.service";
import { pruneBooksEvents } from "./api/services/books-usage.service";
import { pruneOldReports } from "./api/services/safety.service";
import { seedSystemMappings } from "./api/services/import-seed.service";
import { ensureAdditiveSchema } from "./api/utils/ensure-additive-schema";

import { sanitizeLogData } from "./api/utils/sanitize-log-data";
import { registerRoutes } from "./routes-modular";
import { storage } from "./storage";
import { log, serveStatic, setupVite } from "./vite";
import { handleWebhook } from "./api/controllers/stripe.controller";
import { flushErrors, initErrorReporting, reportError } from "./api/utils/error-reporting";
import { sql } from "drizzle-orm";
import { db } from "./api/config/db";
dotenv.config();

// ── Error reporting, before anything else can fail ─────────────────────────
initErrorReporting();
// A rejection nobody awaited: report it and carry on.
process.on("unhandledRejection", (reason) => {
  reportError(reason, { tags: { kind: "unhandledRejection" } });
});
// An exception that escaped everything: the process is in an unknown state.
// Get the report off the box first, then exit and let Railway restart cleanly.
process.on("uncaughtException", (err) => {
  reportError(err, { tags: { kind: "uncaughtException" } });
  flushErrors(2000).finally(() => process.exit(1));
});

const app = express();

// CRITICAL: Enable trust proxy for production deployment behind reverse proxy (Railway)
// This fixes rate limiting and IP detection issues in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // Trust one hop — Railway's reverse proxy
  console.log("✅ Trust proxy enabled for production");
} else {
  // More specific trust proxy for development to avoid rate limiting warnings
  app.set("trust proxy", "loopback, linklocal, uniquelocal");
  console.log("✅ Trust proxy enabled for development");
}

// Security headers — the ONE helmet configuration (routes-modular.ts has none)
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://accounts.google.com",
            "https://connect.facebook.net",
            "https://platform.linkedin.com",
            "https://snap.licdn.com",
            "https://www.googletagmanager.com",
            "https://www.google-analytics.com",
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "blob:",
            "https://media.licdn.com",
            "https://storage.googleapis.com",
          ],
          connectSrc: [
            "'self'",
            "https://api.linkedin.com",
            "https://storage.googleapis.com",
            "https://www.google-analytics.com",
            "https://analytics.google.com",
            "https://region1.google-analytics.com",
            "https://px.ads.linkedin.com",
            "wss://localhost:*",
            "wss://*.up.railway.app",
            "wss://eventlink.one",
          ],
          frameSrc: [
            "https://accounts.google.com",
            "https://www.facebook.com",
            "https://www.linkedin.com",
          ],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow OAuth embeds
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    })
  );
} else {
  // Disable CSP completely in development for Vite compatibility
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
}

// Additional production security headers
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
}

// Stripe webhook must receive raw body — register BEFORE express.json()
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleWebhook);
// SendGrid event webhook: signed over the raw body, so also before express.json()
app.post(
  "/api/webhooks/sendgrid",
  express.raw({ type: "application/json", limit: "5mb" }),
  sendgridEventWebhook
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// CORS — the single allowlist (server/api/utils/cors-origins.ts)
if (process.env.NODE_ENV === "production" && !process.env.APP_URL) {
  console.error(
    "⚠️  APP_URL is not set in production: CORS falls back to eventlink.one and Railway only, and Stripe return links will be wrong."
  );
}
const corsAllowlist = allowedOrigins(process.env);
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin and non-browser requests send no Origin header
      if (!origin) return callback(null, true);
      callback(null, isAllowedOrigin(origin, corsAllowlist));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400, // 24 hours
  })
);

// Keep only one health check endpoint
// Health: can the service do its job? The database must answer within 2s.
// Unauthenticated and cheap; says nothing about version or environment.
app.get("/health", async (_req, res) => {
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 2000)),
    ]);
    res.set("Cache-Control", "no-store").status(200).json({ status: "ok" });
  } catch {
    res.set("Cache-Control", "no-store").status(503).json({ status: "unavailable" });
  }
});

// TEMPORARY: proves Sentry receives server errors. Exists only where
// ALLOW_DEBUG_ERRORS=true (staging); remove once reporting is confirmed.
if (process.env.ALLOW_DEBUG_ERRORS === "true") {
  app.get("/api/debug/boom", () => {
    throw new Error("Sentry check");
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Add sanitized response info (no PII exposure). Never for financial
      // routes: their numbers are the sensitive part, and status + duration
      // are what we debug with.
      const financial =
        /^\/api\/(books|earnings|expenses|invoices|billing-profile|mileage|kit|imports?|tax)(\/|$)/.test(
          path
        );
      if (capturedJsonResponse && !financial) {
        const sanitizedResponse = sanitizeLogData(capturedJsonResponse);
        if (Object.keys(sanitizedResponse).length > 0) {
          logLine += ` :: ${JSON.stringify(sanitizedResponse)}`;
        }
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure additive schema (new columns/tables) exists BEFORE any query runs, so
  // a deploy can't be ahead of the database and break reads/writes. Idempotent.
  await ensureAdditiveSchema();

  // Reconcile admin users on startup
  await reconcileAdminUsers();
  await seedProductionJobs();
  backfillSlugs().catch((err) => console.error("Slug backfill failed:", err));
  backfillCountry().catch((err) => console.error("Country backfill failed:", err));
  correctCountries().catch((err) => console.error("Country corrections failed:", err));
  registerJobNotificationScheduler();
  registerGuestJobNudgeScheduler();
  registerProfileNudgeScheduler();
  registerInvoiceChaserScheduler();
  registerCredentialReminderScheduler();
  registerCalendarScheduler();
  // Seed system import mappings for QuickBooks / Xero / FreeAgent
  seedSystemMappings().catch((err) =>
    console.error("[import-seed] failed to seed system mappings:", err)
  );

  // Sweep stuck import parse/commit jobs every 15 minutes
  setInterval(
    () => {
      runExclusive(LOCK.IMPORT_STUCK_SWEEP, async () => {
        await sweepStuckParseJobs().catch((err) =>
          reportError(err, {
            tags: { kind: "scheduled-job", job: "interval" },
            extra: { where: "[import-sweeper] parse sweep failed:" },
          })
        );
        await sweepStuckCommits().catch((err) =>
          reportError(err, {
            tags: { kind: "scheduled-job", job: "interval" },
            extra: { where: "[import-sweeper] commit sweep failed:" },
          })
        );
      }).catch((err) =>
        reportError(err, {
          tags: { kind: "scheduled-job", job: "interval" },
          extra: { where: "[import-sweeper] lock failed:" },
        })
      );
    },
    15 * 60 * 1000
  );

  // Hard-delete earnings/expenses archived more than 30 days ago, nightly 03:30 UK
  scheduleExclusive(
    LOCK.UNDO_SWEEP,
    "30 3 * * *",
    () => {
      sweepArchived().catch((err) =>
        reportError(err, {
          tags: { kind: "scheduled-job", job: "undo-sweep" },
          extra: { where: "failed:" },
        })
      );
    },
    { timezone: "Europe/London" }
  );

  // Books usage log retention: 24 months, nightly 03:45 UK
  scheduleExclusive(
    LOCK.BOOKS_EVENTS_PRUNE,
    "45 3 * * *",
    () => {
      pruneBooksEvents().catch((err) =>
        reportError(err, {
          tags: { kind: "scheduled-job", job: "books-usage" },
          extra: { where: "prune failed:" },
        })
      );
    },
    { timezone: "Europe/London" }
  );

  // Safety report retention: six years, nightly 03:50 UK
  scheduleExclusive(
    LOCK.REPORTS_PRUNE,
    "50 3 * * *",
    () => {
      pruneOldReports().catch((err) =>
        reportError(err, {
          tags: { kind: "scheduled-job", job: "safety" },
          extra: { where: "prune failed:" },
        })
      );
    },
    { timezone: "Europe/London" }
  );

  // OG tag middleware for social media crawlers (must be before Vite catch-all)
  app.use(ogTagMiddleware);

  const { httpServer: server, wss } = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    if (status >= 500) reportError(err, { tags: { kind: "request" } });
    else console.error("Server error:", err);
  });

  if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      next();
    });
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const host = "0.0.0.0";

  // Graceful shutdown: close WebSocket server then HTTP server
  const shutdown = (signal: string) => {
    log(`${signal} received — shutting down gracefully`);
    wss.close(() => log("WebSocket server closed"));
    server.close(() => {
      log("HTTP server closed");
      process.exit(0);
    });

    // Give in-flight requests 10 s to finish before forcing exit
    setTimeout(() => {
      console.error("Shutdown timeout — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Is another instance running?`);
      process.exit(1);
    } else {
      console.error("HTTP server error:", err);
      process.exit(1);
    }
  });

  server.listen(port, host, async () => {
    log(`serving on port ${port} (host: ${host})`);

    try {
      const closed = await storage.closeExpiredJobs();
      if (closed > 0) log(`Startup: auto-closed ${closed} expired job(s)`);
    } catch (err) {
      console.error("Failed to close expired jobs on startup:", err);
    }

    setInterval(
      async () => {
        try {
          await runExclusive(LOCK.JOB_EXPIRY_HOURLY, () => storage.closeExpiredJobs());
        } catch (err) {
          reportError(err, {
            tags: { kind: "scheduled-job", job: "interval" },
            extra: { where: "Periodic job expiry check failed:" },
          });
        }
      },
      60 * 60 * 1000
    );
  });
})();
