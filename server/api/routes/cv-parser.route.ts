import type { Express } from "express";
import {
  confirmCVData,
  getCVParsingStatus,
  rejectCVData,
  reparseCV,
  triggerCVParsing,
} from "../controllers/cv-parser.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerCVParserRoutes(app: Express) {
  app.post("/api/cv/parse", authenticateJWT, triggerCVParsing);
  app.get("/api/cv/parse/status", authenticateJWT, getCVParsingStatus);
  app.post("/api/cv/parse/confirm", authenticateJWT, confirmCVData);
  app.post("/api/cv/parse/reject", authenticateJWT, rejectCVData);
  app.post("/api/cv/reparse", authenticateJWT, reparseCV);
}
