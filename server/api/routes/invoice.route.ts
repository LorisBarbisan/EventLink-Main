import type { Express } from "express";
import { authenticateJWT, requirePro } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  getBillingProfile,
  upsertBillingProfile,
  listInvoices,
  getInvoice,
  createInvoiceFromBooking,
  createBlankInvoice,
  updateInvoice,
  getInvoicePDF,
  getMessageDraft,
  sendInvoiceViaMessage,
  markSentExternally,
  markInvoicePaid,
  cancelInvoice,
  getReminderDraft,
  recordReminderAction,
  exportInvoicesCSV,
} from "../controllers/invoice.controller";

export function registerInvoiceRoutes(app: Express) {
  const auth = [authenticateJWT, requirePro];
  const freelancer = [...auth, requireRole("freelancer")];

  // Billing profile
  app.get("/api/billing-profile", ...freelancer, getBillingProfile);
  app.put("/api/billing-profile", ...freelancer, upsertBillingProfile);

  // Invoice CRUD
  app.get("/api/invoices", ...freelancer, listInvoices);
  app.get("/api/invoices/export", ...freelancer, exportInvoicesCSV);
  app.get("/api/invoices/:id", ...freelancer, getInvoice);
  app.post("/api/invoices", ...freelancer, createBlankInvoice);
  app.post("/api/invoices/from-booking/:bookingId", ...freelancer, createInvoiceFromBooking);
  app.patch("/api/invoices/:id", ...freelancer, updateInvoice);
  app.delete("/api/invoices/:id", ...freelancer, cancelInvoice);

  // PDF
  app.get("/api/invoices/:id/pdf", ...freelancer, getInvoicePDF);

  // Sending
  app.get("/api/invoices/:id/message-draft", ...freelancer, getMessageDraft);
  app.post("/api/invoices/:id/send-message", ...freelancer, sendInvoiceViaMessage);
  app.post("/api/invoices/:id/mark-sent", ...freelancer, markSentExternally);
  app.post("/api/invoices/:id/mark-paid", ...freelancer, markInvoicePaid);

  // Reminders
  app.get("/api/invoices/:id/reminder-draft", ...freelancer, getReminderDraft);
  app.post("/api/invoices/:id/reminders", ...freelancer, recordReminderAction);
}
