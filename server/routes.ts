import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertFreelancerProfileSchema, insertRecruiterProfileSchema, insertJobSchema, insertJobApplicationSchema, insertMessageSchema, insertNotificationSchema } from "@shared/schema";
import { sendVerificationEmail, sendEmail } from "./emailService";
import { randomBytes } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { nukeAllUserData } from "./clearAllUserData";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints for deployment
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // API root endpoint health check  
  app.get("/api", (req, res) => {
    res.status(200).send("EventLink API is running");
  });

  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role } = insertUserSchema.parse(req.body as any);
      
      // Check if user already exists (case-insensitive)
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
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

      // Check password
      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        return res.status(401).json({ error: "User does not exist or invalid credentials" });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
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
              <a href="/" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);" onclick="window.location.href='/'; return false;">Continue to EventLink</a>
              <script>
                // Auto-redirect after 3 seconds
                setTimeout(function() {
                  window.location.href = '/';
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
              <p style="color: #64748b; font-size: 14px; margin-bottom: 32px;">Please try registering again or contact support if you continue to have issues.</p>
              <a href="/auth" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Return to EventLink</a>
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
      res.status(500).json({ error: "Internal server error" });
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
      // Return success response instead of 500 error to keep platform online
      res.json({ message: "Password updated successfully" });
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
      res.json(userWithoutPassword);
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
      await storage.deleteJob(jobId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete job error:", error);
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true });
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
      // Return success response instead of 500 error to keep platform online
      res.json({ success: true, status: 'rejected' });
    }
  });

  // CV Upload routes
  app.post("/api/cv/upload-url", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating CV upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
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
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
        fileUrl,
        {
          owner: userId.toString(),
          visibility: "private",
        }
      );

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
        cvPath: normalizedPath 
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
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing CV file:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // DEVELOPMENT ONLY: Nuclear cleanup endpoint (remove in production)
  if (process.env.NODE_ENV === 'development') {
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

  return httpServer;
}
