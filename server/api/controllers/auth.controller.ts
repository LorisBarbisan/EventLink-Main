import { insertUserSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { storage } from "../../storage";
import {
  blacklistToken,
  computeUserRole,
  generateJWTToken,
  getOrigin,
  isTokenBlacklisted,
  verifyJWTToken,
} from "../utils/auth.util";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/emailService";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "eventlink-secret-key";
const OAUTH_PENDING_SECRET = JWT_SECRET + "-oauth-pending";
const OAUTH_PENDING_EXPIRY = "10m";

function generatePendingOAuthToken(data: {
  email: string;
  first_name: string;
  last_name: string;
  auth_provider: string;
  provider_id: string;
  profile_photo_url: string;
}): string {
  return jwt.sign({ ...data, purpose: "oauth_pending_registration" }, OAUTH_PENDING_SECRET, {
    expiresIn: OAUTH_PENDING_EXPIRY,
  });
}

function verifyPendingOAuthToken(token: string): {
  email: string;
  first_name: string;
  last_name: string;
  auth_provider: string;
  provider_id: string;
  profile_photo_url: string;
} | null {
  try {
    const decoded = jwt.verify(token, OAUTH_PENDING_SECRET) as any;
    if (decoded.purpose !== "oauth_pending_registration") return null;
    return decoded;
  } catch {
    return null;
  }
}

// Google OAuth callback — manual token exchange bypassing passport-oauth2
export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      console.error("Google OAuth error from Google:", error);
      return res.redirect(
        `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return res.redirect(
        "/api/auth/oauth-error?error=server_error&error_description=No authorization code received"
      );
    }

    const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

    // Step 1: Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "https://eventlink.one/api/auth/google/callback",
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Google token exchange failed:", {
        status: tokenRes.status,
        error: tokenData.error,
        error_description: tokenData.error_description,
      });
      return res.redirect(
        `/api/auth/oauth-error?error=server_error&error_description=${encodeURIComponent(
          tokenData.error_description || "Token exchange failed"
        )}`
      );
    }

    const accessToken = tokenData.access_token;

    // Step 2: Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      console.error("Google userinfo fetch failed:", userInfoRes.status);
      return res.redirect(
        "/api/auth/oauth-error?error=server_error&error_description=Failed to fetch user info"
      );
    }

    const userInfo = await userInfoRes.json();
    console.log("Google userinfo received:", { sub: userInfo.sub, email: userInfo.email });

    const email = userInfo.email || "";
    if (!email) {
      return res.redirect(
        "/api/auth/oauth-error?error=access_denied&error_description=Email permission is required"
      );
    }

    const googleId = userInfo.sub;
    const firstName = userInfo.given_name || "";
    const lastName = userInfo.family_name || "";
    const picture = userInfo.picture || "";

    // Parse role from state
    let selectedRole: "freelancer" | "recruiter" = "freelancer";
    try {
      if (state) {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString());
        if (decoded.role === "recruiter" || decoded.role === "freelancer") {
          selectedRole = decoded.role;
        }
      }
    } catch {}

    // Step 3: Find or create user
    let user = await storage.getUserBySocialProvider("google", googleId);

    if (!user) {
      const emailUser = await storage.getUserByEmail(email);
      if (emailUser) {
        await storage.linkSocialProvider(emailUser.id, "google", googleId, picture);
        user = emailUser;
      } else {
        // New user — redirect to role selection with signed pending token
        const frontendUrl = getOrigin(req);
        const pendingToken = generatePendingOAuthToken({
          email,
          first_name: firstName,
          last_name: lastName,
          auth_provider: "google",
          provider_id: googleId,
          profile_photo_url: picture,
        });
        const redirectUrl = `${frontendUrl}/auth#needs_role=true&pending_token=${encodeURIComponent(pendingToken)}`;
        console.log("Google OAuth new user — redirecting to role selection:", { email });
        return res.redirect(redirectUrl);
      }
    }

    // Check if user is deactivated
    if (user.status === "deactivated") {
      return res.redirect(
        `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(
          "Your account has been deactivated. Please contact support."
        )}`
      );
    }

    // Existing user — generate JWT and redirect
    const userWithRole = computeUserRole(user);
    const jwtToken = generateJWTToken(userWithRole);

    await storage.updateUserLastLogin(user.id, "google");

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.warn("Session login warning (non-fatal):", loginErr.message);
      }
    });

    console.log("Google OAuth successful login:", {
      id: user.id,
      email: user.email,
      role: userWithRole.role,
    });

    const frontendUrl = getOrigin(req);
    const redirectUrl = `${frontendUrl}/auth#oauth_success=true&token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(
      JSON.stringify({
        id: userWithRole.id,
        email: userWithRole.email,
        first_name: userWithRole.first_name,
        last_name: userWithRole.last_name,
        role: userWithRole.role,
        email_verified: userWithRole.email_verified,
        auth_provider: userWithRole.auth_provider || "email",
      })
    )}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth callback processing error:", error);
    return res.redirect(
      "/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed"
    );
  }
}

// Facebook OAuth callback
export function handleFacebookCallback(req: Request, res: Response, next: any) {
  passport.authenticate("facebook", async (err: any, user: any, info: any) => {
    try {
      if (err) {
        console.error("Facebook OAuth callback error:", err);
        return res.redirect(
          "/api/auth/oauth-error?error=server_error&error_description=Authentication failed"
        );
      }

      if (!user) {
        const error = info?.message || "Authentication failed";
        console.log("Facebook OAuth - No user returned:", info);
        return res.redirect(
          `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`
        );
      }

      // Check if user is deactivated
      if (user.status === "deactivated") {
        return res.redirect(
          `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(
            "Your account has been deactivated. Please contact support."
          )}`
        );
      }

      // Compute role
      const userWithRole = computeUserRole(user);

      // Generate JWT token for OAuth users
      const jwtToken = generateJWTToken(userWithRole);

      // Update last login
      await storage.updateUserLastLogin(user.id, "facebook");

      // Try to establish session (non-blocking — JWT is primary auth)
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.warn("Session login warning (non-fatal):", loginErr.message);
        }
      });

      console.log("Facebook OAuth successful login:", {
        id: user.id,
        email: user.email,
        role: userWithRole.role,
      });

      // Redirect to frontend with JWT token for storage
      const frontendUrl = getOrigin(req);

      const redirectUrl = `${frontendUrl}/auth#oauth_success=true&token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(
        JSON.stringify({
          id: userWithRole.id,
          email: userWithRole.email,
          first_name: userWithRole.first_name,
          last_name: userWithRole.last_name,
          role: userWithRole.role,
          email_verified: userWithRole.email_verified,
          auth_provider: userWithRole.auth_provider || "email",
        })
      )}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error("Facebook OAuth callback processing error:", error);
      return res.redirect(
        "/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed"
      );
    }
  })(req, res, next);
}

