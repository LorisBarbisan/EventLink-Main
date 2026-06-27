import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, type Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ogTagMiddleware } from "./api/middleware/ogTags";
import { reconcileAdminUsers } from "./api/utils/reconcile-admin-users";
import { seedProductionJobs } from "./api/utils/seed-production-jobs";
import { backfillSlugs } from "./api/utils/backfill-slugs";
import { registerJobNotificationScheduler } from "./api/services/job-notification-scheduler.service";
import { sanitizeLogData } from "./api/utils/sanitize-log-data";
import { registerRoutes } from "./routes-modular";
import { storage } from "./storage";
import { log, serveStatic, setupVite } from "./vite";
dotenv.config();

const app = express();

// CRITICAL: Enable trust proxy for production deployment behind reverse proxy (Railway)
// This fixes rate limiting and IP detection issues in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", true); // Trust Railway's reverse proxy chain
  console.log("✅ Trust proxy enabled for production");
} else {
  // More specific trust proxy for development to avoid rate limiting warnings
  app.set("trust proxy", "loopback, linklocal, uniquelocal");
  console.log("✅ Trust proxy enabled for development");
}

// Security middleware - disable CSP in development
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
            "https://api.eventlink.com",
            "https://api.linkedin.com",
            "https://storage.googleapis.com",
            "https://www.google-analytics.com",
            "https://analytics.google.com",
            "https://region1.google-analytics.com",
            "https://px.ads.linkedin.com",
            "wss://localhost:*",
            "wss://*.replit.dev",
            "wss://*.replit.app",
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
// NOTE: Do NOT add HTTPS redirect here — Replit's reverse proxy handles SSL termination.
// The app must serve plain HTTP; redirecting to HTTPS breaks Replit's health checks.
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

// PRODUCTION-READY RATE LIMITING with proper proxy support
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 500 : 1000, // Stricter in production
  message: { error: "Too many requests from this IP, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  skipSuccessfulRequests: false,
});

// More restrictive rate limiting for data-saving operations
const saveOperationsLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === "production" ? 30 : 100, // 30 saves per 5 min in production
  message: { error: "Too many save operations. Please wait a moment before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
});

app.use("/api", generalRateLimit);
// Apply stricter limits to save/update operations
app.use(["/api/profiles", "/api/jobs", "/api/applications"], saveOperationsLimit);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// CORS configuration to allow Authorization header
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            process.env.REPLIT_DEV_DOMAIN || "",
            "https://*.replit.app",
            "https://*.replit.dev",
          ].filter(Boolean)
        : true, // Allow all origins in development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400, // 24 hours
  })
);

// Keep only one health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "EventLink",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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

      // Add sanitized response info (no PII exposure)
      if (capturedJsonResponse) {
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
  // Reconcile admin users on startup
  await reconcileAdminUsers();
  await seedProductionJobs();
  backfillSlugs().catch((err) => console.error("Slug backfill failed:", err));
  registerJobNotificationScheduler();

  // OG tag middleware for social media crawlers (must be before Vite catch-all)
  app.use(ogTagMiddleware);

  const { httpServer: server, wss } = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Server error:", err);
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
          await storage.closeExpiredJobs();
        } catch (err) {
          console.error("Periodic job expiry check failed:", err);
        }
      },
      60 * 60 * 1000
    );
  });
})();
