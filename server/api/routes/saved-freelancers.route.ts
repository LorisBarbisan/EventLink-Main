import type { Express } from "express";
import {
  getMyCrewFreelancers,
  getSavedFreelancerIds,
  saveFreelancer,
  unsaveFreelancer,
} from "../controllers/saved-freelancers.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerSavedFreelancerRoutes(app: Express) {
  app.post("/api/saved-freelancers", authenticateJWT, saveFreelancer);
  app.delete("/api/saved-freelancers/:freelancerId", authenticateJWT, unsaveFreelancer);
  app.get("/api/saved-freelancers", authenticateJWT, getSavedFreelancerIds);
  app.get("/api/my-crew", authenticateJWT, getMyCrewFreelancers);
}
