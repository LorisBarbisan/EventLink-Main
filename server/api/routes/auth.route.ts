import type { Express } from "express";
import rateLimit from "express-rate-limit";
import passport from "passport";
import {
  changePassword,
  deleteAccount,
  forgotPassword,
  getAdminDiagnostics,
  getSession,
  handleAppleCallback,
  handleFacebookCallback,
  handleGoogleCallback,
  handleLinkedInCallback,
  resendVerification,
  resetPassword,
  signin,
  signout,
  signup,
  updateAccount,
  verifyEmail,
} from "../controllers/auth.controller";
import { authenticateJWT, getOAuthConfig, handleOAuthError } from "../middleware/auth.middleware";
import { sanitizeAuthInput } from "../middleware/sanitize-auth.middleware";

export function registerAuthRoutes(app: Express) {
  // Reasonable rate limiting for password operations
  const passwordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes (aligned with general rate limiter)
    max: 10, // 10 password attempts per 15 minutes
    message: { error: "Too many password attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
  });

  // Apply strict rate limiting to sensitive routes
  app.use("/api/auth/signin", passwordRateLimit);
  app.use("/api/auth/forgot-password", passwordRateLimit);
  app.use("/api/auth/reset-password", passwordRateLimit);

  // Apply input sanitization
  app.use("/api/auth", sanitizeAuthInput);

  // OAuth error handling for scope denial and token issues
  app.get("/api/auth/oauth-error", handleOAuthError);

  // OAuth configuration endpoint
  app.get("/api/oauth-config", getOAuthConfig);

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    const role = req.query.role as string;
    const state = role ? Buffer.from(JSON.stringify({ role })).toString("base64") : undefined;
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", handleGoogleCallback);

  // Facebook OAuth routes
  app.get(
    "/api/auth/facebook",
    passport.authenticate("facebook", {
      scope: ["email", "public_profile"],
    })
  );

  app.get("/api/auth/facebook/callback", handleFacebookCallback);

  // Apple OAuth routes
  app.get("/api/auth/apple", passport.authenticate("apple"));

  app.post("/api/auth/apple/callback", handleAppleCallback);

  // LinkedIn OAuth routes
  app.get("/api/auth/linkedin", (req, res, next) => {
    const role = req.query.role as string;
    const state = role ? Buffer.from(JSON.stringify({ role })).toString("base64") : undefined;
    passport.authenticate("linkedin", {
      scope: ["r_liteprofile", "r_emailaddress"],
      state,
    })(req, res, next);
  });

  app.get("/api/auth/linkedin/callback", handleLinkedInCallback);

  // Get current user session (JWT-based)
  app.get("/api/auth/session", getSession);

  // User signup endpoint
  app.post("/api/auth/signup", signup);

  // User signin endpoint
  app.post("/api/auth/signin", signin);

  // Resend verification email endpoint
  app.post("/api/auth/resend-verification", resendVerification);

  // Email verification endpoint
  app.get("/verify-email", verifyEmail);

  // Sign out endpoint - FIXED for JWT blacklisting
  app.post("/api/auth/signout", signout);

  // Forgot password endpoint
  app.post("/api/auth/forgot-password", forgotPassword);

  // Reset password endpoint
  app.post("/api/auth/reset-password", resetPassword);

  // Change password endpoint (authenticated)
  app.put("/api/auth/change-password", authenticateJWT, changePassword);

  // Update account information endpoint (authenticated)
  app.put("/api/auth/update-account", authenticateJWT, updateAccount);

  // Delete account endpoint (authenticated)
  app.delete("/api/auth/delete-account", authenticateJWT, deleteAccount);

  // Admin diagnostics endpoint
  app.get("/api/admin/diagnostics", getAdminDiagnostics);
}
