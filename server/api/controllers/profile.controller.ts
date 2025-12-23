import { insertFreelancerProfileSchema, insertRecruiterProfileSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";

// Get user by ID
export async function getUserById(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return user without sensitive information
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, email_verification_token, password_reset_token, ...safeUser } = user;
    // Prevent caching to ensure fresh user data
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json(safeUser);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get freelancer profile
export async function getFreelancerProfile(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await storage.getFreelancerProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }

    // Prevent caching to ensure fresh profile data
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json(profile);
  } catch (error) {
    console.error("Get freelancer profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create freelancer profile
export async function createFreelancerProfile(req: Request, res: Response) {
  try {
    // Verify user is authorized to create profile for this user_id
    const requestedUserId = req.body.user_id;
    if (
      !(req as any).user ||
      ((req as any).user.id !== requestedUserId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to create this profile" });
    }

    const result = insertFreelancerProfileSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Freelancer profile validation failed:", result.error.issues);
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const profile = await storage.createFreelancerProfile(result.data);
    res.status(201).json(profile);
  } catch (error) {
    console.error("Create freelancer profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update freelancer profile
export async function updateFreelancerProfile(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);

    // Check if user is authorized to update this profile
    if (
      !(req as any).user ||
      ((req as any).user.id !== userId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to update this profile" });
    }

    const result = insertFreelancerProfileSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const profile = await storage.updateFreelancerProfile(userId, result.data);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Update freelancer profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get recruiter profile
export async function getRecruiterProfile(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);

    // First check if user exists and is a recruiter
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // If user is not a recruiter, return 404 (not an error, just no profile)
    if (user.role !== "recruiter" && user.role !== "admin") {
      return res.status(404).json({ error: "Recruiter profile not found" });
    }

    const profile = await storage.getRecruiterProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Recruiter profile not found" });
    }

    // Prevent caching to ensure fresh profile data
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json(profile);
  } catch (error) {
    console.error("Get recruiter profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create recruiter profile
export async function createRecruiterProfile(req: Request, res: Response) {
  try {
    // Verify user is authorized to create profile for this user_id
    const requestedUserId = req.body.user_id;
    if (
      !(req as any).user ||
      ((req as any).user.id !== requestedUserId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to create this profile" });
    }

    const result = insertRecruiterProfileSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Recruiter profile validation failed:", result.error.issues);
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const profile = await storage.createRecruiterProfile(result.data);
    res.status(201).json(profile);
  } catch (error) {
    console.error("Create recruiter profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update recruiter profile
export async function updateRecruiterProfile(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);

    // Check if user is authorized to update this profile
    if (
      !(req as any).user ||
      ((req as any).user.id !== userId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to update this profile" });
    }

    const result = insertRecruiterProfileSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const profile = await storage.updateRecruiterProfile(userId, result.data);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Update recruiter profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all freelancers (for recruiter job search)
export async function getAllFreelancers(req: Request, res: Response) {
  try {
    const freelancers = await storage.getAllFreelancerProfiles();
    res.json(freelancers);
  } catch (error) {
    console.error("Get freelancers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Search freelancers with filters and pagination
export async function searchFreelancers(req: Request, res: Response) {
  try {
    const { keyword, location, page, limit } = req.query;

    const filters = {
      keyword: keyword as string | undefined,
      location: location as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    };

    // Validate page and limit
    if (filters.page < 1) filters.page = 1;
    if (filters.limit < 1 || filters.limit > 100) filters.limit = 20;

    console.log("🔍 Searching freelancers with filters:", filters);

    const result = await storage.searchFreelancers(filters);

    console.log(`✅ Search returned ${result.results.length} of ${result.total} total freelancers`);

    res.json(result);
  } catch (error) {
    console.error("Search freelancers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all recruiter profiles (for freelancer contact search)
export async function getAllRecruiterProfiles(req: Request, res: Response) {
  try {
    const recruiters = await storage.getAllRecruiterProfiles();
    res.json(recruiters);
  } catch (error) {
    console.error("Get recruiter profiles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
