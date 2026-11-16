import type { Express } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireUkFreelancer } from "../middleware/uk-freelancer.middleware";
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
import {
  listRemovedHandler,
  restoreHandler,
  resetCountsHandler,
  resetHandler,
} from "../controllers/undo.controller";

export function registerBooksRoutes(app: Express) {
  const auth = [authenticateJWT, requireRole("freelancer"), requireUkFreelancer];

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

  // Undo: recently removed, restore, start again (archive-only; see undo.service)
  app.get("/api/books/removed", ...auth, listRemovedHandler);
  app.post("/api/books/removed/:table/:id/restore", ...auth, restoreHandler);
  app.get("/api/books/start-again", ...auth, resetCountsHandler);
  app.post("/api/books/start-again", ...auth, resetHandler);
}
