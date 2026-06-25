import { insertFreelancerProfileSchema, insertRecruiterProfileSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";
import sharp from "sharp";
import { canManageTeam, getEmployerCompanyId } from "../utils/team.util";
import { isLocalPath, resolveLocalPath } from "../utils/local-storage-fallback";

/** Company owner or team admin may create/update recruiter_profiles (keyed by owner user_id). */
function canWriteRecruiterProfile(req: Request, profileUserId: number): boolean {
  const user = (req as any).user;
  if (!user) return false;
  if (user.role === "admin") return true;
  const companyId = getEmployerCompanyId(req);
  if (companyId !== profileUserId) return false;
  return user.id === profileUserId || canManageTeam((req as any).teamRole);
}

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

// Serve freelancer profile photo as a real image (for OG tags / social previews)
export async function getProfilePhoto(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);
    const profile = await storage.getFreelancerProfile(userId);

    if (!profile || !profile.profile_photo_url) {
      return res.status(404).end();
    }

    const photoUrl = profile.profile_photo_url;

    // If it's an external HTTP URL (e.g. Google/LinkedIn OAuth avatar), redirect to it
    if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
      return res.redirect(302, photoUrl);
    }

    // If it's a base64 data URL, decode, convert to JPEG, and serve
    if (photoUrl.startsWith("data:")) {
      const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return res.status(400).end();
      const imageData = Buffer.from(match[2], "base64");
      const jpegData = await sharp(imageData).jpeg({ quality: 85 }).toBuffer();
      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(jpegData);
    }

    // If it's a local disk file, read and serve it
    if (isLocalPath(photoUrl)) {
      const { promises: fs } = await import("fs");
      const filePath = resolveLocalPath(photoUrl);
      try {
        const fileData = await fs.readFile(filePath);
        const jpegData = await sharp(fileData).jpeg({ quality: 85 }).toBuffer();
        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(jpegData);
      } catch {
        return res.status(404).end();
      }
    }

    return res.status(404).end();
  } catch (error) {
    console.error("Profile photo error:", error);
    res.status(500).end();
  }
}

// Get freelancer profile — accepts numeric userId OR a slug string
export async function getFreelancerProfile(req: Request, res: Response) {
  try {
    const param = req.params.userId;
    const userId = parseInt(param, 10);

    const profile = isNaN(userId)
      ? await storage.getFreelancerProfileBySlug(param)
      : await storage.getFreelancerProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }

    // Include reference_token only for the profile owner — it's used to generate
    // scoped share links that grant public document access for this specific profile.
    const requestingUserId = (req as any).user?.id;
    const isOwner = requestingUserId === profile.user_id;

    // Ensure the owner always has a reference token so share/QR links work
    let resolvedProfile = profile;
    if (isOwner && !profile.reference_token) {
      try {
        await storage.getOrCreateReferenceToken(profile.user_id);
        resolvedProfile = (await storage.getFreelancerProfile(profile.user_id)) ?? profile;
      } catch {
        // non-fatal: profile still returned without token
      }
    }

    const responseProfile = isOwner
      ? resolvedProfile
      : { ...resolvedProfile, reference_token: undefined };

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.json(responseProfile);
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

    console.log("Update payload received:", req.body);
    const result = insertFreelancerProfileSchema.partial().safeParse(req.body);
    if (!result.success) {
      console.error("Validation failed:", result.error);
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }
    console.log("Parsed payload:", result.data);

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
      return res.status(404).json({ error: "Employer profile not found" });
    }

    const profile = await storage.getRecruiterProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "Employer profile not found" });
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
    const requestedUserId = parseInt(String(req.body.user_id), 10);
    if (!canWriteRecruiterProfile(req, requestedUserId)) {
      return res.status(403).json({
        error: "Only the company owner or a team admin can create or update the company profile",
      });
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

    if (!canWriteRecruiterProfile(req, userId)) {
      return res.status(403).json({
        error: "Only the company owner or a team admin can create or update the company profile",
      });
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
    const { keyword, location, country, page, limit } = req.query;

    const filters = {
      keyword: keyword as string | undefined,
      location: location as string | undefined,
      country: country as string | undefined,
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
