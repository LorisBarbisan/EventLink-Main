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
  type BookingStatus,
  bookingStatusValues,
} from "../../../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { storage } from "../../storage.js";

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
    const employerId = req.user!.id;
    const { jobId, freelancerId, agreedRate, callTime, venueAddress, employerNotes, eventDate, status } =
      req.body;

    if (!freelancerId) {
      return res.status(400).json({ error: "freelancerId is required" });
    }

    const bookingJobId: number | null = jobId || null;
    let bookingEventDate: string | null = eventDate || null;
    const bookingStatus: string = status || (bookingJobId ? "enquired" : "confirmed");

    // If linked to a job, verify ownership and pull event date if not provided
    if (bookingJobId) {
      const [job] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, bookingJobId), eq(jobs.recruiter_id, employerId)));

      if (!job) {
        return res.status(403).json({ error: "Job not found or not owned by you" });
      }

      if (!bookingEventDate) bookingEventDate = job.event_date ?? null;

      // Prevent duplicate job+freelancer bookings
      const [existing] = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.jobId, bookingJobId), eq(bookings.freelancerId, freelancerId)));

      if (existing) {
        return res.status(409).json({
          error: "A booking already exists for this job and freelancer",
          bookingId: existing.id,
        });
      }
    }

    const [freelancer] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, freelancerId), eq(users.role, "freelancer")));

    if (!freelancer) {
      return res.status(404).json({ error: "Freelancer not found" });
    }

    const [booking] = await db
      .insert(bookings)
      .values({
        jobId: bookingJobId,
        employerId,
        freelancerId,
        status: bookingStatus,
        eventDate: bookingEventDate,
        agreedRate: agreedRate ?? null,
        callTime: callTime ?? null,
        venueAddress: venueAddress ?? null,
        employerNotes: employerNotes ?? null,
      })
      .returning();

    await db.insert(bookingStatusHistory).values({
      bookingId: booking.id,
      fromStatus: null,
      toStatus: bookingStatus,
      changedById: employerId,
      note: bookingJobId ? "Booking created" : "Direct booking created from calendar",
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
    const employerId = req.user!.id;

    const results = await db
      .select({
        booking: bookings,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          eventDate: jobs.eventDate,
          payRate: jobs.payRate,
        },
        freelancer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phone: users.phone,
          profilePicture: users.profilePicture,
        },
      })
      .from(bookings)
      .innerJoin(jobs, eq(bookings.jobId, jobs.id))
      .innerJoin(users, eq(bookings.freelancerId, users.id))
      .where(eq(bookings.employerId, employerId))
      .orderBy(desc(bookings.updatedAt));

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

    const results = await db
      .select({
        booking: bookings,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          eventDate: jobs.eventDate,
          payRate: jobs.payRate,
        },
        employer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          companyName: users.companyName,
          profilePicture: users.profilePicture,
        },
      })
      .from(bookings)
      .innerJoin(jobs, eq(bookings.jobId, jobs.id))
      .innerJoin(users, eq(bookings.employerId, users.id))
      .where(eq(bookings.freelancerId, freelancerId))
      .orderBy(desc(bookings.updatedAt));

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

    const [result] = await db
      .select({
        booking: bookings,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
          eventDate: jobs.eventDate,
          payRate: jobs.payRate,
          description: jobs.description,
        },
        freelancer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phone: users.phone,
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

    if (!result) {
      return res.status(404).json({ error: "Booking not found or access denied" });
    }

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
      toStatus === "cancelled"
        ? userId === booking.employerId
          ? "employer"
          : "freelancer"
        : null;

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

    // Non-blocking calendar auto-update
    import("../services/calendarSync.service.js").then(({ syncSingleBooking }) => {
      syncSingleBooking(booking.employerId, bookingId).catch((err) =>
        console.error("Auto calendar sync failed:", err.message)
      );
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
    const employerId = req.user!.id;
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

    // Non-blocking calendar auto-update
    import("../services/calendarSync.service.js").then(({ syncSingleBooking }) => {
      syncSingleBooking(employerId, bookingId).catch((err) =>
        console.error("Auto calendar sync (details) failed:", err.message)
      );
    });

    return res.json(updated);
  } catch (error) {
    console.error("updateBookingDetails error:", error);
    return res.status(500).json({ error: "Failed to update booking details" });
  }
}

// ── Get bookings for a specific job (employer only) ────────
export async function getBookingsByJob(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;
    const jobId = parseInt(req.params.jobId);

    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.employerId, employerId)));

    if (!job) {
      return res.status(403).json({ error: "Job not found or not owned by you" });
    }

    const results = await db
      .select({
        booking: bookings,
        freelancer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phone: users.phone,
          profilePicture: users.profilePicture,
          primaryRole: users.primaryRole,
        },
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.freelancerId, users.id))
      .where(eq(bookings.jobId, jobId))
      .orderBy(desc(bookings.createdAt));

    return res.json(results);
  } catch (error) {
    console.error("getBookingsByJob error:", error);
    return res.status(500).json({ error: "Failed to fetch job bookings" });
  }
}

// ── Get all bookings for calendar (employer) ──────────────
export async function getBookingsForCalendar(req: Request, res: Response) {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const result = await storage.getBookingsForCalendar(employerId);
    return res.json(result);
  } catch (error: any) {
    console.error("getBookingsForCalendar error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Update IR35 status for a booking (employer only) ──────
export const updateIr35Status = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) return res.status(400).json({ error: "Invalid booking ID" });
    const { ir35Status, ir35Notes } = req.body;
    const validStatuses = ["not_assessed", "inside", "outside", "undetermined"];
    if (!validStatuses.includes(ir35Status)) {
      return res.status(400).json({ error: "Invalid IR35 status" });
    }
    const updated = await storage.updateBookingIr35Status(
      bookingId,
      employerId,
      ir35Status,
      ir35Notes
    );
    return res.json(updated);
  } catch (err: any) {
    console.error("updateIr35Status error:", err.message);
    if (err.message?.includes("not found")) return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ── Dashboard summary counts (employer) ───────────────────
export async function getBookingsSummary(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;

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
