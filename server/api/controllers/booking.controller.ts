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
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { createHmac } from "crypto";
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
          eventDate: jobs.event_date,
          rate: jobs.rate,
        },
        freelancer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          email: users.email,
          profilePicture: users.profile_photo_url,
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
          eventDate: jobs.event_date,
          rate: jobs.rate,
        },
        employer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          profilePicture: users.profile_photo_url,
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
          eventDate: jobs.event_date,
          rate: jobs.rate,
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
    const { agreedRate, callTime, venueAddress, employerNotes, roleRequired, skillTags, agreedBudget, actualCost, expenses, budgetNotes } = req.body;

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
        ...(roleRequired !== undefined && { roleRequired }),
        ...(skillTags !== undefined && { skillTags }),
        ...(agreedBudget !== undefined && { agreedBudget }),
        ...(actualCost !== undefined && { actualCost }),
        ...(expenses !== undefined && { expenses }),
        ...(budgetNotes !== undefined && { budgetNotes }),
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
      .where(and(eq(jobs.id, jobId), eq(jobs.recruiter_id, employerId)));

    if (!job) {
      return res.status(403).json({ error: "Job not found or not owned by you" });
    }

    const results = await db
      .select({
        booking: bookings,
        freelancer: {
          id: users.id,
          firstName: users.first_name,
          lastName: users.last_name,
          email: users.email,
          profilePicture: users.profile_photo_url,
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

// ── iCal feed for freelancer (public but token-secured) ────────────────────
// GET /api/bookings/ical/:userId/:token
// Returns an iCal feed of confirmed/briefed/completed bookings for a freelancer.
// Token is a simple HMAC so the URL is hard to guess without being auth-gated.

function makeIcalToken(userId: number): string {
  const secret = process.env.JWT_SECRET ?? "ical-secret";
  return createHmac("sha256", secret).update(`ical-${userId}`).digest("hex").slice(0, 24);
}

export function getIcalToken(req: Request, res: Response) {
  const userId = req.user!.id;
  const token = makeIcalToken(userId);
  const host = req.headers["x-forwarded-host"] as string || req.headers.host || "";
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  return res.json({ url: `${proto}://${host}/api/bookings/ical/${userId}/${token}` });
}

export async function serveIcalFeed(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);
    const token = req.params.token;
    if (makeIcalToken(userId) !== token) {
      return res.status(401).send("Unauthorised");
    }

    const rows = await db
      .select({
        id: bookings.id,
        eventDate: bookings.eventDate,
        callTime: bookings.callTime,
        venueAddress: bookings.venueAddress,
        roleRequired: bookings.roleRequired,
        status: bookings.status,
        updatedAt: bookings.updatedAt,
        employerName: users.email,
      })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.employerId))
      .where(
        and(
          eq(bookings.freelancerId, userId),
          inArray(bookings.status, ["confirmed", "briefed", "completed"])
        )
      );

    const icalLines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EventLink//Bookings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:EventLink Bookings",
      "X-WR-TIMEZONE:Europe/London",
    ];

    for (const b of rows) {
      if (!b.eventDate) continue;
      const dateStr = b.eventDate.replace(/-/g, "");
      const uid = `booking-${b.id}@eventlink.one`;
      const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const updated = (b.updatedAt ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

      let dtStart: string;
      let dtEnd: string;
      if (b.callTime) {
        const [h, m] = b.callTime.split(":").map(Number);
        const start = new Date(`${b.eventDate}T${String(h).padStart(2,"0")}:${String(m||0).padStart(2,"0")}:00`);
        const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
        dtStart = `DTSTART:${start.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}`;
        dtEnd = `DTEND:${end.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}`;
      } else {
        dtStart = `DTSTART;VALUE=DATE:${dateStr}`;
        dtEnd = `DTEND;VALUE=DATE:${dateStr}`;
      }

      const summary = `[${b.status.toUpperCase()}] EventLink Booking${b.roleRequired ? ` — ${b.roleRequired}` : ""}`;
      const location = b.venueAddress ?? "";

      icalLines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `LAST-MODIFIED:${updated}`,
        dtStart,
        dtEnd,
        `SUMMARY:${summary}`,
        ...(location ? [`LOCATION:${location.replace(/\n/g, "\n")}`] : []),
        "END:VEVENT"
      );
    }

    icalLines.push("END:VCALENDAR");

    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="eventlink-bookings.ics"');
    res.set("Cache-Control", "no-cache");
    return res.send(icalLines.join("\r\n"));
  } catch (err: any) {
    console.error("iCal feed error:", err.message);
    return res.status(500).send("Error generating calendar feed");
  }
}
