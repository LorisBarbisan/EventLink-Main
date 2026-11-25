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
  vatReturn,
  saveVatPayment,
  deleteVatPayment,
} from "../controllers/books.controller";
import {
  listRemovedHandler,
  restoreHandler,
  resetCountsHandler,
  resetHandler,
} from "../controllers/undo.controller";

export function registerBooksRoutes(app: Express) {
  // Bookkeeping surfaces (P&L summary, monthly chart, expense categories,
  // overdue sync, undo) are open to every freelancer, UK or not.
  const anyFreelancer = [authenticateJWT, requireRole("freelancer")];
  // UK tax surfaces only: tax estimate, Making Tax Digital quarters, VAT return.
  const ukAuth = [authenticateJWT, requireRole("freelancer"), requireUkFreelancer];
  // Your own records can always be downloaded, whatever your country now says
  const ownRecords = [authenticateJWT, requireRole("freelancer"), requireUkOrOwnRecords];

  // workbook export registered before the CSV path so the more specific path wins
  app.get("/api/books/export.xlsx", ...ownRecords, expensiveWorkLimiter, booksExportWorkbook);
  // export must be registered before summary to avoid any future path conflicts
  app.get("/api/books/export", ...ownRecords, expensiveWorkLimiter, booksExport);
  app.get("/api/books/summary", ...anyFreelancer, booksSummary);
  app.get("/api/books/tax-estimate", ...ukAuth, taxEstimate);
  app.get("/api/books/monthly", ...anyFreelancer, booksMonthly);
  app.get("/api/books/expense-categories", ...anyFreelancer, booksExpenseCategories);
  app.get("/api/books/quarterly", ...ukAuth, booksQuarterly);
  app.post("/api/books/sync-overdue", ...anyFreelancer, syncOverdue);
  app.get("/api/books/vat-return", ...ukAuth, vatReturn);
  app.put("/api/books/vat-payments", ...ukAuth, saveVatPayment);
  app.delete("/api/books/vat-payments/:id", ...ukAuth, deleteVatPayment);

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
  app.get("/api/books/removed", ...anyFreelancer, listRemovedHandler);
  app.post("/api/books/removed/:table/:id/restore", ...anyFreelancer, restoreHandler);
  app.get("/api/books/start-again", ...anyFreelancer, resetCountsHandler);
  app.post("/api/books/start-again", ...anyFreelancer, resetHandler);
}
