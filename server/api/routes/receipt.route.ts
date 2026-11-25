import type { Express } from "express";
import { receiptUploadLimiter } from "../middleware/expensive-limit.middleware";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireUkOrOwnRecords } from "../middleware/uk-freelancer.middleware";
import {
  uploadReceipt,
  listReceiptsForExpense,
  listUnattachedReceipts,
  countUnattachedReceipts,
  getReceipt,
  attachReceipt,
  archiveReceipt,
} from "../controllers/receipt.controller";

export function registerReceiptRoutes(app: Express) {
  // Same gate as the rest of Books: writes are UK-only; your own receipts
  // can still be viewed after you leave the UK.
  const auth = [authenticateJWT, requireRole("freelancer")];
  const ownRecords = [authenticateJWT, requireRole("freelancer"), requireUkOrOwnRecords];

  app.post("/api/receipts", ...auth, receiptUploadLimiter, uploadReceipt);
  app.get("/api/receipts/unattached", ...ownRecords, listUnattachedReceipts);
  app.get("/api/receipts/unattached/count", ...ownRecords, countUnattachedReceipts);
  app.get("/api/expenses/:expenseId/receipts", ...ownRecords, listReceiptsForExpense);
  app.get("/api/receipts/:id", ...ownRecords, getReceipt);
  app.patch("/api/receipts/:id/attach", ...auth, attachReceipt);
  app.delete("/api/receipts/:id", ...auth, archiveReceipt);
}
