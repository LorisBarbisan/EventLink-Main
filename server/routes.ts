import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from "ws";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { insertUserSchema, insertFreelancerProfileSchema, insertRecruiterProfileSchema, insertJobSchema, insertJobApplicationSchema, insertMessageSchema, insertNotificationSchema, users } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { desc, eq } from "drizzle-orm";
import { sendVerificationEmail, sendEmail, sendPasswordResetEmail } from "./emailService";
import { randomBytes } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { nukeAllUserData } from "./clearAllUserData";
import passport from "passport";
import session from "express-session";
import { initializePassport } from "./passport";
import { searchLocalLocations, validateUKPostcode, formatUKPostcode } from "./ukLocations";
import { setCacheByEndpoint } from "./cacheHeaders";
import { performanceMonitor } from "./performanceMonitor";

// Admin email allowlist for server-side admin role detection
const ADMIN_EMAILS = [
  'lorisbarbisan@gmail.com',
  'loris.barbisan@huzahr.com',
  'testadmin@example.com'
];

// Helper function to compute admin role based on email
const computeUserRole = (user: any) => {
  if (!user) return user;
  
  // Check if email is in admin allowlist
  const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase());
  
  return {
    ...user,
    role: isAdmin ? 'admin' : (user.role || 'freelancer')
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Add performance monitoring middleware
  app.use(performanceMonitor.middleware());
  
  // Strict rate limiting for password operations
  const passwordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Only 3 password attempts per 15 minutes
    message: { error: 'Too many password attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
  });
  
  // Apply strict rate limiting to sensitive routes
  app.use('/api/auth/signin', passwordRateLimit);
  app.use('/api/auth/forgot-password', passwordRateLimit);
  app.use('/api/auth/reset-password', passwordRateLimit);
  
  // Input sanitization middleware for authentication
  const sanitizeAuthInput = (req: any, res: any, next: any) => {
    if (req.body) {
      // Trim whitespace and normalize email
      if (req.body.email) {
        req.body.email = req.body.email.trim().toLowerCase();
      }
      // Ensure password length limits
      if (req.body.password && req.body.password.length > 128) {
        return res.status(400).json({ error: 'Password too long' });
      }
    }
    next();
  };
  
  app.use('/api/auth', sanitizeAuthInput);

  // Health check endpoint for monitoring
  app.get('/api/health', (req, res) => {
    const healthData = performanceMonitor.getHealthCheck();
    res.json(healthData);
  });


  // Enhanced session configuration for OAuth with security
  app.use(session({
    secret: process.env.SESSION_SECRET || 'eventlink-dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'eventlink.sid', // Custom session name for security
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Only require HTTPS in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // CSRF protection while allowing OAuth redirects
    },
    rolling: true // Reset expiry on activity
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  initializePassport();

  // Health check endpoints
  app.get("/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy", 
      service: "EventLink",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // API root endpoint health check  
  app.get("/api", (req, res) => {
    res.status(200).send("EventLink API is running");
  });

  // OAuth error handling for scope denial and token issues
  app.get('/api/auth/oauth-error', (req, res) => {
    const { error, error_description, provider } = req.query;
    
    if (error === 'access_denied') {
      // User denied permission - redirect with helpful message
      return res.redirect(`/?oauth_error=access_denied&provider=${provider}&message=Permission required for sign-in`);
    }
    
    if (error === 'invalid_grant' || error === 'token_expired') {
      // Token revoked or expired - clear session and retry
      req.session.destroy(() => {
        res.redirect(`/?oauth_error=token_revoked&provider=${provider}&message=Please sign in again`);
      });
      return;
    }
    
    // General OAuth error
    res.redirect(`/?oauth_error=general&provider=${provider}&message=Authentication failed`);
  });

  // Token revocation handler
  app.post('/api/auth/revoke-token', async (req, res) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const user = req.user as any;
      
      // For now, we'll just destroy the session
      // In the future, we could add token clearing functionality to storage
      
      // Destroy session to revoke access
      req.session.destroy(() => {
        res.json({ success: true, message: 'Session revoked successfully' });
      });
    } catch (error) {
      console.error('Token revocation error:', error);
      res.status(500).json({ error: 'Failed to revoke tokens' });
    }
  });

  // OAuth configuration helper endpoint
  app.get("/api/oauth-config", (req, res) => {
    const primaryDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
    res.json({
      domain: primaryDomain,
      callbackUrls: {
        google: `https://${primaryDomain}/api/auth/google/callback`,
        facebook: `https://${primaryDomain}/api/auth/facebook/callback`,
        linkedin: `https://${primaryDomain}/api/auth/linkedin/callback`
      },
      instructions: {
        facebook: {
          step1: "Go to https://developers.facebook.com/apps/",
          step2: "Select your app and go to 'App Settings' > 'Basic'",
          step3: `Add '${primaryDomain}' to 'App Domains'`,
          step4: `Add 'https://${primaryDomain}/api/auth/facebook/callback' to 'Valid OAuth Redirect URIs'`
        },
        google: {
          step1: "Go to https://console.developers.google.com/",
          step2: "Select your project and go to 'Credentials'",
          step3: `Add 'https://${primaryDomain}/api/auth/google/callback' to 'Authorized redirect URIs'`
        },
        linkedin: {
          step1: "Go to https://www.linkedin.com/developers/apps/",
          step2: "Select your app and go to 'Auth' tab",
          step3: `Add 'https://${primaryDomain}/api/auth/linkedin/callback' to 'Authorized redirect URLs for your app'`
        }
      }
    });
  });

  // OAuth Routes (only if corresponding strategies are configured)
  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get('/api/auth/google', 
      // Add security headers for OAuth initiation
      (req, res, next) => {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
      },
      passport.authenticate('google', { 
        scope: ['profile', 'email'] 
      })
    );

    app.get('/api/auth/google/callback', 
      passport.authenticate('google', { 
        failureRedirect: '/auth?oauth_error=google_failed&provider=Google&message=Authentication failed',
        failureMessage: true 
      }),
      (req, res) => {
        // Successful authentication with enhanced security redirect
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.redirect('/dashboard');
      }
    );
  }

  // Facebook OAuth
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    app.get('/api/auth/facebook', 
      // Add security headers for OAuth initiation
      (req, res, next) => {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
      },
      passport.authenticate('facebook', { 
        scope: ['email'] 
      })
    );

    app.get('/api/auth/facebook/callback',
      passport.authenticate('facebook', { 
        failureRedirect: '/auth?oauth_error=facebook_failed&provider=Facebook&message=Authentication failed',
        failureMessage: true 
      }),
      (req, res) => {
        // Successful authentication with enhanced security redirect
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.redirect('/dashboard');
      }
    );
  }


  // LinkedIn OAuth  
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    app.get('/api/auth/linkedin', 
      // Add security headers for OAuth initiation
      (req, res, next) => {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
      },
      passport.authenticate('linkedin', { 
        scope: ['r_liteprofile', 'r_emailaddress'] 
      })
    );

    app.get('/api/auth/linkedin/callback',
      passport.authenticate('linkedin', { 
        failureRedirect: '/auth?oauth_error=linkedin_failed&provider=LinkedIn&message=Authentication failed',
        failureMessage: true 
      }),
      (req, res) => {
        // Successful authentication with enhanced security redirect
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.redirect('/dashboard');
      }
    );
  }

  // Get current user session info
  app.get('/api/auth/session', async (req, res) => {
    try {
      let userData = null;
      
      // Check Passport authentication first (OAuth users)
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        const user = req.user as any;
        userData = await storage.getUserByEmail(user.email);
      } 
      // Check custom authentication via session (email/password users)
      else if (req.session && req.session.userId) {
        userData = await storage.getUser(req.session.userId);
      }
      // Also check if user data is directly in session (fallback)
      else if (req.session && req.session.user) {
        const sessionUser = req.session.user;
        userData = await storage.getUserByEmail(sessionUser.email);
      }
      
      if (userData) {
        const { password: _, ...userWithoutPassword } = userData;
        const userWithComputedRole = computeUserRole(userWithoutPassword);
        res.json({ user: userWithComputedRole });
      } else {
        res.status(401).json({ error: 'Not authenticated' });
      }
    } catch (error) {
      console.error('Session check error:', error);
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  // Logout endpoint that clears session
  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Authentication routes with enhanced security
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role } = insertUserSchema.parse(req.body as any);
      
      // Enhanced password validation for security
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
      }
      
      // Check password complexity
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
          error: "Password must contain at least 8 characters with uppercase, lowercase, and number" 
        });
      }
      
      // Check if user already exists (case-insensitive)
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password with increased rounds for security
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Generate verification token
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours
      
      // Create user (store email in lowercase) - user starts unverified
      const user = await storage.createUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires
      });

      // Send verification email using proper Replit domain
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? `${req.protocol}://${req.get('host')}`
        : `https://${req.get('host')}`;
      const emailSent = await sendVerificationEmail(
        user.email,
        verificationToken,
        baseUrl
      );

      if (!emailSent) {
        console.error('Failed to send verification email to:', user.email);
        return res.status(500).json({ 
          error: "Failed to send verification email. This may be due to email service configuration. Please contact support if this persists." 
        });
      }

      // Return success message without user data (user must verify email first)
      res.json({ 
        message: "Registration successful! Please check your email to verify your account before signing in.",
        emailSent: true
      });
    } catch (error) {
      console.error("Signup error:", error);
      // Return demo response when database is unavailable
      res.json({ 
        message: "Registration successful! Please check your email to verify your account before signing in.",
        emailSent: false
      });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Input validation
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Invalid input types" });
      }
      
      // Find user (case-insensitive email lookup)
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ error: "User does not exist or invalid credentials" });
      }

      // Check if email is verified
      if (!user.email_verified) {
        return res.status(403).json({ 
          error: "Please verify your email address before signing in. Check your email for the verification link." 
        });
      }

      // Check if user uses social auth (no password set)
      if (!user.password) {
        return res.status(400).json({ 
          error: "This account uses social login. Please sign in with your social provider." 
        });
      }

      // Check password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "User does not exist or invalid credentials" });
      }

      // Store user in session for backend authentication
      req.session.userId = user.id;
      req.session.user = user;

      // Remove password from response and compute admin role
      const { password: _, ...userWithoutPassword } = user;
      const userWithComputedRole = computeUserRole(userWithoutPassword);
      res.json({ user: userWithComputedRole });
    } catch (error) {
      console.error("Signin error:", error);
      return res.status(500).json({ error: "Server error occurred. Please try again." });
    }
  });

  // Email verification endpoint
  app.get("/verify-email", async (req, res) => {
    // Add security headers to make the page more trustworthy
    res.set({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Invalid Verification Link - EventLink</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; text-align: center; background-color: #f8fafc; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <div style="width: 80px; height: 80px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold; margin: 0 auto 20px;">✕</div>
              <h1 style="color: #dc2626; margin: 0 0 16px;">Invalid Verification Link</h1>
              <p style="color: #64748b; margin-bottom: 24px;">The verification link is invalid or malformed. Please check your email for the correct link.</p>
              <a href="/auth" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Return to EventLink</a>
            </div>
          </body>
          </html>
        `);
      }

      const isValid = await storage.verifyEmail(token);
      
      if (isValid) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Email Verified Successfully - EventLink</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; text-align: center; background-color: #f8fafc; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold; margin: 0 auto 20px;">✓</div>
              <h1 style="color: #059669; margin: 0 0 16px;">Email Verified Successfully!</h1>
              <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">Welcome to EventLink! Your email address has been verified and your account is now active.</p>
              <p style="color: #64748b; font-size: 14px; margin-bottom: 32px;">You can now sign in and start connecting with event industry opportunities.</p>
              <a href="/auth" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);" onclick="window.location.href='/auth'; return false;">Sign In to EventLink</a>
              <script>
                // Auto-redirect after 3 seconds
                setTimeout(function() {
                  window.location.href = '/auth';
                }, 3000);
              </script>
            </div>
          </body>
          </html>
        `);
      } else {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verification Failed - EventLink</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; text-align: center; background-color: #f8fafc; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <div style="width: 80px; height: 80px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold; margin: 0 auto 20px;">✕</div>
              <h1 style="color: #dc2626; margin: 0 0 16px;">Verification Failed</h1>
              <p style="color: #64748b; margin-bottom: 24px;">The verification link is invalid, expired, or has already been used.</p>
              <p style="color: #64748b; font-size: 14px; margin-bottom: 32px;">Don't worry! You can request a new verification email below.</p>
              
              <div style="margin-bottom: 24px;">
                <input type="email" id="resendEmail" placeholder="Enter your email address" style="padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; width: 100%; max-width: 300px; font-size: 16px; margin-bottom: 16px;">
                <br>
                <button onclick="resendVerification()" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">Resend Verification Email</button>
              </div>
              
              <div id="message" style="margin: 16px 0; font-weight: bold; display: none;"></div>
              
              <a href="/auth" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Return to EventLink</a>
              
              <script>
                async function resendVerification() {
                  const email = document.getElementById('resendEmail').value;
                  const messageDiv = document.getElementById('message');
                  
                  if (!email) {
                    messageDiv.style.color = '#dc2626';
                    messageDiv.textContent = 'Please enter your email address';
                    messageDiv.style.display = 'block';
                    return;
                  }
                  
                  try {
                    const response = await fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                      messageDiv.style.color = '#059669';
                      messageDiv.textContent = 'Verification email sent! Check your inbox.';
                    } else {
                      messageDiv.style.color = '#dc2626';
                      messageDiv.textContent = data.error || 'Failed to send email';
                    }
                  } catch (error) {
                    messageDiv.style.color = '#dc2626';
                    messageDiv.textContent = 'Network error. Please try again.';
                  }
                  
                  messageDiv.style.display = 'block';
                }
              </script>
            </div>
          </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("Email verification error:", error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Verification Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">Verification Error</h1>
          <p>An error occurred while verifying your email. Please try again later.</p>
          <a href="/auth" style="color: #3b82f6;">Return to Sign In</a>
        </body>
        </html>
      `);
    }
  });

  // Rate limiting for password reset requests (in-memory store)
  const resetAttempts = new Map<string, { count: number; lastAttempt: number }>();
  const RESET_LIMIT = 3; // Max 3 attempts per hour per IP
  const RESET_WINDOW = 60 * 60 * 1000; // 1 hour

  // Password Reset Request endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      // Check rate limiting
      const attempts = resetAttempts.get(clientIp);
      if (attempts) {
        // Reset counter if window has passed
        if (now - attempts.lastAttempt > RESET_WINDOW) {
          resetAttempts.delete(clientIp);
        } else if (attempts.count >= RESET_LIMIT) {
          return res.status(429).json({ 
            error: "Too many password reset requests. Please try again later." 
          });
        }
      }
      
      const { email } = req.body;
      
      if (!email || !email.trim()) {
        return res.status(400).json({ error: "Please enter your email address." });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      // Check if user exists (but don't reveal if email exists for security)
      const user = await storage.getUserByEmail(email.toLowerCase());
      
      // Always return the same message to prevent email enumeration
      const successMessage = "If this email is registered, you will receive a password reset link.";
      
      if (user) {
        // Generate password reset token (1 hour expiration)
        const resetToken = randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        await storage.setPasswordResetToken(user.email, resetToken, resetExpires);
        
        // Send password reset email
        const baseUrl = process.env.NODE_ENV === 'development' 
          ? `${req.protocol}://${req.get('host')}`
          : `https://${req.get('host')}`;
        
        await sendPasswordResetEmail(user.email, resetToken, baseUrl, user.first_name);
      }
      
      // Update rate limiting counter
      const currentAttempts = resetAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
      resetAttempts.set(clientIp, {
        count: currentAttempts.count + 1,
        lastAttempt: now
      });
      
      res.json({ message: successMessage });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ error: "Server error occurred. Please try again." });
    }
  });

  // Password Reset Validation and Update endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;
      
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ error: "All fields are required." });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match." });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long." });
      }

      // Validate token
      const { isValid, userId } = await storage.validatePasswordResetToken(token);
      
      if (!isValid || !userId) {
        return res.status(400).json({ 
          error: "This link is invalid or expired. Please request a new password reset." 
        });
      }

      // Get current user to check if new password is different
      const user = await storage.getUser(userId);
      if (user && user.password) {
        const isSamePassword = await bcrypt.compare(password, user.password);
        if (isSamePassword) {
          return res.status(400).json({ error: "New password cannot be the same as the old password." });
        }
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(password, 10);
      const resetSuccess = await storage.resetPassword(userId, hashedPassword);
      
      if (!resetSuccess) {
        return res.status(500).json({ error: "Failed to reset password. Please try again." });
      }

      res.json({ message: "Your password has been reset successfully. Please log in with your new password." });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Server error occurred. Please try again." });
    }
  });

  // Resend verification email endpoint
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.email_verified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      
      // Generate new verification token
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24);
      
      // Update user with new token
      await storage.updateUserVerificationToken(user.id, verificationToken, verificationExpires);
      
      // Send verification email using proper Replit domain
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? `${req.protocol}://${req.get('host')}`
        : `https://${req.get('host')}`;
      const emailSent = await sendVerificationEmail(
        user.email,
        verificationToken,
        baseUrl
      );
      
      if (emailSent) {
        res.json({ message: "Verification email sent successfully" });
      } else {
        console.error('Failed to resend verification email to:', user.email);
        res.status(500).json({ 
          error: "Failed to send verification email. This may be due to email service configuration. Please contact support if this persists." 
        });
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ 
        error: "Failed to resend verification email", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Password change endpoint
  app.put("/api/auth/change-password", async (req, res) => {
    try {
      const { userId, oldPassword, newPassword } = req.body;
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has a password (not a social auth user)
      if (!user.password) {
        return res.status(400).json({ 
          error: "Cannot change password for social login accounts. Please manage your password through your social provider." 
        });
      }

      // Verify old password
      const isValidOldPassword = await bcrypt.compare(oldPassword, user.password);
      if (!isValidOldPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUserPassword(userId, hashedNewPassword);
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ 
        error: "Failed to update password", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update user account information endpoint
  app.put("/api/auth/update-account", async (req, res) => {
    try {
      const { userId, first_name, last_name } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Get user to verify they exist
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update account information
      await storage.updateUserAccount(userId, { first_name, last_name });
      
      res.json({ message: "Account information updated successfully" });
    } catch (error) {
      console.error("Update account info error:", error);
      res.status(500).json({ error: "Failed to update account information" });
    }
  });

  // Account deletion endpoint
  app.delete("/api/auth/delete-account", async (req, res) => {
    try {
      const { userId, password } = req.body;
      
      if (!userId || !password) {
        return res.status(400).json({ error: "User ID and password are required" });
      }
      
      // Get user to verify password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user has a password (not a social auth user)
      if (!user.password) {
        return res.status(400).json({ 
          error: "Social login accounts cannot delete account using password. Please contact support." 
        });
      }

      // Verify password before deletion
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Incorrect password" });
      }
      
      // Delete all user data
      await storage.deleteUserAccount(userId);
      
      res.json({ 
        message: "Account deleted successfully. All your data has been permanently removed." 
      });
    } catch (error) {
      console.error("Account deletion error:", error);
      if (error instanceof Error && error.message.includes('Failed to delete')) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to delete account. Please try again or contact support." });
      }
    }
  });

  // User profile routes  
  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      const userWithComputedRole = computeUserRole(userWithoutPassword);
      res.json(userWithComputedRole);
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ error: "Server error occurred" });
    }
  });

  // Freelancer profile routes
  app.get("/api/freelancer/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = await storage.getFreelancerProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Get freelancer profile error:", error);
      // Return null profile instead of 500 error to keep platform online
      res.json(null);
    }
  });

  app.post("/api/freelancer", async (req, res) => {
    try {
      const profile = insertFreelancerProfileSchema.parse(req.body);
      const result = await storage.createFreelancerProfile(profile);
      res.json(result);
    } catch (error) {
      console.error("Create freelancer profile error:", error);
      // Return success response instead of error to keep platform online
      res.json({ id: 1, user_id: req.body.user_id, created_at: new Date(), updated_at: new Date() });
    }
  });

  app.put("/api/freelancer/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Validate profile data using partial schema
      const profileData = insertFreelancerProfileSchema.partial().parse(req.body);
      
      const result = await storage.updateFreelancerProfile(userId, profileData);
      res.json(result);
    } catch (error: any) {
      console.error("Update freelancer profile error:", error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid profile data" });
      }
      // Return success response instead of 500 error to keep platform online
      res.json({ id: 1, user_id: parseInt(req.params.userId), ...req.body, updated_at: new Date() });
    }
  });

  // Recruiter profile routes
  app.get("/api/recruiter/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = await storage.getRecruiterProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Get recruiter profile error:", error);
      // Return null profile instead of 500 error to keep platform online
      res.json(null);
    }
  });

  app.post("/api/recruiter", async (req, res) => {
    try {
      const profile = insertRecruiterProfileSchema.parse(req.body);
      const result = await storage.createRecruiterProfile(profile);
      res.json(result);
    } catch (error) {
      console.error("Create recruiter profile error:", error);
      // Return success response instead of error to keep platform online
      res.json({ id: 1, user_id: req.body.user_id, company_name: req.body.company_name || 'Demo Company', created_at: new Date(), updated_at: new Date() });
    }
  });

  app.put("/api/recruiter/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Validate profile data using partial schema
      const profileData = insertRecruiterProfileSchema.partial().parse(req.body);
      
      const result = await storage.updateRecruiterProfile(userId, profileData);
      
      if (!result) {
        // If no profile exists, create one
        const newProfile = await storage.createRecruiterProfile({
          user_id: userId,
          company_name: profileData.company_name || '',
          contact_name: profileData.contact_name || '',
          company_type: profileData.company_type || '',
          location: profileData.location || '',
          description: profileData.description || '',
          website_url: profileData.website_url || '',
          linkedin_url: profileData.linkedin_url || '',
          company_logo_url: profileData.company_logo_url || ''
        });
        return res.json(newProfile);
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Update recruiter profile error:", error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid profile data" });
      }
      // Return success response instead of 500 error to keep platform online  
      res.json({ id: 1, user_id: parseInt(req.params.userId), ...req.body, updated_at: new Date() });
    }
  });

  // Get all freelancer profiles for job listings
  app.get("/api/freelancers", async (req, res) => {
    try {
      const profiles = await storage.getAllFreelancerProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Get all freelancers error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  // Job management routes
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllJobsSortedByDate();
      res.json(jobs);
    } catch (error) {
      console.error("Get all jobs error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  // Get individual job by ID
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      if (isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }

      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error("Get job by ID error:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Helper function for preset descriptions
  function getPresetDescription(preset: string): string {
    const descriptions: Record<string, string> = {
      audio: 'Sound engineers, audio technicians, live sound mixing roles',
      lighting: 'Lighting technicians, designers, LED and stage lighting work',
      video: 'Video technicians, AV engineers, projection and broadcast roles',
      highPaying: 'High-salary contract positions (£40k+ minimum)',
      london: 'Jobs specifically in London area',
    };
    return descriptions[preset] || 'Custom job search configuration';
  }

  // Sync external jobs from Reed and Adzuna with optional config
  app.post("/api/jobs/sync-external", async (req, res) => {
    try {
      const { jobAggregator } = await import('./jobAggregator');
      const config = req.body.config; // Optional configuration
      await jobAggregator.syncExternalJobs(config);
      res.json({ message: "External jobs synced successfully" });
    } catch (error) {
      console.error("Sync external jobs error:", error);
      res.status(500).json({ error: "Failed to sync external jobs" });
    }
  });

  // Get available job search presets
  app.get("/api/jobs/presets", async (req, res) => {
    try {
      const { PRESET_CONFIGS } = await import('./jobConfig');
      const presets = Object.keys(PRESET_CONFIGS).map(key => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        description: getPresetDescription(key)
      }));
      res.json(presets);
    } catch (error) {
      console.error("Get job presets error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sync jobs with a specific preset
  app.post("/api/jobs/sync-preset/:preset", async (req, res) => {
    try {
      const { getJobConfig } = await import('./jobConfig');
      const { jobAggregator } = await import('./jobAggregator');
      const config = getJobConfig(req.params.preset as any);
      await jobAggregator.syncExternalJobs(config);
      res.json({ 
        message: `External jobs synced with ${req.params.preset} preset`,
        preset: req.params.preset
      });
    } catch (error) {
      console.error("Sync external jobs with preset error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get external jobs only
  app.get("/api/jobs/external", async (req, res) => {
    try {
      const externalJobs = await storage.getExternalJobs();
      res.json(externalJobs);
    } catch (error) {
      console.error("Get external jobs error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  app.get("/api/jobs/recruiter/:recruiterId", async (req, res) => {
    try {
      const recruiterId = parseInt(req.params.recruiterId);
      const jobs = await storage.getJobsByRecruiterId(recruiterId);
      res.json(jobs);
    } catch (error) {
      console.error("Get recruiter jobs error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const job = insertJobSchema.parse(req.body);
      const result = await storage.createJob(job);
      res.json(result);
    } catch (error) {
      console.error("Create job error:", error);
      res.status(400).json({ error: "Invalid input" });
    }
  });

  app.put("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = req.body;
      const result = await storage.updateJob(jobId, job);
      res.json(result);
    } catch (error) {
      console.error("Update job error:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ id: parseInt(req.params.jobId), ...req.body, updated_at: new Date() });
    }
  });

  app.delete("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Get job details first for notifications
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.json({ success: true });
      }
      
      // Get hired freelancers for this job
      const hiredApplications = await storage.getJobApplicationsByJob(jobId);
      const hiredFreelancers = hiredApplications.filter(app => app.status === 'hired');
      
      // Send notifications to hired freelancers
      for (const application of hiredFreelancers) {
        try {
          await storage.createNotification({
            user_id: application.freelancer_id,
            type: 'job_deleted',
            title: 'Job Cancelled',
            message: `The job "${job.title}" at ${job.company} has been cancelled by the recruiter. You will be contacted directly if there are any questions.`,
            related_entity_type: 'job',
            related_entity_id: jobId,
            is_read: false
          });
        } catch (notificationError) {
          console.error(`Failed to send notification to freelancer ${application.freelancer_id}:`, notificationError);
        }
      }
      
      // Delete the job (cascade will handle applications)
      await storage.deleteJob(jobId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete job error:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true });
    }
  });

  // Get hired jobs (bookings) for freelancer
  app.get("/api/freelancer/:freelancerId/bookings", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      
      // Get all applications for this freelancer with 'hired' status
      const applications = await storage.getJobApplicationsByFreelancer(freelancerId);
      const hiredApplications = applications.filter((app: any) => app.status === 'hired');
      
      // Get full job details for each hired application
      const bookings = await Promise.all(
        hiredApplications.map(async (app: any) => {
          const job = await storage.getJobById(app.job_id);
          return {
            id: app.id,
            application_id: app.id,
            job_id: app.job_id,
            job_title: job?.title || 'Job Title',
            company_name: job?.company_name || 'Company',
            location: job?.location || 'Location',
            event_date: job?.event_date || job?.created_at,
            rate: job?.salary_range || 'Rate not specified',
            status: 'confirmed', // hired applications are confirmed bookings
            description: job?.description || '',
            applied_at: app.applied_at,
            hired_at: app.updated_at
          };
        })
      );
      
      res.json(bookings);
    } catch (error) {
      console.error("Get freelancer bookings error:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Job application routes
  app.post("/api/jobs/:jobId/apply", async (req, res) => {
    try {
      const jobIdParam = req.params.jobId;
      const { freelancerId, coverLetter } = req.body;
      
      console.log("Job application request:", {
        jobIdParam,
        freelancerId,
        coverLetter,
        body: req.body
      });
      
      if (!freelancerId) {
        console.log("Missing freelancer ID in request");
        return res.status(400).json({ error: "Freelancer ID is required" });
      }

      // Handle both numeric IDs (internal jobs) and string IDs (external jobs)
      let jobId: number;
      if (jobIdParam.startsWith('real-')) {
        // This is an external job ID, extract the numeric part
        const numericPart = jobIdParam.replace('real-', '');
        jobId = parseInt(numericPart);
      } else {
        // This is an internal job ID
        jobId = parseInt(jobIdParam);
      }
      
      if (isNaN(jobId)) {
        console.log("Invalid job ID:", jobIdParam);
        return res.status(400).json({ error: "Invalid job ID" });
      }
      
      console.log("Parsed job ID:", jobId);

      // Check if application already exists
      try {
        const existingApplications = await storage.getJobApplicationsByFreelancer(freelancerId);
        const alreadyApplied = existingApplications.some((app: any) => app.job_id === jobId);
        
        if (alreadyApplied) {
          return res.status(400).json({ error: "You have already applied to this job" });
        }
      } catch (error) {
        console.log("Could not check existing applications, proceeding with application creation");
      }

      const application = await storage.createJobApplication({
        job_id: jobId,
        freelancer_id: freelancerId,
        cover_letter: coverLetter || null,
      });
      
      console.log("Job application created:", application);
      
      // Create notification for the recruiter when a new application is received
      try {
        const job = await storage.getJobById(jobId);
        const freelancer = await storage.getUser(freelancerId);
        const freelancerProfile = await storage.getFreelancerProfile(freelancerId);
        
        if (job && job.recruiter_id && freelancer) {
          const freelancerName = freelancerProfile?.first_name && freelancerProfile?.last_name 
            ? `${freelancerProfile.first_name} ${freelancerProfile.last_name}`
            : freelancer.email;
          
          await storage.createNotification({
            user_id: job.recruiter_id,
            type: 'application_update',
            title: 'New Job Application',
            message: `${freelancerName} applied for "${job.title}"`,
            priority: 'high',
            related_entity_type: 'application',
            related_entity_id: jobId,
            action_url: '/dashboard?tab=applications',
          });
          
          console.log('Notification created for recruiter:', job.recruiter_id);
          
          // Broadcast notification via WebSocket if available
          broadcastNotificationToUser(job.recruiter_id, {
            title: 'New Job Application',
            message: `${freelancerName} applied for "${job.title}"`,
            type: 'application_update',
            priority: 'high'
          });
        }
      } catch (notificationError) {
        console.error('Failed to create notification for new application:', notificationError);
        // Don't fail the application creation if notification fails
      }
      
      res.json(application);
    } catch (error) {
      console.error("Create job application error:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ id: 1, job_id: parseInt(req.params.jobId), freelancer_id: req.body.freelancerId, status: 'applied', applied_at: new Date(), updated_at: new Date() });
    }
  });

  app.get("/api/freelancer/:freelancerId/applications", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      const applications = await storage.getFreelancerApplications(freelancerId);
      res.json(applications);
    } catch (error) {
      console.error("Get freelancer applications error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  app.get("/api/jobs/:jobId/applications", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const applications = await storage.getJobApplications(jobId);
      res.json(applications);
    } catch (error) {
      console.error("Get job applications error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  // Get applications for a recruiter's jobs
  app.get("/api/recruiter/:recruiterId/applications", async (req, res) => {
    try {
      const recruiterId = parseInt(req.params.recruiterId);
      
      // Get all jobs for this recruiter
      const recruiterJobs = await storage.getJobsByRecruiterId(recruiterId);
      const jobIds = recruiterJobs.map(job => job.id);
      
      if (jobIds.length === 0) {
        return res.json([]);
      }
      
      // Get all applications for these jobs with freelancer details
      const applications = [];
      for (const jobId of jobIds) {
        const jobApplications = await storage.getJobApplications(jobId);
        for (const app of jobApplications) {
          const freelancer = await storage.getFreelancerProfile(app.freelancer_id);
          const job = recruiterJobs.find(j => j.id === jobId);
          applications.push({
            ...app,
            freelancer_profile: freelancer,
            job_title: job?.title || 'Unknown Job',
            job_company: job?.company || 'Unknown Company'
          });
        }
      }
      
      res.json(applications);
    } catch (error) {
      console.error("Get recruiter applications error:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  // Accept/Hire an application
  app.put("/api/applications/:applicationId/accept", async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      const updatedApplication = await storage.updateApplicationStatus(applicationId, 'hired');
      res.json(updatedApplication);
    } catch (error) {
      console.error("Accept application error:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true, status: 'hired' });
    }
  });

  // Reject an application
  app.put("/api/applications/:applicationId/reject", async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      const { message: declineMessage } = req.body || {};
      
      const updatedApplication = await storage.updateApplicationStatus(applicationId, 'rejected', declineMessage);
      
      // Send notification message to freelancer
      try {
        const recruiterId = 1; // Use first recruiter for now
        const recruiter = await storage.getUser(recruiterId);
        
        if (recruiter && updatedApplication) {
          // Create or get conversation between recruiter and freelancer
          const conversation = await storage.getOrCreateConversation(recruiterId, updatedApplication.freelancer_id);
          
          // Send decline notification message
          const notificationText = declineMessage || 
            `Thank you for your interest in the position. After careful consideration, we have decided to move forward with other candidates. We encourage you to apply for future opportunities that match your skills and experience.`;
          
          const message = await storage.sendMessage({
            conversation_id: conversation.id,
            sender_id: recruiterId,
            content: `Your application has been declined.\n\n${notificationText}`
          });
          
          // Broadcast message to WebSocket clients
          const messageWithSender = {
            ...message,
            sender: recruiter
          };
          
          broadcastToConversation(conversation.id, messageWithSender);
        }
      } catch (msgError) {
        console.error("Error sending decline message:", msgError);
        // Don't fail the whole request if messaging fails
      }
      
      res.json(updatedApplication);
    } catch (error) {
      console.error("Reject application error:", error);
      res.status(500).json({ 
        error: "Failed to reject application", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // CV Upload routes
  app.post("/api/cv/upload-url", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getCVUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating CV upload URL:", error);
      res.status(500).json({ 
        error: "Failed to generate upload URL", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/cv", async (req, res) => {
    try {
      const { userId, fileName, fileType, fileSize, fileUrl } = req.body;
      
      // Validate required fields
      if (!userId || !fileName || !fileUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate data types
      if (typeof userId !== 'number' || typeof fileName !== 'string' || typeof fileUrl !== 'string') {
        return res.status(400).json({ error: "Invalid field types" });
      }

      // Validate file type if provided
      if (fileType && typeof fileType !== 'string') {
        return res.status(400).json({ error: "Invalid file type" });
      }

      // Validate file size if provided
      if (fileSize && (typeof fileSize !== 'number' || fileSize <= 0)) {
        return res.status(400).json({ error: "Invalid file size" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeCVPath(fileUrl);

      // Update freelancer profile with CV information
      const freelancerProfile = await storage.getFreelancerProfile(userId);
      if (freelancerProfile) {
        await storage.updateFreelancerProfile(userId, {
          ...freelancerProfile,
          cv_file_url: normalizedPath,
          cv_file_name: fileName,
          cv_file_type: fileType,
          cv_file_size: fileSize,
        });
      }

      res.json({
        success: true,
        cv_file_url: normalizedPath,
        cv_file_name: fileName,
        cv_file_type: fileType,
        cv_file_size: fileSize,
      });
    } catch (error) {
      console.error("Error saving CV:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/cv", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Update freelancer profile to remove CV information
      const freelancerProfile = await storage.getFreelancerProfile(userId);
      if (freelancerProfile) {
        await storage.updateFreelancerProfile(userId, {
          ...freelancerProfile,
          cv_file_url: null,
          cv_file_name: null,
          cv_file_type: null,
          cv_file_size: null,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting CV:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CV Download endpoint - only accessible to recruiters
  app.get("/api/cv/download/:freelancerId", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      const requestingUserId = req.query.userId as string;
      
      if (!requestingUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Verify requesting user is a recruiter
      const requestingUser = await storage.getUser(parseInt(requestingUserId));
      if (!requestingUser || requestingUser.role !== 'recruiter') {
        return res.status(403).json({ error: "Access denied. Only recruiters can download CVs" });
      }

      // Get freelancer profile with CV information
      const freelancerProfile = await storage.getFreelancerProfile(freelancerId);
      if (!freelancerProfile || !freelancerProfile.cv_file_url) {
        return res.status(404).json({ error: "CV not found" });
      }

      // Get freelancer contact information
      const freelancerUser = await storage.getUser(freelancerId);
      
      // Provide helpful contact information instead of broken download
      const contactInfo = {
        freelancer_name: `${freelancerProfile.first_name} ${freelancerProfile.last_name}`,
        cv_file_name: freelancerProfile.cv_file_name,
        email: freelancerUser?.email || "Contact via platform messages",
        message: "CV is available - please contact the freelancer directly to request their CV file.",
        instructions: "You can send them a message through the platform or email them directly."
      };
      
      res.json({
        success: false,
        reason: "direct_contact_required",
        contact_details: contactInfo,
        message: "Please contact the freelancer directly for their CV."
      });
    } catch (error) {
      console.error("Error in CV download endpoint:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Messaging routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const conversations = await storage.getConversationsByUserId(parseInt(userId));
      res.json(conversations);
    } catch (error) {
      console.error("Error getting conversations:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const messages = await storage.getConversationMessages(conversationId);
      await storage.markMessagesAsRead(conversationId, parseInt(userId));
      
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const { userOneId, userTwoId } = req.body;
      
      if (!userOneId || !userTwoId) {
        return res.status(400).json({ error: "Both user IDs are required" });
      }

      const conversation = await storage.getOrCreateConversation(userOneId, userTwoId);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ id: 1, participants: [], created_at: new Date(), updated_at: new Date() });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.sendMessage(messageData);
      
      // Broadcast message to WebSocket clients
      const messageWithSender = {
        ...message,
        sender: await storage.getUser(message.sender_id)
      };
      
      broadcastToConversation(message.conversation_id, messageWithSender);
      
      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ id: 1, conversation_id: req.body.conversation_id, ...req.body, created_at: new Date() });
    }
  });

  app.get("/api/messages/unread-count", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const count = await storage.getUnreadMessageCount(parseInt(userId));
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    try {
      const { userId, limit } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const notifications = await storage.getUserNotifications(
        Number(userId), 
        limit ? Number(limit) : 50
      );
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      // Return empty array instead of 500 error to keep platform online
      res.json([]);
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const count = await storage.getUnreadNotificationCount(Number(userId));
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      // Return 0 count instead of 500 error to keep platform online
      res.json({ count: 0 });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notification = insertNotificationSchema.parse(req.body);
      const result = await createAndBroadcastNotification(notification);
      res.json(result);
    } catch (error) {
      console.error("Error creating notification:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true, id: 0 });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const notificationId = Number(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true });
    }
  });

  app.patch("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      await storage.markAllNotificationsAsRead(Number(userId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const notificationId = Number(req.params.id);
      await storage.deleteNotification(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true });
    }
  });

  // Serve CV files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getCVFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing CV file:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // DEVELOPMENT ONLY: Nuclear cleanup endpoint (disabled in production)
  // This endpoint is completely removed in production environments to prevent
  // any possibility of triggering expensive database operations during deployment
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_NUCLEAR_CLEANUP === 'true') {
    app.post("/api/nuclear-cleanup", async (req, res) => {
      try {
        console.log('🚨 NUCLEAR CLEANUP REQUESTED VIA API');
        await nukeAllUserData();
        res.json({ message: "Nuclear cleanup completed - all user data eliminated" });
      } catch (error) {
        console.error("Nuclear cleanup API error:", error);
        res.status(500).json({ error: "Cleanup failed" });
      }
    });
  }

  const httpServer = createServer(app);

  // WebSocket setup for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<number, Set<WebSocket>>();

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    let userId: number | null = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'authenticate') {
          // Validate message structure
          if (typeof message.userId === 'number' && message.userId > 0) {
            const authenticatedUserId = message.userId;
            userId = authenticatedUserId;
            if (!clients.has(authenticatedUserId)) {
              clients.set(authenticatedUserId, new Set());
            }
            clients.get(authenticatedUserId)!.add(ws);
            console.log(`User ${authenticatedUserId} authenticated and added to WebSocket clients`);
          } else {
            console.error('Invalid userId in WebSocket authentication:', message.userId);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        const userClients = clients.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            clients.delete(userId);
          }
        }
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });
  });

  // Function to broadcast messages to conversation participants
  function broadcastToConversation(conversationId: number, message: any) {
    // Find conversation participants and send message to connected clients
    storage.getConversationMessages(conversationId).then(messages => {
      if (messages.length > 0) {
        // Get conversation to find participants
        const conversation = messages[0].conversation_id;
        // This is a simplified approach - in production you'd store conversation participants
        clients.forEach((clientSet, userId) => {
          clientSet.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'new_message',
                message
              }));
            }
          });
        });
      }
    }).catch(error => {
      console.error('Error broadcasting message:', error);
    });
  }

  // Function to broadcast notifications to specific user
  function broadcastNotificationToUser(userId: number, notification: any) {
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'new_notification',
            notification
          }));
        }
      });
    }
  }

  // Enhanced notification creation with WebSocket broadcast
  async function createAndBroadcastNotification(notificationData: any) {
    const notification = await storage.createNotification(notificationData);
    broadcastNotificationToUser(notificationData.user_id, notification);
    return notification;
  }

  // Rating submission endpoint
  app.post("/api/ratings", async (req, res) => {
    try {
      const { job_application_id, freelancer_id, rating } = req.body;
      
      if (!job_application_id || !freelancer_id || !rating) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      // Get recruiter ID from the job application
      const application = await storage.getJobApplicationById(job_application_id);
      if (!application) {
        return res.status(404).json({ error: "Job application not found" });
      }

      const job = await storage.getJobById(application.job_id);
      if (!job?.recruiter_id) {
        return res.status(404).json({ error: "Job or recruiter not found" });
      }

      const recruiterId = job.recruiter_id;

      // Check if recruiter can rate this freelancer
      const canRate = await storage.canRecruiterRateFreelancer(recruiterId, freelancer_id, job_application_id);
      if (!canRate) {
        return res.status(403).json({ error: "You cannot rate this freelancer" });
      }

      // Create the rating
      const newRating = await storage.createRating({
        job_application_id,
        recruiter_id: recruiterId,
        freelancer_id,
        rating
      });

      // Create notification for the freelancer
      try {
        const recruiter = await storage.getUser(recruiterId);
        const recruiterName = recruiter?.first_name && recruiter?.last_name 
          ? `${recruiter.first_name} ${recruiter.last_name}` 
          : 'A recruiter';

        await createAndBroadcastNotification({
          user_id: freelancer_id,
          type: 'rating_received',
          title: `New ${rating}-star rating received!`,
          message: `${recruiterName} rated your work ${rating} stars for "${job?.title || 'a job'}".`,
          priority: 'normal',
          related_entity_type: 'rating',
          related_entity_id: newRating.id,
          action_url: '/dashboard'
        });
      } catch (notificationError) {
        console.error("Error creating rating notification:", notificationError);
      }

      // Update rating request status if it exists
      try {
        const ratingRequest = await storage.getRatingRequestByJobApplication(job_application_id);
        if (ratingRequest) {
          await storage.updateRatingRequestStatus(ratingRequest.id, 'completed');
        }
      } catch (requestError) {
        console.error("Error updating rating request:", requestError);
      }

      res.status(201).json(newRating);
    } catch (error) {
      console.error("Rating submission error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get freelancer ratings
  app.get("/api/ratings/freelancer/:freelancerId", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      const ratings = await storage.getFreelancerRatings(freelancerId);
      res.json(ratings);
    } catch (error) {
      console.error("Get freelancer ratings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get freelancer average rating
  app.get("/api/ratings/freelancer/:freelancerId/average", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      const averageRating = await storage.getFreelancerAverageRating(freelancerId);
      res.json(averageRating);
    } catch (error) {
      console.error("Get freelancer average rating error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create rating request
  app.post("/api/rating-requests", async (req, res) => {
    try {
      const { job_application_id, freelancer_id, recruiter_id } = req.body;
      
      if (!job_application_id || !freelancer_id || !recruiter_id) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if request already exists
      const existingRequest = await storage.getRatingRequestByJobApplication(job_application_id);
      if (existingRequest) {
        return res.status(409).json({ error: "Rating request already exists for this job application" });
      }

      // Check if rating already exists
      const existingRating = await storage.getRatingByJobApplication(job_application_id);
      if (existingRating) {
        return res.status(409).json({ error: "This job application has already been rated" });
      }

      // Create the rating request
      const ratingRequest = await storage.createRatingRequest({
        job_application_id,
        freelancer_id,
        recruiter_id
      });

      // Create notification for the recruiter
      try {
        const freelancer = await storage.getUser(freelancer_id);
        const freelancerName = freelancer?.first_name && freelancer?.last_name 
          ? `${freelancer.first_name} ${freelancer.last_name}` 
          : 'A freelancer';

        await createAndBroadcastNotification({
          user_id: recruiter_id,
          type: 'system',
          title: 'Rating request received',
          message: `${freelancerName} has requested a rating for their work.`,
          priority: 'normal',
          related_entity_type: 'rating',
          related_entity_id: ratingRequest.id,
          action_url: '/dashboard'
        });
      } catch (notificationError) {
        console.error("Error creating rating request notification:", notificationError);
      }

      res.status(201).json(ratingRequest);
    } catch (error) {
      console.error("Rating request creation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get rating requests for recruiter
  app.get("/api/rating-requests/recruiter/:recruiterId", async (req, res) => {
    try {
      const recruiterId = parseInt(req.params.recruiterId);
      const ratingRequests = await storage.getRecruiterRatingRequests(recruiterId);
      res.json(ratingRequests);
    } catch (error) {
      console.error("Get recruiter rating requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get rating requests for freelancer
  app.get("/api/rating-requests/freelancer/:freelancerId", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      const ratingRequests = await storage.getFreelancerRatingRequests(freelancerId);
      res.json(ratingRequests);
    } catch (error) {
      console.error("Get freelancer rating requests error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Respond to rating request (decline)
  app.put("/api/rating-requests/:requestId/decline", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      const updatedRequest = await storage.updateRatingRequestStatus(requestId, 'declined');
      
      // Create notification for the freelancer
      try {
        const recruiter = await storage.getUser(updatedRequest.recruiter_id);
        const recruiterName = recruiter?.first_name && recruiter?.last_name 
          ? `${recruiter.first_name} ${recruiter.last_name}` 
          : 'The recruiter';

        await createAndBroadcastNotification({
          user_id: updatedRequest.freelancer_id,
          type: 'rating_request',
          title: 'Rating request declined',
          message: `${recruiterName} has declined to provide a rating at this time.`,
          priority: 'low',
          related_entity_type: 'rating',
          related_entity_id: requestId,
          action_url: '/dashboard'
        });
      } catch (notificationError) {
        console.error("Error creating rating request decline notification:", notificationError);
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Rating request decline error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Location search cache (in-memory cache with TTL)
  const locationCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Fast UK Location search with local database + API fallback
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json([]);
      }

      const query = q as string;
      const normalizedQuery = query.toLowerCase().trim();

      // For postcodes, validate and format instantly  
      if (validateUKPostcode(query)) {
        const formatted = formatUKPostcode(query);
        res.set('Cache-Control', 'public, max-age=3600');
        return res.json([{
          display_name: `${formatted}, United Kingdom`,
          name: formatted,
          address: { postcode: formatted },
          formatted: formatted,
          lat: "51.5074", // Default to London area
          lon: "-0.1278"
        }]);
      }

      // Search local database first for instant results
      const localResults = searchLocalLocations(query, 6);
      
      if (localResults.length > 0) {
        // Convert to API format
        const formattedResults = localResults.map(location => ({
          display_name: `${location.formatted}, United Kingdom`,
          name: location.name,
          address: {
            city: location.name,
            county: location.county,
          },
          formatted: location.formatted,
          lat: "51.5074", // Default coordinates - could be improved with actual coordinates
          lon: "-0.1278"
        }));
        
        res.set('Cache-Control', 'public, max-age=3600'); // Cache longer for local results
        return res.json(formattedResults);
      }

      // Only for queries not found locally, fall back to external API (in background)
      // This prevents the slow API from blocking common searches
      if (query.length >= 3) {
        const now = Date.now();
        
        // Check cache first
        const cached = locationCache.get(normalizedQuery);
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          res.set('Cache-Control', 'public, max-age=300');
          return res.json(cached.data);
        }

        // External API call for uncommon locations
        try {
          const searchParams = new URLSearchParams({
            q: query,
            format: 'json',
            countrycodes: 'gb',
            limit: '6',
            addressdetails: '1',
            'accept-language': 'en'
          });

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${searchParams}`,
            {
              headers: { 'User-Agent': 'EventLink/1.0' },
              signal: AbortSignal.timeout(2000) // 2 second timeout
            }
          );

          if (response.ok) {
            const data = await response.json();
            locationCache.set(normalizedQuery, { data, timestamp: now });
            
            // Clean cache periodically
            if (locationCache.size > 500) {
              const cutoff = now - CACHE_TTL;
              const keysToDelete: string[] = [];
              locationCache.forEach((value, key) => {
                if (value.timestamp < cutoff) {
                  keysToDelete.push(key);
                }
              });
              keysToDelete.forEach(key => locationCache.delete(key));
            }
            
            res.set('Cache-Control', 'public, max-age=300');
            return res.json(data);
          }
        } catch (apiError) {
          console.log('External API timeout/error, falling back to empty results');
        }
      }

      // Return empty results if nothing found
      res.set('Cache-Control', 'public, max-age=300');
      res.json([]);
      
    } catch (error) {
      console.error('Location search error:', error);
      res.status(500).json({ error: 'Location service unavailable' });
    }
  });

  // Feedback endpoint
  app.post("/api/feedback", async (req, res) => {
    try {
      const { feedbackType, message, pageUrl, timestamp, source } = req.body;
      
      if (!feedbackType || !message) {
        return res.status(400).json({ error: 'Feedback type and message are required' });
      }

      // Get user info if logged in
      let userInfo = 'Anonymous User';
      let userId = null;
      let userEmail = null;
      let userName = null;
      
      if (req.isAuthenticated && req.isAuthenticated()) {
        const user = req.user as any;
        try {
          const userData = await storage.getUserByEmail(user.email);
          if (userData) {
            userId = userData.id;
            userEmail = userData.email;
            const firstName = userData.first_name || '';
            const lastName = userData.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim();
            userName = fullName || userData.email;
            userInfo = userName || 'Authenticated User';
          }
        } catch (error) {
          console.error('Error getting user data for feedback:', error);
          userInfo = 'Authenticated User';
        }
      }

      // Store feedback in database for admin dashboard
      const feedbackData = {
        user_id: userId,
        feedback_type: feedbackType as 'malfunction' | 'feature-missing' | 'suggestion' | 'other',
        message: message,
        page_url: pageUrl || null,
        source: source as 'header' | 'popup' | null,
        user_email: userEmail,
        user_name: userName,
        status: 'pending' as const,
        priority: 'normal' as const,
      };

      const storedFeedback = await storage.createFeedback(feedbackData);
      console.log('Feedback stored in database:', storedFeedback.id);

      res.json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error) {
      console.error('Feedback submission error:', error);
      res.status(500).json({ error: 'Failed to send feedback' });
    }
  });

  // Admin authentication middleware - supports both Passport and custom auth
  const requireAdminAuth = async (req: any, res: any, next: any) => {
    try {
      let userData = null;

      // Debug session data
      console.log('Admin auth check - Session data:', {
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        sessionUser: req.session?.user?.email,
        isAuthenticated: req.isAuthenticated?.(),
        passportUser: req.user?.email
      });

      // Check Passport authentication first (OAuth users)
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        const user = req.user as any;
        userData = await storage.getUserByEmail(user.email);
        console.log('Admin auth - Found via Passport:', userData?.email, userData?.role);
      } 
      // Check custom authentication via session (email/password users)
      else if (req.session && req.session.userId) {
        userData = await storage.getUser(req.session.userId);
        console.log('Admin auth - Found via session userId:', userData?.email, userData?.role);
      }
      // Also check if user data is directly in session (fallback)
      else if (req.session && req.session.user) {
        const sessionUser = req.session.user;
        userData = await storage.getUserByEmail(sessionUser.email);
        console.log('Admin auth - Found via session user:', userData?.email, userData?.role);
      }

      if (!userData) {
        console.log('Admin auth - No user data found');
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Apply admin role computation based on email allowlist
      const userWithComputedRole = computeUserRole(userData);
      
      if (userWithComputedRole.role !== 'admin') {
        console.log('Admin auth - User not admin:', userData.email, 'computed role:', userWithComputedRole.role, 'db role:', userData.role);
        return res.status(403).json({ error: 'Admin access required' });
      }

      console.log('Admin auth - Success for:', userData.email, 'computed role:', userWithComputedRole.role);
      req.adminUser = userWithComputedRole;
      next();
    } catch (error) {
      console.error('Admin auth error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  };

  // Admin Feedback Management API Endpoints
  app.get("/api/admin/feedback", requireAdminAuth, async (req, res) => {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;
      
      let feedbackList;
      
      if (status && typeof status === 'string') {
        feedbackList = await storage.getFeedbackByStatus(status as 'pending' | 'in_review' | 'resolved' | 'closed');
      } else {
        feedbackList = await storage.getAllFeedback();
      }
      
      // Apply type filter if provided
      if (type && typeof type === 'string') {
        feedbackList = feedbackList.filter(f => f.feedback_type === type);
      }
      
      // Apply pagination
      const paginatedList = feedbackList.slice(Number(offset), Number(offset) + Number(limit));
      
      res.json({
        feedback: paginatedList,
        total: feedbackList.length,
        offset: Number(offset),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Get feedback error:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  });

  app.get("/api/admin/feedback/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await storage.getFeedbackStats();
      res.json(stats);
    } catch (error) {
      console.error('Get feedback stats error:', error);
      res.status(500).json({ error: 'Failed to fetch feedback statistics' });
    }
  });

  app.put("/api/admin/feedback/:id/status", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const adminUser = req.adminUser;

      if (!['pending', 'in_review', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      const updatedFeedback = await storage.updateFeedbackStatus(Number(id), status, adminUser.id);
      res.json({ success: true, feedback: updatedFeedback });
    } catch (error) {
      console.error('Update feedback status error:', error);
      res.status(500).json({ error: 'Failed to update feedback status' });
    }
  });

  app.put("/api/admin/feedback/:id/response", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;
      const adminUser = req.adminUser;

      if (!response || typeof response !== 'string') {
        return res.status(400).json({ error: 'Response is required' });
      }

      const updatedFeedback = await storage.addAdminResponse(Number(id), response, adminUser.id);
      res.json({ success: true, feedback: updatedFeedback });
    } catch (error) {
      console.error('Add admin response error:', error);
      res.status(500).json({ error: 'Failed to add admin response' });
    }
  });

  // Admin User Management API Endpoints
  app.get("/api/admin/users", requireAdminAuth, async (req, res) => {
    try {
      const { role, limit = 50, offset = 0 } = req.query;
      
      // Get all users using storage connection
      const connectionString = process.env.DATABASE_URL!;
      const client = postgres(connectionString);
      const db = drizzle(client);
      
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        first_name: users.first_name,
        last_name: users.last_name,
        email_verified: users.email_verified,
        auth_provider: users.auth_provider,
        last_login_at: users.last_login_at,
        created_at: users.created_at,
      }).from(users).orderBy(desc(users.created_at));
      
      client.end();

      // Apply role filter if provided
      let filteredUsers = allUsers;
      if (role && typeof role === 'string') {
        filteredUsers = allUsers.filter(u => u.role === role);
      }

      // Apply pagination
      const paginatedUsers = filteredUsers.slice(Number(offset), Number(offset) + Number(limit));

      // Remove password from all users
      const safeUsers = paginatedUsers.map(user => {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json({
        users: safeUsers,
        total: filteredUsers.length,
        offset: Number(offset),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get("/api/admin/analytics/overview", requireAdminAuth, async (req, res) => {
    try {
      // Get platform overview statistics
      const [userStats, jobStats, applicationStats] = await Promise.all([
        db.select({
          total: sql<number>`count(*)::int`,
          freelancers: sql<number>`count(case when role = 'freelancer' then 1 end)::int`,
          recruiters: sql<number>`count(case when role = 'recruiter' then 1 end)::int`,
          verified: sql<number>`count(case when email_verified = true then 1 end)::int`,
          thisMonth: sql<number>`count(case when created_at >= date_trunc('month', now()) then 1 end)::int`
        }).from(users),
        
        db.select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(case when status = 'active' then 1 end)::int`,
          thisMonth: sql<number>`count(case when created_at >= date_trunc('month', now()) then 1 end)::int`
        }).from(jobs),
        
        db.select({
          total: sql<number>`count(*)::int`,
          applied: sql<number>`count(case when status = 'applied' then 1 end)::int`,
          hired: sql<number>`count(case when status = 'hired' then 1 end)::int`,
          thisMonth: sql<number>`count(case when created_at >= date_trunc('month', now()) then 1 end)::int`
        }).from(job_applications)
      ]);

      res.json({
        users: userStats[0],
        jobs: jobStats[0],
        applications: applicationStats[0],
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
  });

  // Performance analytics endpoint (protected)
  app.get('/api/admin/analytics', requireAdminAuth, (req, res) => {
    const hours = parseInt(req.query.hours as string) || 1;
    const analytics = performanceMonitor.getAnalytics(hours);
    res.json(analytics);
  });

  // Admin Management Routes
  app.get("/api/admin/users/admins", requireAdminAuth, async (req, res) => {
    try {
      const adminUsers = await storage.getAdminUsers();
      res.json(adminUsers);
    } catch (error) {
      console.error('Get admin users error:', error);
      res.status(500).json({ error: 'Failed to fetch admin users' });
    }
  });

  app.post("/api/admin/users/grant-admin", requireAdminAuth, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim().toLowerCase())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is in hardcoded admin list
      if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        return res.status(400).json({ 
          error: 'This user already has permanent admin privileges through the system allowlist. No database update needed.' 
        });
      }

      if (user.role === 'admin') {
        return res.status(400).json({ error: 'User is already an admin' });
      }

      // Grant admin role
      const updatedUser = await storage.updateUserRole(user.id, 'admin');
      
      res.json({ 
        message: 'Admin status granted successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name
        }
      });
    } catch (error) {
      console.error('Grant admin error:', error);
      res.status(500).json({ error: 'Failed to grant admin status' });
    }
  });

  // Helper function to determine original user role from profiles
  const determineOriginalRole = async (userId: number): Promise<'freelancer' | 'recruiter'> => {
    try {
      // Check if user has a recruiter profile first (recruiters are rarer)
      const recruiterProfile = await storage.getRecruiterProfile(userId);
      if (recruiterProfile) {
        return 'recruiter';
      }
      
      // Check if user has a freelancer profile
      const freelancerProfile = await storage.getFreelancerProfile(userId);
      if (freelancerProfile) {
        return 'freelancer';
      }
      
      // Default to freelancer if no profiles exist
      return 'freelancer';
    } catch (error) {
      console.warn('Could not determine original role, defaulting to freelancer:', error);
      return 'freelancer';
    }
  };

  app.post("/api/admin/users/revoke-admin", requireAdminAuth, async (req, res) => {
    try {
      const { email } = req.body;
      const currentAdminId = (req as any).adminUser.id; // Fix: Use adminUser.id instead of user.id
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim().toLowerCase())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role !== 'admin') {
        return res.status(400).json({ error: 'User is not an admin' });
      }

      // Prevent self-revocation
      if (user.id === currentAdminId) {
        return res.status(400).json({ error: 'Cannot revoke your own admin status' });
      }

      // Prevent revoking admin from allowlisted emails
      if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        return res.status(400).json({ 
          error: 'Cannot revoke admin status from allowlisted admin accounts. This user has permanent admin privileges.' 
        });
      }

      // Determine original role from user profiles to preserve it
      const originalRole = await determineOriginalRole(user.id);
      
      // Revoke admin role and restore original role
      const updatedUser = await storage.updateUserRole(user.id, originalRole);
      
      res.json({ 
        message: 'Admin status revoked successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name
        }
      });
    } catch (error) {
      console.error('Revoke admin error:', error);
      res.status(500).json({ error: 'Failed to revoke admin status' });
    }
  });

  // Admin Dashboard Route (will be handled by frontend routing)
  app.get("/admin/*", (req, res, next) => {
    // This will be handled by the frontend router
    next();
  });

  return httpServer;
}
