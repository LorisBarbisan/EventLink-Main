import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireFmsAccess } from "../middleware/subscription.middleware";
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  sendQuote,
  acceptQuote,
  quoteToInvoice,
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  markInvoicePaid,
} from "../controllers/invoice.controller";

const router = Router();
const auth = [authenticateJWT, requireRole("employer"), requireFmsAccess];

// Quotes
router.get("/quotes", ...auth, listQuotes);
router.post("/quotes", ...auth, createQuote);
router.get("/quotes/:id", ...auth, getQuote);
router.put("/quotes/:id", ...auth, updateQuote);
router.delete("/quotes/:id", ...auth, deleteQuote);
router.post("/quotes/:id/send", ...auth, sendQuote);
router.post("/quotes/:id/to-invoice", ...auth, quoteToInvoice);

// Public quote acceptance (client accepts without logging in)
router.post("/quotes/:id/accept", acceptQuote);

// Invoices
router.get("/invoices", ...auth, listInvoices);
router.post("/invoices", ...auth, createInvoice);
router.get("/invoices/:id", ...auth, getInvoice);
router.put("/invoices/:id", ...auth, updateInvoice);
router.delete("/invoices/:id", ...auth, deleteInvoice);
router.post("/invoices/:id/send", ...auth, sendInvoice);
router.post("/invoices/:id/paid", ...auth, markInvoicePaid);

export default router;
