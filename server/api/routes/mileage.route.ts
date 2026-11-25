import type { Express } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  getRate,
  listSavedPlaces,
  createSavedPlace,
  deleteSavedPlace,
  listTrips,
  createTrip,
  updateTrip,
  archiveTrip,
} from "../controllers/mileage.controller";

export function registerMileageRoutes(app: Express) {
  const auth = [authenticateJWT, requireRole("freelancer")];

  app.get("/api/mileage/rate", ...auth, getRate);
  app.get("/api/mileage/places", ...auth, listSavedPlaces);
  app.post("/api/mileage/places", ...auth, createSavedPlace);
  app.delete("/api/mileage/places/:id", ...auth, deleteSavedPlace);
  app.get("/api/mileage/trips", ...auth, listTrips);
  app.post("/api/mileage/trips", ...auth, createTrip);
  app.patch("/api/mileage/trips/:id", ...auth, updateTrip);
  app.delete("/api/mileage/trips/:id", ...auth, archiveTrip);
}
