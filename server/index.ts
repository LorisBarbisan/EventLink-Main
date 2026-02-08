import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, type Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ogTagMiddleware } from "./api/middleware/ogTags";
import { reconcileAdminUsers } from "./api/utils/reconcile-admin-users";
import { sanitizeLogData } from "./api/utils/sanitize-log-data";
import { registerRoutes } from "./routes-modular";
import { log, serveStatic, setupVite } from "./vite";
dotenv.config();

const app = express();

// CRITICAL: Enable trust proxy for production deployment behind reverse proxy (Replit)
// This fixes rate limiting and IP detection issues in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // Trust first proxy (Replit's reverse proxy)
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
            "ws://localhost:*",
            "wss://localhost:*",
            "wss://*.replit.dev", // Replit dev domains
            "ws://*.replit.dev", // Replit dev domains (non-SSL)
            "wss://*.replit.app", // Replit production domains
            "wss://eventlink.one", // Custom production domain
            "ws://eventlink.one",
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

// HTTPS enforcement and additional security middleware in production
if (process.env.NODE_ENV === "production") {
  // HTTPS redirection
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });

  // Additional production security headers
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

app.use(express.json({ limit: "10mb" }));
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

  // OG tag middleware for social media crawlers (must be before Vite catch-all)
  app.use(ogTagMiddleware);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Server error:", err);
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on port ${port} (host: ${host})`);
  });
})();
