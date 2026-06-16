import type { Express } from "express";
import { checkSlugAvailability, setCustomSlug } from "../controllers/slug.controller";

export function registerSlugRoutes(app: Express) {
  app.get("/api/slug/check", checkSlugAvailability);
  app.patch("/api/freelancer/custom-slug", setCustomSlug);
}
