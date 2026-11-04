import type { Express } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { booksSummary, booksExport } from "../controllers/books.controller";

export function registerBooksRoutes(app: Express) {
  const auth = [authenticateJWT, requireRole("freelancer")];

  // export must be registered before summary to avoid any future path conflicts
  app.get("/api/books/export", ...auth, booksExport);
  app.get("/api/books/summary", ...auth, booksSummary);
}
