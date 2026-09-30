import { db } from "../config/db";
import { bookings, jobs } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { storage } from "../../storage";
import type { Booking, Invoice } from "@shared/schema";

interface JobRow {
  id: number;
  title: string;
  company: string;
  recruiter_id: number | null;
  currency: string | null;
  event_date: string | null;
}

/**
 * Parse agreed_rate text to integer pence.
 * Accepts formats like "£250", "250.00", "250", "$1,200.50".
 * Returns null if unparseable.
 */
function parseRatePence(agreedRate: string | null | undefined): number | null {
  if (!agreedRate) return null;
  const cleaned = agreedRate.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

/**
 * Create or update an earnings_entries row from a completed booking.
 * Idempotent — safe to call multiple times for the same booking.
 * Non-fatal: failures are logged and not re-thrown.
 */
export async function seedEntryFromBooking(booking: Booking, job: JobRow): Promise<void> {
  try {
    const existing = await storage.getEarningsEntryByBooking(booking.id);

    const grossPence = parseRatePence(booking.agreedRate);
    const workDate = job.event_date ?? booking.createdAt.toISOString().slice(0, 10);
    const currency = booking.currency ?? job.currency ?? "GBP";

    // Resolve or create the client record for this employer
    const client = booking.employerId
      ? await storage.findOrCreateClientByEmployer(
          booking.freelancerId,
          booking.employerId,
          job.company
        )
      : await storage.findOrCreateClientByName(booking.freelancerId, job.company);

    const needsReview = grossPence === null;
    const safePence = grossPence ?? 0;

    if (existing) {
      // Only update if still in expected/draft state — don't overwrite manual edits
      if (existing.status === "expected") {
        await storage.updateEarningsEntry(existing.id, {
          client_id: client.id,
          description: job.title,
          work_date: workDate,
          gross_amount_pence: safePence,
          currency,
          needs_review: needsReview,
        });
      }
      return;
    }

    await storage.createEarningsEntry({
      freelancer_id: booking.freelancerId,
      booking_id: booking.id,
      client_id: client.id,
      description: job.title,
      work_date: workDate,
      gross_amount_pence: safePence,
      currency,
      status: "expected",
      needs_review: needsReview,
      archived: false,
    });
  } catch (err) {
    console.error(`seedEntryFromBooking failed for booking ${booking.id} (non-fatal):`, err);
  }
}

/**
 * Called after an invoice is created from a booking.
 * Sets invoice_id and invoiced_date on the matching earnings entry.
 * Non-fatal.
 */
export async function linkInvoiceToEntry(invoice: Invoice): Promise<void> {
  if (!invoice.booking_id) return;
  try {
    const entry = await storage.getEarningsEntryByBooking(invoice.booking_id);
    if (!entry) return;
    await storage.updateEarningsEntry(entry.id, {
      invoice_id: invoice.id,
      invoiced_date: invoice.issue_date ?? new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error(`linkInvoiceToEntry failed for invoice ${invoice.id} (non-fatal):`, err);
  }
}

/**
 * Called after an invoice is marked paid.
 * Sets paid_date, paid_amount_pence, and status="paid" on the matching entry.
 * Non-fatal.
 */
export async function recordInvoicePaid(invoice: Invoice): Promise<void> {
  if (!invoice.id) return;
  try {
    const entry = await storage.getEarningsEntryByInvoice(invoice.id);
    if (!entry) return;
    const paidDate =
      invoice.paid_at instanceof Date
        ? invoice.paid_at.toISOString().slice(0, 10)
        : typeof invoice.paid_at === "string"
          ? (invoice.paid_at as string).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
    await storage.updateEarningsEntry(entry.id, {
      status: "paid",
      paid_date: paidDate,
      paid_amount_pence: invoice.paid_amount_pence ?? invoice.total_pence,
    });
  } catch (err) {
    console.error(`recordInvoicePaid failed for invoice ${invoice.id} (non-fatal):`, err);
  }
}

/**
 * Called after an invoice is cancelled.
 * Clears invoice_id, invoiced_date, paid fields and reverts status to "expected".
 * Non-fatal.
 */
export async function unlinkInvoiceFromEntry(invoiceId: number): Promise<void> {
  try {
    const entry = await storage.getEarningsEntryByInvoice(invoiceId);
    if (!entry) return;
    await storage.updateEarningsEntry(entry.id, {
      invoice_id: null,
      invoiced_date: null,
      status: "expected",
      paid_date: null,
      paid_amount_pence: null,
    });
  } catch (err) {
    console.error(`unlinkInvoiceFromEntry failed for invoice ${invoiceId} (non-fatal):`, err);
  }
}

/**
 * Backfill earnings entries for all historic completed bookings for a freelancer.
 * Skips bookings that already have an entry. Returns counts of seeded / skipped.
 */
export async function backfillEarningsForFreelancer(
  freelancerId: number
): Promise<{ seeded: number; skipped: number; errors: number }> {
  let seeded = 0;
  let skipped = 0;
  let errors = 0;

  const completedBookings = await db
    .select({
      booking: bookings,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        recruiter_id: jobs.recruiter_id,
        currency: jobs.currency,
        event_date: jobs.event_date,
      },
    })
    .from(bookings)
    .innerJoin(jobs, eq(bookings.jobId, jobs.id))
    .where(and(eq(bookings.freelancerId, freelancerId), inArray(bookings.status, ["completed"])));

  for (const { booking, job } of completedBookings) {
    const existing = await storage.getEarningsEntryByBooking(booking.id);
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await seedEntryFromBooking(booking, job);
      seeded++;
    } catch {
      errors++;
    }
  }

  return { seeded, skipped, errors };
}
