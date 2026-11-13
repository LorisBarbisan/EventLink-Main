import { db } from "../config/db";
import { bookings, jobs, job_applications } from "@shared/schema";
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
  end_date: string | null;
  status?: string | null;
}

/**
 * Parse agreed_rate text to integer pence.
 * Returns { pence, needsReview } — needsReview is true when the string contains
 * more than one number (e.g. "£250-300") or when parsing fails.
 */
function parseRatePence(agreedRate: string | null | undefined): {
  pence: number | null;
  needsReview: boolean;
} {
  if (!agreedRate) return { pence: null, needsReview: false };
  // Normalise thousand-separator commas (e.g. "£1,450") before splitting on digits
  const normalised = agreedRate.replace(/(\d),(\d{3})/g, "$1$2");
  // Ambiguous: two or more digit groups (e.g. "250-300", "£250 - £300")
  const digitGroups = normalised.match(/\d+(?:\.\d+)?/g) ?? [];
  if (digitGroups.length > 1) return { pence: null, needsReview: true };
  const n = parseFloat(digitGroups[0] ?? "");
  if (isNaN(n)) return { pence: null, needsReview: true };
  return { pence: Math.round(n * 100), needsReview: false };
}

/** Number of calendar days in a date range (inclusive), minimum 1. */
function daySpan(start: string, end: string | null | undefined): number {
  if (!end || end <= start) return 1;
  const ms = new Date(end + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/**
 * Create or update an earnings_entries row from a completed booking.
 * Idempotent — safe to call multiple times for the same booking.
 * Non-fatal: failures are logged and not re-thrown.
 */
export async function seedEntryFromBooking(booking: Booking, job: JobRow): Promise<void> {
  try {
    const existing = await storage.getEarningsEntryByBooking(booking.id);

    const { pence: ratePence, needsReview } = parseRatePence(booking.agreedRate);
    const workDate = job.event_date ?? booking.createdAt.toISOString().slice(0, 10);
    const currency = booking.currency ?? job.currency ?? "GBP";
    const days = daySpan(workDate, job.end_date);
    const unitAmountPence = ratePence;
    const grossPence = ratePence !== null ? ratePence * days : 0;

    // Resolve or create the client record for this employer
    const client = booking.employerId
      ? await storage.findOrCreateClientByEmployer(
          booking.freelancerId,
          booking.employerId,
          job.company
        )
      : await storage.findOrCreateClientByName(booking.freelancerId, job.company);

    let entryId: number;

    if (existing) {
      // Only update if still in expected/draft state — don't overwrite manual edits
      if (existing.status === "expected") {
        await storage.updateEarningsEntry(existing.id, {
          client_id: client.id,
          description: job.title,
          work_date: workDate,
          work_end_date: job.end_date ?? null,
          quantity: String(days),
          unit: "day",
          unit_amount_pence: unitAmountPence ?? undefined,
          gross_amount_pence: grossPence,
          currency,
          needs_review: needsReview || ratePence === null,
        });
      }
      entryId = existing.id;
    } else {
      const created = await storage.createEarningsEntry({
        freelancer_id: booking.freelancerId,
        booking_id: booking.id,
        client_id: client.id,
        description: job.title,
        work_date: workDate,
        work_end_date: job.end_date ?? null,
        quantity: String(days),
        unit: "day",
        unit_amount_pence: unitAmountPence ?? undefined,
        gross_amount_pence: grossPence,
        currency,
        status: "expected",
        work_status: "confirmed",
        needs_review: needsReview || ratePence === null,
        archived: false,
      });
      entryId = created.id;
    }

    // Mirror the link onto job_applications so the UI's earnings_entry_id filter
    // sees this booking as logged — runs for both create and update paths.
    try {
      const [app] = await db
        .select({ id: job_applications.id })
        .from(job_applications)
        .where(
          and(
            eq(job_applications.job_id, booking.jobId),
            eq(job_applications.freelancer_id, booking.freelancerId),
            inArray(job_applications.status as any, ["hired", "completed"])
          )
        )
        .limit(1);
      if (app) {
        await storage.linkJobApplicationEarning(app.id, entryId);
      }
    } catch {
      /* non-fatal */
    }
  } catch (err) {
    console.error(`seedEntryFromBooking failed for booking ${booking.id}:`, err);
    throw err;
  }
}

/**
 * Called after an invoice is created from a booking.
 * Sets invoice_id and invoiced_date on the matching earnings entry.
 * Non-fatal.
 */
export async function linkInvoiceToEntry(invoice: Invoice): Promise<void> {
  try {
    const invoicedDate = invoice.issue_date ?? new Date().toISOString().slice(0, 10);

    // Try to find the entry by booking first, then by invoice id
    const entry = invoice.booking_id
      ? await storage.getEarningsEntryByBooking(invoice.booking_id)
      : await storage.getEarningsEntryByInvoice(invoice.id);

    if (entry) {
      await storage.updateEarningsEntry(entry.id, {
        invoice_id: invoice.id,
        invoiced_date: invoicedDate,
      });
      return;
    }

    // No entry exists for this invoice — create a placeholder so it shows in "Owed to me"
    if (!invoice.booking_id) {
      const toDetails = invoice.to_details as Record<string, unknown> | null;
      const clientName =
        (toDetails?.company as string | undefined) ||
        (toDetails?.name as string | undefined) ||
        "Unknown";
      const client = await storage.findOrCreateClientByName(invoice.freelancer_id, clientName);
      await storage.createEarningsEntry({
        freelancer_id: invoice.freelancer_id,
        invoice_id: invoice.id,
        client_id: client.id,
        description: invoice.invoice_number,
        work_date: invoicedDate,
        quantity: "1",
        unit: "job",
        gross_amount_pence: invoice.total_pence,
        currency: invoice.currency ?? "GBP",
        status: "expected",
        invoiced_date: invoicedDate,
        archived: false,
      });
    }
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
    const paidDate =
      invoice.paid_at instanceof Date
        ? invoice.paid_at.toISOString().slice(0, 10)
        : typeof invoice.paid_at === "string"
          ? (invoice.paid_at as string).slice(0, 10)
          : new Date().toISOString().slice(0, 10);

    const entry = await storage.getEarningsEntryByInvoice(invoice.id);
    if (entry) {
      await storage.updateEarningsEntry(entry.id, {
        status: "paid",
        paid_date: paidDate,
        paid_amount_pence: invoice.paid_amount_pence ?? invoice.total_pence,
      });
      return;
    }

    // No linked earnings entry (e.g. blank invoice not from a booking) —
    // create one so the payment shows up in the Earnings sheet.
    const toDetails = invoice.to_details as Record<string, unknown> | null;
    const clientName =
      (toDetails?.company as string | undefined) ||
      (toDetails?.name as string | undefined) ||
      "Unknown";
    const workDate = invoice.issue_date ?? paidDate;

    const client = await storage.findOrCreateClientByName(invoice.freelancer_id, clientName);

    await storage.createEarningsEntry({
      freelancer_id: invoice.freelancer_id,
      invoice_id: invoice.id,
      client_id: client.id,
      description: invoice.invoice_number,
      work_date: workDate,
      quantity: "1",
      unit: "job",
      gross_amount_pence: invoice.total_pence,
      currency: invoice.currency ?? "GBP",
      status: "paid",
      paid_date: paidDate,
      paid_amount_pence: invoice.paid_amount_pence ?? invoice.total_pence,
      archived: false,
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
    // Only revert payment fields if the entry was not already paid.
    // An invoice is paperwork; cancelling it must not erase the fact that money arrived.
    await storage.updateEarningsEntry(entry.id, {
      invoice_id: null,
      invoiced_date: null,
      ...(entry.status !== "paid"
        ? { status: "expected", paid_date: null, paid_amount_pence: null }
        : {}),
    });
  } catch (err) {
    console.error(`unlinkInvoiceFromEntry failed for invoice ${invoiceId} (non-fatal):`, err);
  }
}

/**
 * Backfill and reconcile earnings entries for all bookings for a freelancer.
 * Idempotent — safe to call multiple times. For each booking:
 *   - Seeds a missing entry via seedEntryFromBooking (also writes the app link).
 *   - If the job is completed and the booking is not, advances the booking status.
 *   - If the job is completed and the entry work_status is not "completed", advances it.
 */
export async function backfillEarningsForFreelancer(freelancerId: number): Promise<{
  seeded: number;
  advanced: number;
  linked: number;
  already_ok: number;
  errors: number;
  total: number;
  error_bookings: number[];
}> {
  let seeded = 0;
  let advanced = 0;
  let linked = 0;
  let already_ok = 0;
  let errors = 0;
  const error_bookings: number[] = [];

  const allBookings = await db
    .select({
      booking: bookings,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        recruiter_id: jobs.recruiter_id,
        currency: jobs.currency,
        event_date: jobs.event_date,
        end_date: jobs.end_date,
        status: jobs.status,
      },
    })
    .from(bookings)
    .leftJoin(jobs, eq(bookings.jobId, jobs.id))
    .where(
      and(
        eq(bookings.freelancerId, freelancerId),
        inArray(bookings.status, ["confirmed", "briefed", "completed"])
      )
    );

  for (const { booking, job: jobOrNull } of allBookings) {
    // Bookings with no linked job (null jobId or orphaned) get a fallback stub
    const job: JobRow = jobOrNull ?? {
      id: 0,
      title: "Job",
      company: "Unknown",
      recruiter_id: null,
      currency: booking.currency ?? "GBP",
      event_date: null,
      end_date: null,
      status: null,
    };
    try {
      const jobCompleted = (job.status as string) === "completed";

      // Advance booking status if the job is done but booking isn't
      if (jobCompleted && booking.status !== "completed") {
        await db
          .update(bookings)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(bookings.id, booking.id));
        advanced++;
      }

      const existingBefore = await storage.getEarningsEntryByBooking(booking.id);

      // Always seed — idempotent, also writes job_applications.earnings_entry_id
      const effectiveBooking =
        jobCompleted && booking.status !== "completed"
          ? ({ ...booking, status: "completed" } as typeof booking)
          : booking;
      await seedEntryFromBooking(effectiveBooking, job);

      if (!existingBefore) {
        seeded++;
      } else {
        // Entry existed — check if work_status needs advancing
        if (jobCompleted && existingBefore.work_status !== "completed") {
          await storage.updateEarningsEntry(existingBefore.id, { work_status: "completed" });
          linked++;
        } else {
          already_ok++;
        }
      }
    } catch (err) {
      console.error(`backfillEarningsForFreelancer error for booking ${booking.id}:`, err);
      errors++;
      error_bookings.push(booking.id);
    }
  }

  return {
    seeded,
    advanced,
    linked,
    already_ok,
    errors,
    total: allBookings.length,
    error_bookings,
  };
}
