import type { Express } from "express";
import { expensiveWorkLimiter } from "../middleware/expensive-limit.middleware";
import { storage } from "../../storage";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireUkFreelancer, requireUkOrOwnRecords } from "../middleware/uk-freelancer.middleware";
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
  // Your own records can always be downloaded, whatever your country now says
  const ownRecords = [authenticateJWT, requireRole("freelancer"), requireUkOrOwnRecords];

  // workbook export registered before the CSV path so the more specific path wins
  app.get("/api/books/export.xlsx", ...ownRecords, expensiveWorkLimiter, booksExportWorkbook);
  // export must be registered before summary to avoid any future path conflicts
  app.get("/api/books/export", ...ownRecords, expensiveWorkLimiter, booksExport);
  app.get("/api/books/summary", ...auth, booksSummary);
  app.get("/api/books/tax-estimate", ...auth, taxEstimate);
  app.get("/api/books/monthly", ...auth, booksMonthly);
  app.get("/api/books/expense-categories", ...auth, booksExpenseCategories);
  app.get("/api/books/quarterly", ...auth, booksQuarterly);
  app.post("/api/books/sync-overdue", ...auth, syncOverdue);

  // Not UK-gated: tells a freelancer whose Books are hidden that they still
  // have records to download.
  app.get(
    "/api/books/records-held",
    authenticateJWT,
    requireRole("freelancer"),
    async (req, res) => {
      try {
        res.json({ has_records: await storage.hasBooksRecords(req.user!.id) });
      } catch {
        res.json({ has_records: false });
      }
    }
  );

  // Undo: recently removed, restore, start again (archive-only; see undo.service)
  app.get("/api/books/removed", ...auth, listRemovedHandler);
  app.post("/api/books/removed/:table/:id/restore", ...auth, restoreHandler);
  app.get("/api/books/start-again", ...auth, resetCountsHandler);
  app.post("/api/books/start-again", ...auth, resetHandler);
}
