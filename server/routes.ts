import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertFreelancerProfileSchema, insertRecruiterProfileSchema, insertJobSchema, insertJobApplicationSchema, insertMessageSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

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
      const jobs = await storage.getAllJobsSortedByDate();
      res.json(jobs);
    } catch (error) {
      console.error("Get all jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/freelancer/:freelancerId/applications", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      const applications = await storage.getFreelancerApplications(freelancerId);
      res.json(applications);
    } catch (error) {
      console.error("Get freelancer applications error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/jobs/:jobId/applications", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const applications = await storage.getJobApplications(jobId);
      res.json(applications);
    } catch (error) {
      console.error("Get job applications error:", error);
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
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
      
      if (!userId || !fileName || !fileUrl) {
        return res.status(400).json({ error: "Missing required fields" });
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
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
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
      res.status(500).json({ error: "Internal server error" });
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
          userId = message.userId;
          if (userId) {
            if (!clients.has(userId)) {
              clients.set(userId, new Set());
            }
            clients.get(userId)!.add(ws);
            console.log(`User ${userId} authenticated and added to WebSocket clients`);
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

  return httpServer;
}
