import express from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  exportBookingsExcel,
  exportBookingsCsv,
  exportCrewExcel,
  exportCrewCsv,
  exportAvailabilityExcel,
  exportAvailabilityCsv,
} from "../controllers/export.controller.js";

const exportRouter = express.Router();

const auth = [authenticateJWT, requireRole("recruiter")];

exportRouter.get("/bookings/excel", ...auth, exportBookingsExcel);
exportRouter.get("/bookings/csv", ...auth, exportBookingsCsv);
exportRouter.get("/crew/excel", ...auth, exportCrewExcel);
exportRouter.get("/crew/csv", ...auth, exportCrewCsv);
exportRouter.get("/availability/excel", ...auth, exportAvailabilityExcel);
exportRouter.get("/availability/csv", ...auth, exportAvailabilityCsv);

export default exportRouter;
