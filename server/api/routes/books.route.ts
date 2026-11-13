import type { Express } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  booksSummary,
  booksExport,
  booksExportWorkbook,
  taxEstimate,
  booksMonthly,
  booksExpenseCategories,
  booksQuarterly,
  syncOverdue,
} from "../controllers/books.controller";

export function registerBooksRoutes(app: Express) {
  const auth = [authenticateJWT, requireRole("freelancer")];

  // workbook export registered before the CSV path so the more specific path wins
  app.get("/api/books/export.xlsx", ...auth, booksExportWorkbook);
  // export must be registered before summary to avoid any future path conflicts
  app.get("/api/books/export", ...auth, booksExport);
  app.get("/api/books/summary", ...auth, booksSummary);
  app.get("/api/books/tax-estimate", ...auth, taxEstimate);
  app.get("/api/books/monthly", ...auth, booksMonthly);
  app.get("/api/books/expense-categories", ...auth, booksExpenseCategories);
  app.get("/api/books/quarterly", ...auth, booksQuarterly);
  app.post("/api/books/sync-overdue", ...auth, syncOverdue);
}
