  import { Request, Response } from "express";
  import { storage } from "server/storage";
  import { computeUserRole, getOrigin, isTokenBlacklisted, verifyJWTToken } from "../utils/auth.util";

  // JWT Authentication Middleware
  export const authenticateJWT = async (req: any, res: any, next: any) => {
    try {
      // Check for JWT token in Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if token is blacklisted (logged out)
      if (isTokenBlacklisted(token)) {
        return res.status(401).json({ error: "Token has been invalidated" });
      }

      // Verify JWT token
      const decoded = verifyJWTToken(token);
      if (!decoded || typeof decoded !== "object") {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Get fresh user data from database and populate req.user
      const user = await storage.getUser((decoded as any).id);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Apply role computation and set req.user
      req.user = computeUserRole(user);
      next();
    } catch (error) {
      console.error("JWT authentication error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  };

  // Optional JWT Authentication Middleware
  // Does not return 401 if token is missing
  export const authenticateOptionalJWT = async (req: any, res: any, next: any) => {
    try {
      // Check for JWT token in Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

      if (!token) {
        // No token, proceed without user (guest mode)
        return next();
      }

      // Check if token is blacklisted (logged out)
      if (isTokenBlacklisted(token)) {
        // If token is provided but invalid, we should probably ignore it or return error.
        // Returning error is safer to avoid confusion (client thinks they are logged in but server treats as guest)
        return res.status(401).json({ error: "Token has been invalidated" });
      }

      // Verify JWT token
      const decoded = verifyJWTToken(token);
      if (!decoded || typeof decoded !== "object") {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Get fresh user data from database and populate req.user
      const user = await storage.getUser((decoded as any).id);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Apply role computation and set req.user
      req.user = computeUserRole(user);
      next();
    } catch (error) {
      console.error("Optional JWT authentication error:", error);
      // In optional auth, if technical error occurs during auth check,
      // we can either fail or proceed as guest. Failing is safer to detect issues.
      res.status(500).json({ error: "Authentication check failed" });
    }
  };

  // OAuth configuration endpoint
  export function getOAuthConfig(req: Request, res: Response) {
    res.json({
      google: {
        enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        clientId: process.env.GOOGLE_CLIENT_ID,
      },
      facebook: {
        enabled: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        appId: process.env.FACEBOOK_APP_ID,
      },
      apple: {
        enabled: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
        clientId: process.env.APPLE_CLIENT_ID,
      },
      linkedin: {
        enabled: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
        clientId: process.env.LINKEDIN_CLIENT_ID,
      },
    });
  }

  // OAuth error handling for scope denial and token issues
  export function handleOAuthError(req: Request, res: Response) {
    const error = req.query.error as string;
    const errorDescription = req.query.error_description as string;

    console.log("OAuth Error Details:", { error, errorDescription });

    let userMessage = "Authentication failed. Please try again.";
    let details = "";

    if (error === "access_denied") {
      userMessage = "Access was denied. You need to allow access to continue.";
      details = "Please grant the necessary permissions and try again.";
    } else if (error === "invalid_scope") {
      userMessage = "Invalid permissions requested.";
      details = "The authentication request included invalid permissions.";
    } else if (error === "server_error") {
      userMessage = "Server error occurred during authentication.";
      details = "Please try again later or contact support if the issue persists.";
    }

    // Return JSON response for API calls
    if (req.headers.accept?.includes("application/json")) {
      return res.status(400).json({
        error: userMessage,
        details: details,
        code: error,
      });
    }

    // For web requests, redirect to frontend with error info
    const redirectUrl = `${getOrigin(req)}/auth?error=${encodeURIComponent(userMessage)}&details=${encodeURIComponent(details)}`;

    res.redirect(redirectUrl);
  }
