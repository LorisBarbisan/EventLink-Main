import type { Express } from "express";
import multer from "multer";
import {
  createPortfolioPost,
  deletePortfolioPost,
  getPortfolioPosts,
  servePortfolioFile,
  updatePortfolioPost,
  uploadPortfolioFile,
} from "../controllers/portfolio.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function registerPortfolioRoutes(app: Express) {
  app.get("/api/portfolio", getPortfolioPosts);
  app.get("/api/portfolio/file/*", servePortfolioFile);
  app.post("/api/portfolio/upload", authenticateJWT, upload.single("file"), uploadPortfolioFile);
  app.post("/api/portfolio", authenticateJWT, createPortfolioPost);
  app.patch("/api/portfolio/:id", authenticateJWT, updatePortfolioPost);
  app.delete("/api/portfolio/:id", authenticateJWT, deletePortfolioPost);
}
