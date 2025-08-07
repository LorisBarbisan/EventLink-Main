import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertUserSchema, insertFreelancerProfileSchema, insertRecruiterProfileSchema, insertJobSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role } = insertUserSchema.parse(req.body);
      
      // Check if user already exists (case-insensitive)
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user (store email in lowercase)
      const user = await storage.createUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        role
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(400).json({ error: "Invalid input" });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log("Signin attempt for:", email);
      
      // Find user (case-insensitive email lookup)
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        console.log("User not found:", email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      console.log("User found, checking password...");
      // Check password
      const isValid = await bcrypt.compare(password, user.password);
      console.log("Password valid:", isValid);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Signin error:", error);
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
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/freelancer", async (req, res) => {
    try {
      const profile = insertFreelancerProfileSchema.parse(req.body);
      const result = await storage.createFreelancerProfile(profile);
      res.json(result);
    } catch (error) {
      console.error("Create freelancer profile error:", error);
      res.status(400).json({ error: "Invalid input" });
    }
  });

  app.put("/api/freelancer/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = req.body;
      console.log("Profile update data:", {
        userId,
        hasPhoto: !!profile.profile_photo_url,
        photoLength: profile.profile_photo_url ? profile.profile_photo_url.length : 0
      });
      const result = await storage.updateFreelancerProfile(userId, profile);
      res.json(result);
    } catch (error) {
      console.error("Update freelancer profile error:", error);
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/recruiter", async (req, res) => {
    try {
      const profile = insertRecruiterProfileSchema.parse(req.body);
      const result = await storage.createRecruiterProfile(profile);
      res.json(result);
    } catch (error) {
      console.error("Create recruiter profile error:", error);
      res.status(400).json({ error: "Invalid input" });
    }
  });

  app.put("/api/recruiter/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = req.body;
      const result = await storage.updateRecruiterProfile(userId, profile);
      res.json(result);
    } catch (error) {
      console.error("Update recruiter profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all freelancer profiles for job listings
  app.get("/api/freelancers", async (req, res) => {
    try {
      const profiles = await storage.getAllFreelancerProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Get all freelancers error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Job management routes
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Get all jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/jobs/recruiter/:recruiterId", async (req, res) => {
    try {
      const recruiterId = parseInt(req.params.recruiterId);
      const jobs = await storage.getJobsByRecruiterId(recruiterId);
      res.json(jobs);
    } catch (error) {
      console.error("Get recruiter jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      await storage.deleteJob(jobId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