// Apple OAuth callback
export function handleAppleCallback(req: Request, res: Response, next: any) {
  passport.authenticate("apple", async (err: any, user: any, info: any) => {
    try {
      if (err) {
        console.error("Apple OAuth callback error:", err);
        return res.redirect(
          "/api/auth/oauth-error?error=server_error&error_description=Authentication failed"
        );
      }

      if (!user) {
        const error = info?.message || "Authentication failed";
        console.log("Apple OAuth - No user returned:", info);
        return res.redirect(
          `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`
        );
      }

      // Check if user is deactivated
      if (user.status === "deactivated") {
        return res.redirect(
          `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(
            "Your account has been deactivated. Please contact support."
          )}`
        );
      }

      // Compute role
      const userWithRole = computeUserRole(user);

      // Generate JWT token for OAuth users
      const jwtToken = generateJWTToken(userWithRole);

      // Update last login
      await storage.updateUserLastLogin(user.id, "apple");

      // Try to establish session (non-blocking — JWT is primary auth)
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.warn("Session login warning (non-fatal):", loginErr.message);
        }
      });

      console.log("Apple OAuth successful login:", {
        id: user.id,
        email: user.email,
        role: userWithRole.role,
      });

      // Redirect to frontend with JWT token for storage
      const frontendUrl = getOrigin(req);

      const redirectUrl = `${frontendUrl}/auth#oauth_success=true&token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(
        JSON.stringify({
          id: userWithRole.id,
          email: userWithRole.email,
          first_name: userWithRole.first_name,
          last_name: userWithRole.last_name,
          role: userWithRole.role,
          email_verified: userWithRole.email_verified,
          auth_provider: userWithRole.auth_provider || "email",
        })
      )}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error("Apple OAuth callback processing error:", error);
      return res.redirect(
        "/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed"
      );
    }
  })(req, res, next);
}

// LinkedIn OAuth callback
export function handleLinkedInCallback(req: Request, res: Response, next: any) {
  passport.authenticate("linkedin", async (err: any, user: any, info: any) => {
    try {
      if (err) {
        console.error("LinkedIn OAuth callback error:", err);
        return res.redirect(
          "/api/auth/oauth-error?error=server_error&error_description=Authentication failed"
        );
      }

      if (!user) {
        const error = info?.message || "Authentication failed";
        console.log("LinkedIn OAuth - No user returned:", info);
        return res.redirect(
          `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`
        );
      }

      // Check if this is a new user needing role selection
      if (user._isNewOAuthUser) {
        const frontendUrl = getOrigin(req);
        const pendingToken = generatePendingOAuthToken({
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          auth_provider: user.auth_provider,
          provider_id: user.provider_id,
          profile_photo_url: user.profile_photo_url,
        });
        const redirectUrl = `${frontendUrl}/auth#needs_role=true&pending_token=${encodeURIComponent(pendingToken)}`;
        console.log("LinkedIn OAuth new user — redirecting to role selection:", {
          email: user.email,
        });
        return res.redirect(redirectUrl);
      }

      // Check if user is deactivated
      if (user.status === "deactivated") {
        return res.redirect(
          `/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(
            "Your account has been deactivated. Please contact support."
          )}`
        );
      }

      // Existing user — generate JWT and redirect
      const userWithRole = computeUserRole(user);
      const jwtToken = generateJWTToken(userWithRole);

      await storage.updateUserLastLogin(user.id, "linkedin");

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.warn("Session login warning (non-fatal):", loginErr.message);
        }
      });

      console.log("LinkedIn OAuth successful login:", {
        id: user.id,
        email: user.email,
        role: userWithRole.role,
      });

      const frontendUrl = getOrigin(req);
      const redirectUrl = `${frontendUrl}/auth#oauth_success=true&token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(
        JSON.stringify({
          id: userWithRole.id,
          email: userWithRole.email,
          first_name: userWithRole.first_name,
          last_name: userWithRole.last_name,
          role: userWithRole.role,
          email_verified: userWithRole.email_verified,
          auth_provider: userWithRole.auth_provider || "email",
        })
      )}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error("LinkedIn OAuth callback processing error:", error);
      return res.redirect(
        "/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed"
      );
    }
  })(req, res, next);
}

// Complete OAuth registration with chosen role (for new users)
// Security: Requires a signed pending_token generated server-side during OAuth callback
export async function completeOAuthRegistration(req: Request, res: Response) {
  try {
    const { pending_token, role } = req.body;

    if (!pending_token) {
      return res.status(400).json({ error: "Missing pending token" });
    }

    if (role !== "freelancer" && role !== "recruiter") {
      return res.status(400).json({ error: "Invalid role. Must be 'freelancer' or 'recruiter'" });
    }

    // Verify the server-signed pending OAuth token
    const oauthData = verifyPendingOAuthToken(pending_token);
    if (!oauthData) {
      return res
        .status(401)
        .json({ error: "Invalid or expired registration token. Please sign in again." });
    }

    const { email, first_name, last_name, auth_provider, provider_id, profile_photo_url } =
      oauthData;

    if (!["google", "linkedin", "facebook"].includes(auth_provider)) {
      return res.status(400).json({ error: "Invalid auth provider" });
    }

    // Check if user already exists (race condition guard)
    const existingUser = await storage.getUserBySocialProvider(auth_provider as any, provider_id);
    if (existingUser) {
      if (existingUser.status === "deactivated") {
        return res
          .status(403)
          .json({ error: "Your account has been deactivated. Please contact support." });
      }
      const userWithRole = computeUserRole(existingUser);
      const jwtToken = generateJWTToken(userWithRole);
      return res.json({
        token: jwtToken,
        user: {
          id: userWithRole.id,
          email: userWithRole.email,
          first_name: userWithRole.first_name,
          last_name: userWithRole.last_name,
          role: userWithRole.role,
          email_verified: userWithRole.email_verified,
          auth_provider: userWithRole.auth_provider || "email",
        },
      });
    }

    const existingEmailUser = await storage.getUserByEmail(email);
    if (existingEmailUser) {
      if (existingEmailUser.status === "deactivated") {
        return res
          .status(403)
          .json({ error: "Your account has been deactivated. Please contact support." });
      }
      await storage.linkSocialProvider(
        existingEmailUser.id,
        auth_provider as any,
        provider_id,
        profile_photo_url
      );
      await storage.updateUserLastLogin(existingEmailUser.id, auth_provider as any);
      const userWithRole = computeUserRole(existingEmailUser);
      const jwtToken = generateJWTToken(userWithRole);
      return res.json({
        token: jwtToken,
        user: {
          id: userWithRole.id,
          email: userWithRole.email,
          first_name: userWithRole.first_name,
          last_name: userWithRole.last_name,
          role: userWithRole.role,
          email_verified: userWithRole.email_verified,
          auth_provider: userWithRole.auth_provider || "email",
        },
      });
    }

    const providerIdField =
      auth_provider === "google"
        ? "google_id"
        : auth_provider === "linkedin"
          ? "linkedin_id"
          : "facebook_id";

    const newUser = await storage.createSocialUser({
      email,
      first_name,
      last_name,
      auth_provider: auth_provider as any,
      [providerIdField]: provider_id,
      profile_photo_url,
      email_verified: true,
      role,
    });

    await storage.updateUserLastLogin(newUser.id, auth_provider as any);

    const userWithRole = computeUserRole(newUser);
    const jwtToken = generateJWTToken(userWithRole);

    console.log("OAuth registration completed:", {
      id: newUser.id,
      email: newUser.email,
      role: userWithRole.role,
      provider: auth_provider,
    });

    return res.json({
      token: jwtToken,
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        first_name: userWithRole.first_name,
        last_name: userWithRole.last_name,
        role: userWithRole.role,
        email_verified: userWithRole.email_verified,
        auth_provider: userWithRole.auth_provider || "email",
      },
    });
  } catch (error) {
    console.error("OAuth registration error:", error);
    return res.status(500).json({ error: "Registration failed" });
  }
}

// Get current user session (JWT-based)
export async function getSession(req: Request, res: Response) {
  try {
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Use local JWT utilities (duplicated from auth.ts)

    // CRITICAL FIX: Check if token is blacklisted (logged out)
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    // Verify JWT token
    const decoded = verifyJWTToken(token);
    if (!decoded || typeof decoded !== "object") {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get fresh user data from database
    const user = await storage.getUser((decoded as any).id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Apply role computation to fresh user data
    const userWithRole = computeUserRole(user);

    res.json({
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        first_name: userWithRole.first_name,
        last_name: userWithRole.last_name,
        role: userWithRole.role,
        email_verified: userWithRole.email_verified,
        auth_provider: userWithRole.auth_provider || "email",
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// User signup endpoint
export async function signup(req: Request, res: Response) {
  try {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues,
      });
    }

    const { email, password, first_name, last_name, role } = result.data;

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Hash password (optimized for performance)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const emailVerificationToken = randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with verification token
    const user = await storage.createUser({
      email,
      password: hashedPassword,
      first_name,
      last_name,
      role: role || "freelancer",
      email_verification_token: emailVerificationToken,
      email_verification_expires: emailVerificationExpires,
    });

    // Send verification email
    try {
      const baseUrl = getOrigin(req);
      await sendVerificationEmail(email, emailVerificationToken, baseUrl);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail signup if email fails
    }

    // Apply role computation
    const userWithRole = computeUserRole(user);

    res.status(201).json({
      message: "User created successfully. Please check your email to verify your account.",
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        first_name: userWithRole.first_name,
        last_name: userWithRole.last_name,
        role: userWithRole.role,
        email_verified: userWithRole.email_verified,
        auth_provider: userWithRole.auth_provider || "email",
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// User signin endpoint
export async function signin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if user is deactivated
    if (user.status === "deactivated") {
      return res.status(403).json({
        error: "Your account has been deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    // Check if user has a password (not a social auth user)
    if (!user.password) {
      return res.status(400).json({
        error: "This account uses social login. Please sign in with your social provider.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password!);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: "Please verify your email address before signing in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // Apply role computation
    const userWithRole = computeUserRole(user);

    // Generate JWT token instead of session
    const token = generateJWTToken(userWithRole);

    // Update last login
    await storage.updateUserLastLogin(user.id, "email");

    res.json({
      message: "Sign in successful",
      token: token,
      user: {
        id: (userWithRole as any).id,
        email: (userWithRole as any).email,
        first_name: (userWithRole as any).first_name,
        last_name: (userWithRole as any).last_name,
        role: (userWithRole as any).role,
        email_verified: (userWithRole as any).email_verified,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Resend verification email endpoint
export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Generate new verification token
    const emailVerificationToken = randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    await storage.updateUserVerificationToken(
      user.id,
      emailVerificationToken,
      emailVerificationExpires
    );

    // Send verification email
    try {
      const baseUrl = getOrigin(req);
      await sendVerificationEmail(email, emailVerificationToken, baseUrl);
      console.log(`✅ Resent verification email to: ${email}`);

      res.json({
        message: "Verification email resent successfully. Please check your email and spam folder.",
        success: true,
      });
    } catch (emailError) {
      console.error("Failed to resend verification email:", emailError);
      res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    }
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Email verification endpoint
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      // Redirect to frontend with error
      const frontendUrl = getOrigin(req);
      return res.redirect(
        `${frontendUrl}/auth?error=${encodeURIComponent("Invalid verification token")}`
      );
    }

    const verified = await storage.verifyEmail(token);

    const frontendUrl = getOrigin(req);

    if (verified) {
      res.redirect(`${frontendUrl}/auth?verified=true`);
    } else {
      res.redirect(
        `${frontendUrl}/auth?error=${encodeURIComponent("Invalid or expired verification token")}`
      );
    }
  } catch (error) {
    console.error("Email verification error:", error);
    const frontendUrl = getOrigin(req);
    res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent("Verification failed")}`);
  }
}

