// ============================================================
// FMS Phase 1 — Booking Controller
// File: server/api/controllers/booking.controller.ts
// ============================================================

import { Request, Response } from "express";
import { db } from "../config/db";
import {
  bookings,
  bookingStatusHistory,
  jobs,
  users,
  freelancer_profiles,
  recruiter_profiles,
  type BookingStatus,
  bookingStatusValues,
} from "../../../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";

// The platform stores no phone numbers; the client renders phone conditionally,
// so booking endpoints return null to keep the response shape stable.
const NO_PHONE: string | null = null;

// ── Valid status transitions ───────────────────────────────
const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  enquired: ["confirmed", "cancelled"],
  confirmed: ["briefed", "cancelled"],
  briefed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Create a booking (employer initiates) ─────────────────
export async function createBooking(req: Request, res: Response) {
  try {
    const employerId = req.companyId ?? req.user!.id;
    const { jobId, freelancerId, agreedRate, callTime, venueAddress, employerNotes } = req.body;

    if (!jobId || !freelancerId) {
      return res.status(400).json({ error: "jobId and freelancerId are required" });
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.recruiter_id, employerId)));

    if (!job) {
      return res.status(403).json({ error: "Job not found or not owned by you" });
    }

    const [freelancer] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, freelancerId), eq(users.role, "freelancer")));

    if (!freelancer) {
      return res.status(404).json({ error: "Freelancer not found" });
    }

    const [existing] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.jobId, jobId), eq(bookings.freelancerId, freelancerId)));

    if (existing) {
      return res.status(409).json({
        error: "A booking already exists for this job and freelancer",
        bookingId: existing.id,
      });
    }

    const [booking] = await db
      .insert(bookings)
      .values({
        jobId,
        employerId,
        freelancerId,
        status: "enquired",
        agreedRate: agreedRate ?? null,
        currency: job.currency ?? "GBP",
        callTime: callTime ?? null,
        venueAddress: venueAddress ?? null,
        employerNotes: employerNotes ?? null,
      })
      .returning();

    await db.insert(bookingStatusHistory).values({
      bookingId: booking.id,
      fromStatus: null,
      toStatus: "enquired",
      changedById: employerId,
      note: "Booking created",
    });

    return res.status(201).json(booking);
  } catch (error) {
    console.error("createBooking error:", error);
    return res.status(500).json({ error: "Failed to create booking" });
  }
}

// ── Get all bookings for the authenticated employer ────────
export async function getEmployerBookings(req: Request, res: Response) {
  try {
    const employerId = req.companyId ?? req.user!.id;

    const rows = await db
      .select({
        booking: bookings,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          eventDate: jobs.event_date,
          payRate: jobs.rate,
        },
        freelancer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          email: users.email,
          accountPhotoUrl: users.profile_photo_url,
          profilePhotoUrl: freelancer_profiles.profile_photo_url,
        },
      })
      .from(bookings)
      .innerJoin(jobs, eq(bookings.jobId, jobs.id))
      .innerJoin(users, eq(bookings.freelancerId, users.id))
      .leftJoin(freelancer_profiles, eq(freelancer_profiles.user_id, users.id))
      .where(eq(bookings.employerId, employerId))
      .orderBy(desc(bookings.updatedAt));

    const results = rows.map(({ booking, job, freelancer }) => ({
      booking,
      job,
      freelancer: {
        id: freelancer.id,
        firstName: freelancer.firstName,
        lastName: freelancer.lastName,
        email: freelancer.email,
        phone: NO_PHONE,
        profilePicture: freelancer.profilePhotoUrl ?? freelancer.accountPhotoUrl,
      },
    }));

    return res.json(results);
  } catch (error) {
    console.error("getEmployerBookings error:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
}

// ── Get all bookings for the authenticated freelancer ──────
export async function getFreelancerBookings(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;

    const rows = await db
      .select({
        booking: bookings,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          eventDate: jobs.event_date,
          payRate: jobs.rate,
        },
        employer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          companyName: recruiter_profiles.company_name,
          accountPhotoUrl: users.profile_photo_url,
          companyLogoUrl: recruiter_profiles.company_logo_url,
        },
      })
      .from(bookings)
      .innerJoin(jobs, eq(bookings.jobId, jobs.id))
      .innerJoin(users, eq(bookings.employerId, users.id))
      .leftJoin(recruiter_profiles, eq(recruiter_profiles.user_id, users.id))
      .where(eq(bookings.freelancerId, freelancerId))
      .orderBy(desc(bookings.updatedAt));

    const results = rows.map(({ booking, job, employer }) => ({
      booking,
      job,
      employer: {
        id: employer.id,
        firstName: employer.firstName,
        lastName: employer.lastName,
        companyName: employer.companyName,
        profilePicture: employer.companyLogoUrl ?? employer.accountPhotoUrl,
      },
    }));

    return res.json(results);
  } catch (error) {
    console.error("getFreelancerBookings error:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
}

// ── Get a single booking with full history ─────────────────
export async function getBookingById(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookingId = parseInt(req.params.id);

    if (isNaN(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const [row] = await db
      .select({
        booking: bookings,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          eventDate: jobs.event_date,
          payRate: jobs.rate,
          description: jobs.description,
        },
        freelancer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          email: users.email,
        },
      })
      .from(bookings)
      .innerJoin(jobs, eq(bookings.jobId, jobs.id))
      .innerJoin(users, eq(bookings.freelancerId, users.id))
      .where(
        and(
          eq(bookings.id, bookingId),
          or(eq(bookings.employerId, userId), eq(bookings.freelancerId, userId))
        )
      );

    if (!row) {
      return res.status(404).json({ error: "Booking not found or access denied" });
    }

    const result = {
      ...row,
      freelancer: { ...row.freelancer, phone: NO_PHONE },
    };

    const history = await db
      .select()
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, bookingId))
      .orderBy(desc(bookingStatusHistory.createdAt));

    return res.json({ ...result, history });
  } catch (error) {
    console.error("getBookingById error:", error);
    return res.status(500).json({ error: "Failed to fetch booking" });
  }
}

