import type { Express } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
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
  const auth = [authenticateJWT, requireRole("freelancer")];

  app.post("/api/receipts", ...auth, uploadReceipt);
  app.get("/api/receipts/unattached", ...auth, listUnattachedReceipts);
  app.get("/api/receipts/unattached/count", ...auth, countUnattachedReceipts);
  app.get("/api/expenses/:expenseId/receipts", ...auth, listReceiptsForExpense);
  app.get("/api/receipts/:id", ...auth, getReceipt);
  app.patch("/api/receipts/:id/attach", ...auth, attachReceipt);
  app.delete("/api/receipts/:id", ...auth, archiveReceipt);
}
