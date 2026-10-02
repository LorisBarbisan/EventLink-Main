import type { Express } from "express";
import { checkSlugAvailability, setCustomSlug } from "../controllers/slug.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerSlugRoutes(app: Express) {
  app.get("/api/slug/check", checkSlugAvailability);
  app.patch("/api/freelancer/custom-slug", authenticateJWT, setCustomSlug);
}
