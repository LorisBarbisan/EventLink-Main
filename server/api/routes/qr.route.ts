import type { Express } from "express";
import { getProfileQR } from "../controllers/qr.controller";

export function registerQRRoutes(app: Express) {
  // Generate QR code PNG for a freelancer profile — public, no auth required
  app.get("/api/qr/:userId", getProfileQR);
}
