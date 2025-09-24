import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "../emailService";
import { nukeAllUserData } from "../clearAllUserData";
import passport from "passport";

// Admin email allowlist for server-side admin role detection
const ADMIN_EMAILS = [
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

// JWT utility functions
const JWT_SECRET = process.env.JWT_SECRET || 'eventlink-jwt-secret-change-in-production';

const generateJWTToken = (user: any) => {
  const userWithRole = computeUserRole(user);
  return jwt.sign(
    { 
      id: userWithRole.id, 
      email: userWithRole.email, 
      role: userWithRole.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyJWTToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

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

export function registerAuthRoutes(app: Express) {
  // Reasonable rate limiting for password operations
  const passwordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes (aligned with general rate limiter)
    max: 10, // 10 password attempts per 15 minutes
    message: { error: 'Too many password attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
  });
  
  // Apply strict rate limiting to sensitive routes
  app.use('/api/auth/signin', passwordRateLimit);
  app.use('/api/auth/forgot-password', passwordRateLimit);
  app.use('/api/auth/reset-password', passwordRateLimit);
  
  // Apply input sanitization
  app.use('/api/auth', sanitizeAuthInput);

  // OAuth error handling for scope denial and token issues
  app.get('/api/auth/oauth-error', (req, res) => {
    const error = req.query.error as string;
    const errorDescription = req.query.error_description as string;
    
    console.log('OAuth Error Details:', { error, errorDescription });
    
    let userMessage = 'Authentication failed. Please try again.';
    let details = '';
    
    if (error === 'access_denied') {
      userMessage = 'Access was denied. You need to allow access to continue.';
      details = 'Please grant the necessary permissions and try again.';
    } else if (error === 'invalid_scope') {
      userMessage = 'Invalid permissions requested.';
      details = 'The authentication request included invalid permissions.';
    } else if (error === 'server_error') {
      userMessage = 'Server error occurred during authentication.';
      details = 'Please try again later or contact support if the issue persists.';
    }
    
    // Return JSON response for API calls
    if (req.headers.accept?.includes('application/json')) {
      return res.status(400).json({
        error: userMessage,
        details: details,
        code: error
      });
    }
    
    // For web requests, redirect to frontend with error info
    const redirectUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.REPL_DOMAINS}/auth?error=${encodeURIComponent(userMessage)}&details=${encodeURIComponent(details)}`
      : `http://localhost:5173/auth?error=${encodeURIComponent(userMessage)}&details=${encodeURIComponent(details)}`;
    
    res.redirect(redirectUrl);
  });

  // OAuth configuration endpoint
  app.get("/api/oauth-config", (req, res) => {
    res.json({
      google: {
        enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        clientId: process.env.GOOGLE_CLIENT_ID
      },
      facebook: {
        enabled: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        appId: process.env.FACEBOOK_APP_ID
      },
      apple: {
        enabled: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
        clientId: process.env.APPLE_CLIENT_ID
      },
      linkedin: {
        enabled: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
        clientId: process.env.LINKEDIN_CLIENT_ID
      }
    });
  });

  // Google OAuth routes
  app.get('/api/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));

  app.get('/api/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', async (err: any, user: any, info: any) => {
      try {
        if (err) {
          console.error('Google OAuth callback error:', err);
          return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication failed');
        }

        if (!user) {
          const error = info?.message || 'Authentication failed';
          console.log('Google OAuth - No user returned:', info);
          return res.redirect(`/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`);
        }

        // Manually establish the session
        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            console.error('Session login error:', loginErr);
            return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Session creation failed');
          }
          
          // Compute role after login
          const userWithRole = computeUserRole(user);
          
          // Update the session with the computed role
          req.user = userWithRole;
          
          console.log('Google OAuth successful login:', {
            id: user.id,
            email: user.email,
            role: userWithRole.role,
            sessionId: req.session?.id
          });

          // Redirect to frontend dashboard
          const redirectUrl = process.env.NODE_ENV === 'production'
            ? `${process.env.REPL_DOMAINS}/dashboard`
            : 'http://localhost:5173/dashboard';
          
          return res.redirect(redirectUrl);
        });
      } catch (error) {
        console.error('Google OAuth callback processing error:', error);
        return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed');
      }
    })(req, res, next);
  });

  // Facebook OAuth routes
  app.get('/api/auth/facebook', passport.authenticate('facebook', {
    scope: ['email', 'public_profile']
  }));

  app.get('/api/auth/facebook/callback', (req, res, next) => {
    passport.authenticate('facebook', async (err: any, user: any, info: any) => {
      try {
        if (err) {
          console.error('Facebook OAuth callback error:', err);
          return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication failed');
        }

        if (!user) {
          const error = info?.message || 'Authentication failed';
          console.log('Facebook OAuth - No user returned:', info);
          return res.redirect(`/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`);
        }

        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            console.error('Session login error:', loginErr);
            return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Session creation failed');
          }
          
          const userWithRole = computeUserRole(user);
          req.user = userWithRole;
          
          console.log('Facebook OAuth successful login:', {
            id: user.id,
            email: user.email,
            role: userWithRole.role
          });

          const redirectUrl = process.env.NODE_ENV === 'production'
            ? `${process.env.REPL_DOMAINS}/dashboard`
            : 'http://localhost:5173/dashboard';
          
          return res.redirect(redirectUrl);
        });
      } catch (error) {
        console.error('Facebook OAuth callback processing error:', error);
        return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed');
      }
    })(req, res, next);
  });

  // Apple OAuth routes
  app.get('/api/auth/apple', passport.authenticate('apple'));

  app.post('/api/auth/apple/callback', (req, res, next) => {
    passport.authenticate('apple', async (err: any, user: any, info: any) => {
      try {
        if (err) {
          console.error('Apple OAuth callback error:', err);
          return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication failed');
        }

        if (!user) {
          const error = info?.message || 'Authentication failed';
          console.log('Apple OAuth - No user returned:', info);
          return res.redirect(`/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`);
        }

        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            console.error('Session login error:', loginErr);
            return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Session creation failed');
          }
          
          const userWithRole = computeUserRole(user);
          req.user = userWithRole;
          
          console.log('Apple OAuth successful login:', {
            id: user.id,
            email: user.email,
            role: userWithRole.role
          });

          const redirectUrl = process.env.NODE_ENV === 'production'
            ? `${process.env.REPL_DOMAINS}/dashboard`
            : 'http://localhost:5173/dashboard';
          
          return res.redirect(redirectUrl);
        });
      } catch (error) {
        console.error('Apple OAuth callback processing error:', error);
        return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed');
      }
    })(req, res, next);
  });

  // LinkedIn OAuth routes
  app.get('/api/auth/linkedin', passport.authenticate('linkedin', {
    scope: ['profile', 'email']
  }));

  app.get('/api/auth/linkedin/callback', (req, res, next) => {
    passport.authenticate('linkedin', async (err: any, user: any, info: any) => {
      try {
        if (err) {
          console.error('LinkedIn OAuth callback error:', err);
          return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication failed');
        }

        if (!user) {
          const error = info?.message || 'Authentication failed';
          console.log('LinkedIn OAuth - No user returned:', info);
          return res.redirect(`/api/auth/oauth-error?error=access_denied&error_description=${encodeURIComponent(error)}`);
        }

        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            console.error('Session login error:', loginErr);
            return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Session creation failed');
          }
          
          const userWithRole = computeUserRole(user);
          req.user = userWithRole;
          
          console.log('LinkedIn OAuth successful login:', {
            id: user.id,
            email: user.email,
            role: userWithRole.role
          });

          const redirectUrl = process.env.NODE_ENV === 'production'
            ? `${process.env.REPL_DOMAINS}/dashboard`
            : 'http://localhost:5173/dashboard';
          
          return res.redirect(redirectUrl);
        });
      } catch (error) {
        console.error('LinkedIn OAuth callback processing error:', error);
        return res.redirect('/api/auth/oauth-error?error=server_error&error_description=Authentication processing failed');
      }
    })(req, res, next);
  });

  // Get current user session (JWT-based)
  app.get("/api/auth/session", async (req, res) => {
    try {
      // Check for JWT token in Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify JWT token
      const decoded = verifyJWTToken(token);
      if (!decoded || typeof decoded !== 'object') {
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
        user: userWithRole
      });
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User signup endpoint
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: result.error.issues 
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
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user with verification token
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        first_name,
        last_name,
        role: role || 'freelancer',
        email_verification_token: emailVerificationToken,
        email_verification_expires: emailVerificationExpires
      });

      // Send verification email
      try {
        const baseUrl = req.protocol + '://' + req.get('host');
        await sendVerificationEmail(email, emailVerificationToken, baseUrl);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
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
          email_verified: userWithRole.email_verified
        }
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User signin endpoint
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if user has a password (not a social auth user)
      if (!user.password) {
        return res.status(400).json({ 
          error: "This account uses social login. Please sign in with your social provider." 
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
          code: "EMAIL_NOT_VERIFIED"
        });
      }

      // Apply role computation
      const userWithRole = computeUserRole(user);

      // Generate JWT token instead of session
      const token = generateJWTToken(userWithRole);

      res.json({ 
        message: "Sign in successful",
        token: token,
        user: {
          id: (userWithRole as any).id,
          email: (userWithRole as any).email,
          first_name: (userWithRole as any).first_name,
          last_name: (userWithRole as any).last_name,
          role: (userWithRole as any).role,
          email_verified: (userWithRole as any).email_verified
        }
      });

    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email verification endpoint
  app.get("/verify-email", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        // Redirect to frontend with error
        const frontendUrl = process.env.NODE_ENV === 'production' 
          ? process.env.REPL_DOMAINS 
          : 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent('Invalid verification token')}`);
      }

      const verified = await storage.verifyEmail(token);
      
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? process.env.REPL_DOMAINS 
        : 'http://localhost:5173';

      if (verified) {
        res.redirect(`${frontendUrl}/auth?verified=true`);
      } else {
        res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent('Invalid or expired verification token')}`);
      }
    } catch (error) {
      console.error('Email verification error:', error);
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? process.env.REPL_DOMAINS 
        : 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent('Verification failed')}`);
    }
  });

  // Sign out endpoint
  app.post("/api/auth/signout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: "Failed to sign out" });
      }
      
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error('Session destruction error:', sessionErr);
          return res.status(500).json({ error: "Failed to destroy session" });
        }
        
        res.clearCookie('eventlink.sid');
        res.json({ message: "Signed out successfully" });
      });
    });
  });

  // Forgot password endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      // Generate reset token
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token to user
      const tokenSaved = await storage.setPasswordResetToken(email, resetToken, resetTokenExpires);
      if (!tokenSaved) {
        return res.status(500).json({ error: "Failed to generate reset token" });
      }

      // Send password reset email
      try {
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? `https://${req.get('host')}` 
          : `http://localhost:5000`;
        await sendPasswordResetEmail(email, resetToken, baseUrl, user.first_name);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        return res.status(500).json({ error: "Failed to send reset email" });
      }

      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset password endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
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
  });

  // Resend verification email endpoint
  app.post("/api/auth/resend-verification", async (req, res) => {
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
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new token
      await storage.updateUserVerificationToken((user as any).id, emailVerificationToken, emailVerificationExpires);

      // Send verification email
      try {
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? `https://${req.get('host')}` 
          : `http://localhost:5000`;
        await sendVerificationEmail(email, emailVerificationToken, baseUrl);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return res.status(500).json({ error: "Failed to send verification email" });
      }

      res.json({ message: "Verification email sent successfully" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Change password endpoint (authenticated)
  app.put("/api/auth/change-password", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }

      const user = await storage.getUser((req.user as any).id);
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
  });

  // Update account information endpoint (authenticated)
  app.put("/api/auth/update-account", async (req, res) => {
    console.log('🔄 Backend: Update account request received');
    console.log('📤 Request body:', req.body);
    console.log('👤 Current user:', req.user ? { id: (req.user as any).id, email: (req.user as any).email, role: (req.user as any).role } : 'NOT AUTHENTICATED');
    
    try {
      if (!req.user) {
        console.log('❌ Backend: User not authenticated');
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { first_name, last_name, role } = req.body;
      const user = req.user as any; // Fix TypeScript issue

      console.log('📊 Backend: Updating user account:', {
        userId: user.id,
        updateData: { first_name, last_name, role }
      });

      await storage.updateUserAccount(user.id, {
        first_name,
        last_name,
        role
      });

      console.log('✅ Backend: Database update completed');

      // Get updated user and apply role computation
      const updatedUser = await storage.getUser(user.id);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const userWithRole = computeUserRole(updatedUser);
      req.user = userWithRole;

      console.log('📤 Backend: Sending response:', {
        id: userWithRole.id,
        email: userWithRole.email,
        first_name: userWithRole.first_name,
        last_name: userWithRole.last_name,
        role: userWithRole.role,
        email_verified: userWithRole.email_verified
      });

      res.json({ 
        user: {
          id: userWithRole.id,
          email: userWithRole.email,
          first_name: userWithRole.first_name,
          last_name: userWithRole.last_name,
          role: userWithRole.role,
          email_verified: userWithRole.email_verified
        }
      });
    } catch (error) {
      console.error("Update account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete account endpoint (authenticated)
  app.delete("/api/auth/delete-account", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: "Password is required to delete account" });
      }

      const user = await storage.getUser((req.user as any).id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify password
      if (!user.password) {
        return res.status(400).json({ error: "Account has no password set" });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Incorrect password" });
      }

      // Delete all user data (using nuclear cleanup - removes all users)
      await nukeAllUserData();

      // Destroy session
      req.logout((err) => {
        if (err) {
          console.error('Logout error during account deletion:', err);
        }
        
        req.session.destroy((sessionErr) => {
          if (sessionErr) {
            console.error('Session destruction error during account deletion:', sessionErr);
          }
          
          res.clearCookie('eventlink.sid');
          res.json({ message: "Account deleted successfully" });
        });
      });

    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}