// ── Update booking status ──────────────────────────────────
export async function updateBookingStatus(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookingId = parseInt(req.params.id);
    const { status, note, cancellationReason } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    if (!bookingStatusValues.includes(status as BookingStatus)) {
      return res
        .status(400)
        .json({ error: `Invalid status. Must be one of: ${bookingStatusValues.join(", ")}` });
    }

    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          or(eq(bookings.employerId, userId), eq(bookings.freelancerId, userId))
        )
      );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found or access denied" });
    }

    const fromStatus = booking.status as BookingStatus;
    const toStatus = status as BookingStatus;

    if (!canTransition(fromStatus, toStatus)) {
      return res.status(400).json({
        error: `Cannot transition from '${fromStatus}' to '${toStatus}'`,
        allowedTransitions: VALID_TRANSITIONS[fromStatus],
      });
    }

    const cancelledBy =
      toStatus === "cancelled" ? (userId === booking.employerId ? "employer" : "freelancer") : null;

    const [updated] = await db
      .update(bookings)
      .set({
        status: toStatus,
        updatedAt: new Date(),
        ...(toStatus === "cancelled" && {
          cancellationReason: cancellationReason ?? null,
          cancelledBy,
        }),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    await db.insert(bookingStatusHistory).values({
      bookingId,
      fromStatus,
      toStatus,
      changedById: userId,
      note: note ?? null,
    });

    return res.json(updated);
  } catch (error) {
    console.error("updateBookingStatus error:", error);
    return res.status(500).json({ error: "Failed to update booking status" });
  }
}

// ── Update booking details (employer only) ─────────────────
export async function updateBookingDetails(req: Request, res: Response) {
  try {
    const employerId = req.companyId ?? req.user!.id;
    const bookingId = parseInt(req.params.id);
    const { agreedRate, callTime, venueAddress, employerNotes } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.employerId, employerId)));

    if (!booking) {
      return res.status(404).json({ error: "Booking not found or not owned by you" });
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      return res.status(400).json({
        error: "Cannot update details on a completed or cancelled booking",
      });
    }

    const [updated] = await db
      .update(bookings)
      .set({
        ...(agreedRate !== undefined && { agreedRate }),
        ...(callTime !== undefined && { callTime }),
        ...(venueAddress !== undefined && { venueAddress }),
        ...(employerNotes !== undefined && { employerNotes }),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    return res.json(updated);
  } catch (error) {
    console.error("updateBookingDetails error:", error);
    return res.status(500).json({ error: "Failed to update booking details" });
  }
}

// ── Get bookings for a specific job (employer only) ────────
export async function getBookingsByJob(req: Request, res: Response) {
  try {
    const employerId = req.companyId ?? req.user!.id;
    const jobId = parseInt(req.params.jobId);

    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.recruiter_id, employerId)));

    if (!job) {
      return res.status(403).json({ error: "Job not found or not owned by you" });
    }

    const rows = await db
      .select({
        booking: bookings,
        freelancer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          email: users.email,
          accountPhotoUrl: users.profile_photo_url,
          profilePhotoUrl: freelancer_profiles.profile_photo_url,
          primaryRole: freelancer_profiles.title,
        },
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.freelancerId, users.id))
      .leftJoin(freelancer_profiles, eq(freelancer_profiles.user_id, users.id))
      .where(eq(bookings.jobId, jobId))
      .orderBy(desc(bookings.createdAt));

    const results = rows.map(({ booking, freelancer }) => ({
      booking,
      freelancer: {
        id: freelancer.id,
        firstName: freelancer.firstName,
        lastName: freelancer.lastName,
        email: freelancer.email,
        phone: NO_PHONE,
        profilePicture: freelancer.profilePhotoUrl ?? freelancer.accountPhotoUrl,
        primaryRole: freelancer.primaryRole,
      },
    }));

    return res.json(results);
  } catch (error) {
    console.error("getBookingsByJob error:", error);
    return res.status(500).json({ error: "Failed to fetch job bookings" });
  }
}

// ── Dashboard summary counts (employer) ───────────────────
export async function getBookingsSummary(req: Request, res: Response) {
  try {
    const employerId = req.companyId ?? req.user!.id;

    const allBookings = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.employerId, employerId));

    const summary = {
      total: allBookings.length,
      enquired: allBookings.filter((b) => b.status === "enquired").length,
      confirmed: allBookings.filter((b) => b.status === "confirmed").length,
      briefed: allBookings.filter((b) => b.status === "briefed").length,
      completed: allBookings.filter((b) => b.status === "completed").length,
      cancelled: allBookings.filter((b) => b.status === "cancelled").length,
    };

    return res.json(summary);
  } catch (error) {
    console.error("getBookingsSummary error:", error);
    return res.status(500).json({ error: "Failed to fetch bookings summary" });
  }
}
