import type { Request, Response } from "express";
import { storage } from "../../storage";
import { parseRateToPence, deriveQuantity } from "../utils/invoice-parsing";
import { renderInvoicePDF, storeInvoicePDF } from "../services/invoice-pdf.service";
import {
  linkInvoiceToEntry,
  recordInvoicePaid,
  unlinkInvoiceFromEntry,
} from "../services/earnings.service";
import { ObjectStorageService } from "../utils/object-storage";
import { insertMessageSchema, bookings, jobs } from "@shared/schema";
import { db } from "../config/db";
import { eq } from "drizzle-orm";

// ── Billing profile ────────────────────────────────────────────────────────────

export async function getBillingProfile(req: Request, res: Response) {
  const user = (req as any).user;
  const profile = await storage.getBillingProfile(user.id);
  return res.json(profile ?? null);
}

export async function upsertBillingProfile(req: Request, res: Response) {
  const user = (req as any).user;
  const {
    trading_name,
    address_line1,
    address_line2,
    city,
    postcode,
    country,
    phone,
    email,
    utr,
    company_number,
    bank_account_name,
    bank_sort_code,
    bank_account_number,
    bank_iban,
    payment_terms_days,
    invoice_prefix,
    invoice_footer_note,
  } = req.body;

  // Validate payment_terms_days if present
  if (payment_terms_days !== undefined) {
    const n = Number(payment_terms_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      return res.status(400).json({ error: "payment_terms_days must be an integer 0–365" });
    }
  }

  // Never log or return raw bank details — accept but don't echo them
  const data: any = {
    trading_name,
    address_line1,
    address_line2,
    city,
    postcode,
    country,
    phone,
    email,
    utr,
    company_number,
    invoice_footer_note,
  };
  if (bank_account_name !== undefined) data.bank_account_name = bank_account_name;
  if (bank_sort_code !== undefined) data.bank_sort_code = bank_sort_code;
  if (bank_account_number !== undefined) data.bank_account_number = bank_account_number;
  if (bank_iban !== undefined) data.bank_iban = bank_iban;
  if (payment_terms_days !== undefined) data.payment_terms_days = Number(payment_terms_days);
  if (invoice_prefix !== undefined) data.invoice_prefix = String(invoice_prefix).slice(0, 10);

  const saved = await storage.upsertBillingProfile(user.id, data);
  return res.json(maskBankDetails(saved));
}

// ── Invoice list / detail ─────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response) {
  const user = (req as any).user;
  const { status } = req.query;
  const list = await storage.getInvoicesByFreelancer(user.id, status as string | undefined);
  return res.json(list);
}

export async function getInvoice(req: Request, res: Response) {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const invoice = await storage.getInvoice(id);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
  return res.json(invoice);
}

// ── Generate from booking ─────────────────────────────────────────────────────

