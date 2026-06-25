import type { Express } from "express";
import {
  createFreelancerProfile,
  createRecruiterProfile,
  getAllFreelancers,
  getAllRecruiterProfiles,
  getCardToken,
  getFreelancerProfile,
  getProfilePhoto,
  getRecruiterProfile,
  getUserById,
  searchFreelancers,
  updateFreelancerProfile,
  updateRecruiterProfile,
} from "../controllers/profile.controller";
import { authenticateJWT } from "../middleware/auth.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";

export function registerProfileRoutes(app: Express) {
  // Get user by ID
  app.get("/api/users/:id", getUserById);

  // Serve freelancer profile photo as a real image (used by OG tags for social previews)
  app.get("/api/profile-photo/:userId", getProfilePhoto);

  // Get/create card share token for the authenticated freelancer (must be before /:userId)
  app.get("/api/freelancer/card-token", authenticateJWT, getCardToken);

  // Get freelancer profile
  app.get("/api/freelancer/:userId", getFreelancerProfile);

  // Create freelancer profile
  app.post("/api/freelancer", authenticateJWT, createFreelancerProfile);

  // Update freelancer profile
  app.put("/api/freelancer/:userId", authenticateJWT, updateFreelancerProfile);

  // Get recruiter profile
  app.get("/api/recruiter/:userId", getRecruiterProfile);

  // Create recruiter profile
  app.post("/api/recruiter", authenticateJWT, resolveCompanyId, createRecruiterProfile);

  // Update recruiter profile
  app.put("/api/recruiter/:userId", authenticateJWT, resolveCompanyId, updateRecruiterProfile);

  // Get all freelancers (for recruiter job search)
  app.get("/api/freelancers", getAllFreelancers);

  // Search freelancers with filters and pagination
  app.get("/api/freelancers/search", searchFreelancers);

  // Get all recruiter profiles (for freelancer contact search)
  app.get("/api/recruiter-profiles", getAllRecruiterProfiles);
}
