import type { Express } from "express";
import {
  getMyCrewFreelancers,
  getSavedFreelancerIds,
  saveFreelancer,
  unsaveFreelancer,
} from "../controllers/saved-freelancers.controller";
import { authenticateJWT } from "../middleware/auth.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";

export function registerSavedFreelancerRoutes(app: Express) {
  app.post("/api/saved-freelancers", authenticateJWT, resolveCompanyId, saveFreelancer);
  app.delete("/api/saved-freelancers/:freelancerId", authenticateJWT, resolveCompanyId, unsaveFreelancer);
  app.get("/api/saved-freelancers", authenticateJWT, resolveCompanyId, getSavedFreelancerIds);
  app.get("/api/my-crew", authenticateJWT, resolveCompanyId, getMyCrewFreelancers);
}