export async function createInvoiceFromBooking(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) return res.status(400).json({ error: "Invalid booking id" });

    const [bookingRow] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!bookingRow) return res.status(404).json({ error: "Booking not found" });
    if (bookingRow.freelancerId !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (bookingRow.status !== "completed")
      return res.status(400).json({ error: "Booking must be completed" });

    const existing = await storage.getInvoiceByBooking(bookingId);
    if (existing)
      return res
        .status(409)
        .json({ error: "Invoice already exists for this booking", invoiceId: existing.id });

    // Load related data
    const [billingProfile, jobRows] = await Promise.all([
      storage.getBillingProfile(user.id),
      db.select().from(jobs).where(eq(jobs.id, bookingRow.jobId)).limit(1),
    ]);
    const job = jobRows[0] ?? null;
    const booking = bookingRow;

    if (!billingProfile) {
      return res.status(422).json({
        error: "Please set up your billing profile before creating an invoice",
        code: "NO_BILLING_PROFILE",
      });
    }

    const recruiterProfile = await storage.getRecruiterProfile(booking.employerId);
    const employerUser = await storage.getUser(booking.employerId);

    // Parse rate
    const rateRaw = booking.agreedRate ?? job?.rate ?? null;
    const parsed = parseRateToPence(rateRaw);

    // Derive quantity
    const qty = job ? deriveQuantity(job) : { quantity: 1, unit: "job" as const, confident: false };

    const unitPence = parsed.pence;
    const totalPence = unitPence != null ? Math.round(unitPence * qty.quantity) : null;

    const lineItem = {
      description: job?.title ?? "Freelance services",
      quantity: qty.quantity,
      unit: qty.unit,
      unit_price_pence: unitPence,
      total_pence: totalPence,
      confident: parsed.confident && qty.confident,
      rate_raw: parsed.raw,
    };

    // Build from / to details
    const fromDetails = {
      name:
        billingProfile.trading_name ?? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
      address_line1: billingProfile.address_line1,
      address_line2: billingProfile.address_line2,
      city: billingProfile.city,
      postcode: billingProfile.postcode,
      country: billingProfile.country,
      email: billingProfile.email,
      phone: billingProfile.phone,
      utr: billingProfile.utr,
    };

    const toDetails = {
      company_name: recruiterProfile?.company_name ?? employerUser?.email ?? "",
      contact_name: recruiterProfile?.contact_name ?? null,
      email: employerUser?.email ?? null,
    };

    const today = new Date().toISOString().slice(0, 10);
    const dueDate = addDays(today, billingProfile.payment_terms_days);

    // Allocate number inside transaction
    const invoiceNumber = await storage.allocateInvoiceNumber(billingProfile.id);

    const invoice = await storage.createInvoice({
      freelancer_id: user.id,
      booking_id: bookingId,
      invoice_number: invoiceNumber,
      status: "draft",
      from_details: fromDetails as any,
      to_details: toDetails as any,
      line_items: [lineItem] as any,
      currency: booking.currency ?? job?.currency ?? "GBP",
      subtotal_pence: totalPence ?? 0,
      vat_pence: 0,
      total_pence: totalPence ?? 0,
      issue_date: today,
      due_date: dueDate,
    });

    // Link earnings entry to invoice (non-blocking)
    linkInvoiceToEntry(invoice).catch(() => {});

    // Generate initial PDF
    try {
      const pdfBuffer = await renderInvoicePDF({ invoice, billingProfile });
      const pdfKey = await storeInvoicePDF(user.id, invoice.id, pdfBuffer);
      await storage.updateInvoice(invoice.id, { pdf_key: pdfKey });
      (invoice as any).pdf_key = pdfKey;
    } catch (pdfErr) {
      console.error("PDF generation failed (non-fatal):", pdfErr);
    }

    const lowConfidence = !lineItem.confident;
    return res.status(201).json({ invoice, lowConfidence });
  } catch (err) {
    console.error("createInvoiceFromBooking error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Blank invoice ─────────────────────────────────────────────────────────────

export async function createBlankInvoice(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const billingProfile = await storage.getBillingProfile(user.id);
    if (!billingProfile) {
      return res
        .status(422)
        .json({ error: "Please set up your billing profile first", code: "NO_BILLING_PROFILE" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const dueDate = addDays(today, billingProfile.payment_terms_days);
    const invoiceNumber = await storage.allocateInvoiceNumber(billingProfile.id);

    const fromDetails = {
      name:
        billingProfile.trading_name ?? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
    };

    const invoice = await storage.createInvoice({
      freelancer_id: user.id,
      invoice_number: invoiceNumber,
      status: "draft",
      from_details: fromDetails as any,
      to_details: {} as any,
      line_items: [] as any,
      currency: "GBP",
      subtotal_pence: 0,
      vat_pence: 0,
      total_pence: 0,
      issue_date: today,
      due_date: dueDate,
    });

    return res.status(201).json(invoice);
  } catch (err) {
    console.error("createBlankInvoice error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Edit draft ────────────────────────────────────────────────────────────────

export async function updateInvoice(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (invoice.status !== "draft")
      return res.status(409).json({
        error:
          "Only draft invoices can be edited. To correct a sent invoice, cancel it and create a new one.",
      });

    const {
      from_details,
      to_details,
      line_items,
      currency,
      subtotal_pence,
      vat_pence,
      total_pence,
      issue_date,
      due_date,
      notes,
    } = req.body;
    const updates: any = {};
    if (from_details !== undefined) updates.from_details = from_details;
    if (to_details !== undefined) updates.to_details = to_details;
    if (line_items !== undefined) updates.line_items = line_items;
    if (currency !== undefined) updates.currency = currency;
    if (subtotal_pence !== undefined) updates.subtotal_pence = subtotal_pence;
    if (vat_pence !== undefined) updates.vat_pence = 0; // v1: always 0
    if (total_pence !== undefined) updates.total_pence = total_pence;
    if (issue_date !== undefined) updates.issue_date = issue_date;
    if (due_date !== undefined) updates.due_date = due_date;
    if (notes !== undefined) updates.notes = notes;

    const updated = await storage.updateInvoice(id, updates);

    // Regenerate PDF on edit
    if (updated) {
      try {
        const billingProfile = await storage.getBillingProfile(user.id);
        if (billingProfile) {
          const pdfBuffer = await renderInvoicePDF({ invoice: updated, billingProfile });
          const pdfKey = await storeInvoicePDF(user.id, id, pdfBuffer);
          await storage.updateInvoice(id, { pdf_key: pdfKey });
        }
      } catch (pdfErr) {
        console.error("PDF regeneration failed (non-fatal):", pdfErr);
      }
    }

    return res.json(updated);
  } catch (err) {
    console.error("updateInvoice error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── PDF download ──────────────────────────────────────────────────────────────

export async function getInvoicePDF(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    // Always regenerate and stream directly — avoids R2 CORS issues on redirect
    const billingProfile = await storage.getBillingProfile(user.id);
    if (!billingProfile) return res.status(422).json({ error: "Billing profile not set up" });
    const pdfBuffer = await renderInvoicePDF({ invoice, billingProfile });
    // Store in background (non-blocking)
    storeInvoicePDF(user.id, id, pdfBuffer)
      .then((key) => storage.updateInvoice(id, { pdf_key: key }))
      .catch((e) => console.error("PDF store failed (non-fatal):", e));
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("getInvoicePDF error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Message draft ─────────────────────────────────────────────────────────────

export async function getMessageDraft(req: Request, res: Response) {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const invoice = await storage.getInvoice(id);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });

  const to = (invoice.to_details as any) ?? {};
  const fromName = ((invoice.from_details as any) ?? {}).name ?? "the freelancer";
  const clientName = to.company_name ?? to.contact_name ?? "there";
  const currency = invoice.currency ?? "GBP";
  const total =
    invoice.total_pence != null ? formatMoney(invoice.total_pence, currency) : "(amount TBC)";
  const dueStr = invoice.due_date
    ? `due ${fmtDate(invoice.due_date)}`
    : "payment due as per our terms";

  const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const eventDesc = lineItems[0]?.description ?? "the services provided";

  let payment = "";
  if (invoice.notes) payment = `\n\nPayment details and terms are included in the attached PDF.`;

  const text = `Hi ${clientName},

Please find attached invoice ${invoice.invoice_number} for ${eventDesc} — ${total}, ${dueStr}.

If you have any questions please don't hesitate to get in touch.${payment}

Thanks,
${fromName}`;

  return res.json({ text });
}

// ── Send through messaging ────────────────────────────────────────────────────

export async function sendInvoiceViaMessage(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (invoice.status !== "draft") return res.status(409).json({ error: "Invoice already sent" });

    const { message: bodyText } = req.body;
    if (!bodyText || typeof bodyText !== "string" || !bodyText.trim()) {
      return res.status(400).json({ error: "message body is required" });
    }

    // Resolve recipient
    let recipientUserId: number;
    if (invoice.booking_id) {
      const [bRow] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, invoice.booking_id))
        .limit(1);
      if (!bRow) return res.status(422).json({ error: "Booking not found" });
      recipientUserId = bRow.employerId;
    } else {
      const explicit = parseInt(req.body.recipient_user_id);
      if (isNaN(explicit))
        return res
          .status(400)
          .json({ error: "recipient_user_id required for invoices without a booking" });
      const recipient = await storage.getUser(explicit);
      if (!recipient) return res.status(404).json({ error: "Recipient user not found" });
      recipientUserId = explicit;
    }

    // Get or create conversation
    const conversation = await storage.getOrCreateConversation(user.id, recipientUserId);

    // Create the message
    const msgData = {
      conversation_id: conversation.id,
      sender_id: user.id,
      content: bodyText.trim(),
      is_read: false,
      is_system_message: false,
    };
    const parsed = insertMessageSchema.safeParse(msgData);
    if (!parsed.success) return res.status(400).json({ error: "Invalid message data" });
    const message = await storage.sendMessage(parsed.data);

    // Attach the PDF — this is EventLink-generated, not user-uploaded; skip scan queue
    if (invoice.pdf_key) {
      try {
        // Get size for the attachment record
        const pdfBuffer = await ObjectStorageService.downloadObjectBuffer(invoice.pdf_key);
        await storage.createMessageAttachment({
          message_id: message.id,
          object_path: invoice.pdf_key,
          original_filename: `${invoice.invoice_number}.pdf`,
          file_type: "application/pdf",
          file_size: pdfBuffer.length,
          scan_status: "safe" as const,
          moderation_status: "approved" as const,
        });

        // Try to attach PDF to the notification email (fail soft)
        const PDF_EMAIL_CAP = 8 * 1024 * 1024; // 8 MB
        if (pdfBuffer.length <= PDF_EMAIL_CAP) {
          (message as any)._pdfAttachment = {
            content: pdfBuffer.toString("base64"),
            filename: `${invoice.invoice_number}.pdf`,
            type: "application/pdf",
            disposition: "attachment" as const,
          };
        }
      } catch (attachErr) {
        console.error("Invoice PDF attachment failed (non-fatal):", attachErr);
      }
    }

    // Fire notification email via existing message path
    try {
      const { emailService } = await import("../utils/emailNotificationService");
      const recipient = await storage.getUser(recipientUserId);
      if (recipient) {
        const freelancerProfile = await storage.getFreelancerProfile(user.id);
        const senderName = freelancerProfile
          ? `${freelancerProfile.first_name ?? ""} ${freelancerProfile.last_name ?? ""}`.trim() ||
            user.email
          : user.email;

        const pdfAtt = (message as any)._pdfAttachment;
        await emailService.sendMessageNotification({
          recipientId: recipientUserId,
          recipientEmail: recipient.email,
          recipientName: recipient.email,
          senderName,
          messagePreview: bodyText.substring(0, 100),
          conversationId: conversation.id,
          emailSubject: `Invoice ${invoice.invoice_number} from ${senderName}`,
          ...(pdfAtt ? { attachments: [pdfAtt] } : {}),
        } as any);
      }
    } catch (emailErr) {
      console.error("Invoice notification email failed (non-fatal):", emailErr);
    }

    // Mark invoice sent
    await storage.markInvoiceSent(id, message.id, false);

    return res.json({ messageId: message.id, conversationId: conversation.id });
  } catch (err) {
    console.error("sendInvoiceViaMessage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Mark sent externally ──────────────────────────────────────────────────────

export async function markSentExternally(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (invoice.status !== "draft") return res.status(409).json({ error: "Invoice already sent" });
    const updated = await storage.markInvoiceSent(id, 0, true);
    return res.json(updated);
  } catch (err) {
    console.error("markSentExternally error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Mark paid ─────────────────────────────────────────────────────────────────

export async function markInvoicePaid(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return res.status(409).json({ error: `Invoice is already ${invoice.status}` });
    }
    const { amount_pence, paid_date } = req.body;
    const paidAt = paid_date ? new Date(paid_date) : undefined;
    const updated = await storage.markInvoicePaid(id, amount_pence, paidAt);
    if (updated) recordInvoicePaid(updated).catch(() => {});
    return res.json(updated);
  } catch (err) {
    console.error("markInvoicePaid error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Cancel ─────────────────────────────────────────────────────────────────────

export async function cancelInvoice(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (invoice.status === "paid")
      return res.status(409).json({ error: "Cannot cancel a paid invoice" });
    const updated = await storage.updateInvoice(id, { status: "cancelled" });
    unlinkInvoiceFromEntry(id).catch(() => {});
    return res.json(updated);
  } catch (err) {
    console.error("cancelInvoice error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function archiveInvoice(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    if (invoice.status === "draft")
      return res.status(409).json({ error: "Delete drafts rather than archiving them" });
    const updated = await storage.updateInvoice(id, { archived: true } as any);
    return res.json(updated);
  } catch (err) {
    console.error("archiveInvoice error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Reminder draft ────────────────────────────────────────────────────────────

const REMINDER_TONES: Record<string, string> = {
  due_soon:
    "This is a friendly reminder that the invoice above is due in 3 days. Please let me know if you have any questions.",
  overdue_1:
    "I hope all is well. I wanted to flag that invoice {{number}} became due yesterday. If payment has already been sent, please disregard this message. If not, could you let me know when I can expect it?",
  overdue_7:
    "I'm following up on invoice {{number}}, which is now 7 days overdue. Could you please confirm a payment date so I can update my records?",
  overdue_14:
    "Invoice {{number}} remains unpaid, now 14 days past the due date. I'd be grateful if you could arrange payment or get in touch to discuss any issues.",
  final:
    "Invoice {{number}} is now 30 days overdue. I am writing to formally request payment in accordance with the agreed terms. If payment is not received within the next 7 days I will need to consider next steps.\n\n(Note: Under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest may be applicable on overdue amounts. Whether to pursue this is your decision — this is information, not legal advice.)",
};

export async function getReminderDraft(req: Request, res: Response) {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  const stage = req.query.stage as string;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  if (!REMINDER_TONES[stage]) return res.status(400).json({ error: "Invalid stage" });

  const invoice = await storage.getInvoice(id);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });

  const to = (invoice.to_details as any) ?? {};
  const clientName = to.company_name ?? to.contact_name ?? "there";
  const fromDetails = (invoice.from_details as any) ?? {};
  const fromName = fromDetails.name ?? user.email;
  const currency = invoice.currency ?? "GBP";
  const total = invoice.total_pence != null ? formatMoney(invoice.total_pence, currency) : "";

  const tone = REMINDER_TONES[stage].replace(/\{\{number\}\}/g, invoice.invoice_number);

  const text = `Hi ${clientName},

Re: Invoice ${invoice.invoice_number}${total ? ` — ${total}` : ""}${invoice.due_date ? ` (due ${fmtDate(invoice.due_date)})` : ""}

${tone}

Thanks,
${fromName}`;

  return res.json({ text, stage });
}

export async function recordReminderAction(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const { stage, action, message_id } = req.body;
    const validStages = ["due_soon", "overdue_1", "overdue_7", "overdue_14", "final"];
    const validActions = ["sent", "copied", "dismissed", "snoozed"];
    if (!validStages.includes(stage)) return res.status(400).json({ error: "Invalid stage" });
    if (!validActions.includes(action)) return res.status(400).json({ error: "Invalid action" });

    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    if (invoice.freelancer_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    const reminder = await storage.recordReminder({
      invoice_id: id,
      stage,
      action,
      message_id: message_id ?? null,
    });
    return res.json(reminder);
  } catch (err) {
    console.error("recordReminderAction error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Export CSV ─────────────────────────────────────────────────────────────────

export async function exportInvoicesCSV(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { from, to } = req.query as { from?: string; to?: string };

    let list = await storage.getInvoicesByFreelancer(user.id);

    if (from) list = list.filter((inv) => inv.issue_date && inv.issue_date >= from);
    if (to) list = list.filter((inv) => inv.issue_date && inv.issue_date <= to);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Invoices");

    ws.columns = [
      { header: "Invoice Number", key: "number", width: 18 },
      { header: "Issue Date", key: "issue_date", width: 14 },
      { header: "Due Date", key: "due_date", width: 14 },
      { header: "Client", key: "client", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Net", key: "net", width: 14 },
      { header: "VAT", key: "vat", width: 14 },
      { header: "Gross", key: "gross", width: 14 },
      { header: "Paid Date", key: "paid_date", width: 14 },
      { header: "Status", key: "status", width: 12 },
    ];

    for (const inv of list) {
      const to_d = (inv.to_details as any) ?? {};
      const lineItems: any[] = Array.isArray(inv.line_items) ? inv.line_items : [];
      const desc = lineItems
        .map((l: any) => l.description)
        .filter(Boolean)
        .join("; ");
      ws.addRow({
        number: inv.invoice_number,
        issue_date: inv.issue_date ?? "",
        due_date: inv.due_date ?? "",
        client: to_d.company_name ?? to_d.contact_name ?? "",
        description: desc,
        currency: inv.currency,
        net: inv.subtotal_pence / 100,
        vat: (inv.vat_pence ?? 0) / 100,
        gross: inv.total_pence / 100,
        paid_date: inv.paid_at ? new Date(inv.paid_at).toISOString().slice(0, 10) : "",
        status: inv.status,
      });
    }

    // Format money columns as number
    ["net", "vat", "gross"].forEach((col) => {
      ws.getColumn(col).numFmt = "#,##0.00";
    });

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="invoices.xlsx"',
    });
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportInvoicesCSV error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function maskBankDetails(profile: any): any {
  const masked = { ...profile };
  if (masked.bank_sort_code)
    masked.bank_sort_code = `****${String(masked.bank_sort_code).slice(-2)}`;
  if (masked.bank_account_number)
    masked.bank_account_number = `****${String(masked.bank_account_number).slice(-4)}`;
  if (masked.bank_iban) {
    const iban = String(masked.bank_iban);
    masked.bank_iban = `${iban.slice(0, 4)}****${iban.slice(-4)}`;
  }
  return masked;
}

function formatMoney(pence: number, currency: string): string {
  const amount = pence / 100;
  const symbol =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