// Sign out endpoint - FIXED for JWT blacklisting
export function signout(req: Request, res: Response) {
  try {
    // Use local blacklistToken (duplicated from auth.ts)

    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (token) {
      // Add token to blacklist to invalidate it immediately
      blacklistToken(token);
      console.log("✅ JWT token blacklisted on signout");
    }

    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to sign out" });
      }

      (req as any).session.destroy((sessionErr: any) => {
        if (sessionErr) {
          console.error("Session destruction error:", sessionErr);
          return res.status(500).json({ error: "Failed to destroy session" });
        }

        res.clearCookie("eventlink.sid");
        res.json({ message: "Signed out successfully" });
      });
    });
  } catch (error) {
    console.error("Signout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Forgot password endpoint
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to user
    const tokenSaved = await storage.setPasswordResetToken(email, resetToken, resetTokenExpires);
    if (!tokenSaved) {
      return res.status(500).json({ error: "Failed to generate reset token" });
    }

    // Send password reset email
    try {
      const baseUrl =
        process.env.NODE_ENV === "production"
          ? `https://${req.get("host")}`
          : `http://localhost:3000`;
      await sendPasswordResetEmail(email, resetToken, baseUrl, user.first_name);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      return res.status(500).json({ error: "Failed to send reset email" });
    }

    res.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Reset password endpoint
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    // Validate reset token
    const tokenValidation = await storage.validatePasswordResetToken(token);
    if (!tokenValidation.isValid || !tokenValidation.userId) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash new password (optimized for performance)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user password and clear reset token
    const resetSuccessful = await storage.resetPassword(tokenValidation.userId, hashedPassword);
    if (!resetSuccessful) {
      return res.status(500).json({ error: "Failed to reset password" });
    }

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Change password endpoint (authenticated)
export async function changePassword(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long" });
    }

    const user = await storage.getUser((req as any).user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    if (!user.password) {
      return res.status(400).json({ error: "Account does not have a password set" });
    }
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password (optimized for performance)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await storage.updateUserPassword(user.id, hashedPassword);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update account information endpoint (authenticated)
export async function updateAccount(req: Request, res: Response) {
  try {
    const { first_name, last_name, role } = req.body;
    const user = (req as any).user;

    await storage.updateUserAccount(user.id, {
      first_name,
      last_name,
      role,
    });

    // Get updated user and apply role computation
    const updatedUser = await storage.getUser(user.id);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const userWithRole = computeUserRole(updatedUser);

    res.json({
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        first_name: userWithRole.first_name,
        last_name: userWithRole.last_name,
        role: userWithRole.role,
        email_verified: userWithRole.email_verified,
        auth_provider: userWithRole.auth_provider || "email",
      },
    });
  } catch (error) {
    console.error("Update account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Delete account endpoint (authenticated)
export async function deleteAccount(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { password, confirmPhrase } = req.body;

    const user = await storage.getUser((req as any).user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isOAuthUser = user.auth_provider && user.auth_provider !== "email" && !user.password;

    if (isOAuthUser) {
      if (confirmPhrase !== "DELETE") {
        return res.status(400).json({ error: "Please type DELETE to confirm account deletion" });
      }
    } else {
      if (!password) {
        return res.status(400).json({ error: "Password is required to delete account" });
      }
      if (!user.password) {
        return res.status(400).json({ error: "Account has no password set" });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Incorrect password" });
      }
    }

    // Delete only the current user's data
    await storage.deleteUserAccount(user.id);

    // Destroy session
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error during account deletion:", err);
      }

      (req as any).session.destroy((sessionErr: any) => {
        if (sessionErr) {
          console.error("Session destruction error during account deletion:", sessionErr);
        }

        res.clearCookie("eventlink.sid");
        res.json({ message: "Account deleted successfully" });
      });
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Admin diagnostics endpoint
export async function getAdminDiagnostics(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if user is admin
    const userWithRole = computeUserRole((req as any).user);
    if (userWithRole.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((email)

// Admin diagnostics endpoint
export async function getAdminDiagnostics(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if user is admin
    const userWithRole = computeUserRole((req as any).user);
    if (userWithRole.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase())
      : [];

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      adminEmails: adminEmails,
      currentUser: {
        id: userWithRole.id,
        email: userWithRole.email,
        role: userWithRole.role,
        is_admin: userWithRole.is_admin,
      },
      databaseUrl: process.env.DATABASE_URL ? "configured" : "missing",
      nuclearCleanupAllowed: process.env.ALLOW_NUCLEAR_CLEANUP === "true",
    };

    res.json(diagnostics);
  } catch (error) {
    console.error("Diagnostics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
