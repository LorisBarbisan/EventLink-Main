import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertUserSchema, insertFreelancerProfileSchema, insertRecruiterProfileSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role } = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        email,
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
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check password
      const isValid = await bcrypt.compare(password, user.password);
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

  // User profile routes
  app.get("/api/user/:id", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
