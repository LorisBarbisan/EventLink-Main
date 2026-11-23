import { createHash, randomBytes } from "crypto";
import { parseCalendarDate } from "@shared/job-dates";
import type { Request, Response } from "express";
import { bookings, bookingStatusHistory } from "@shared/schema";
import { db } from "../config/db";
import { storage } from "../../storage";
import {
  sendDirectOfferMagicLink,
  sendDirectOfferConfirmation,
} from "../services/direct-offer-email.service";

const DRAFT_TTL_HOURS = 24;
const TERMS_VERSION = "1.0";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function freelancerDisplayName(
  profile: { first_name?: string | null; last_name?: string | null } | undefined,
  user: { first_name?: string | null; last_name?: string | null } | undefined
): string {
  const first = profile?.first_name || user?.first_name || "";
  const last = profile?.last_name || user?.last_name || "";
  return `${first} ${last}`.trim() || "this freelancer";
}

// POST /api/jobs/direct
// Body: freelancer_slug + the short offer form (what/when/where + name/email).
export async function submitDirectOffer(req: Request, res: Response) {
  try {
    const {
      freelancer_slug,
      contact_name,
      contact_email,
      title,
      description,
      company,
      location,
      country,
      currency,
      rate,
      event_date,
      end_date,
      start_time,
      end_time,
      notes,
      terms_accepted,
    } = req.body as Record<string, unknown>;

    // ── resolve the target freelancer from the slug ───────────────────────────
    if (!freelancer_slug || typeof freelancer_slug !== "string") {
      return res.status(400).json({ error: "Missing freelancer" });
    }
    const profile = await storage.getFreelancerProfileBySlug(freelancer_slug.trim());
    if (
      !profile ||
      (profile as { accepts_direct_offers?: boolean }).accepts_direct_offers === false
    ) {
      return res.status(404).json({ error: "This link isn't available." });
    }
    const freelancerUser = await storage.getUser(profile.user_id);
    if (!freelancerUser || freelancerUser.role !== "freelancer") {
      return res.status(404).json({ error: "This link isn't available." });
    }

    // ── validate contact details ──────────────────────────────────────────────
    if (!contact_name || typeof contact_name !== "string" || !contact_name.trim()) {
      return res.status(400).json({ error: "Your name is required" });
    }
    if (!contact_email || typeof contact_email !== "string" || !emailRegex.test(contact_email)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }
    if (!terms_accepted) {
      return res.status(400).json({ error: "You must accept the terms to continue" });
    }

    // ── validate the short offer form: what, when, where ──────────────────────
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "What's the job? A title or short description." });
    }
    if (!location || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ error: "Where is it? A location is required." });
    }
    const whenDate = parseCalendarDate(event_date as string | null);
    if (!whenDate) {
      return res.status(400).json({ error: "When is it? A valid date is required." });
    }

    // ── build the stored payload (rate and the rest are optional) ─────────────
    const payload = {
      direct_freelancer_id: profile.user_id,
      title: (title as string).trim(),
      company: company ? (company as string).trim() : (contact_name as string).trim(),
      location: (location as string).trim(),
      country: country || null,
      currency: currency || "GBP",
      rate: rate && typeof rate === "string" && rate.trim() ? rate.trim() : null,
      description:
        description && typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      event_date: whenDate,
      end_date: parseCalendarDate(end_date as string | null),
      start_time: start_time || null,
      end_time: end_time || null,
      notes: notes && typeof notes === "string" && notes.trim() ? notes.trim() : null,
      type: "freelance",
    };

    // ── generate magic-link token ─────────────────────────────────────────────
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + DRAFT_TTL_HOURS * 3_600_000);

    await storage.createJobDraft({
      payload,
      contact_name: (contact_name as string).trim(),
      contact_email: (contact_email as string).toLowerCase().trim(),
      token_hash: tokenHash,
      ip_address: req.ip ?? undefined,
      user_agent: req.headers["user-agent"] ?? undefined,
      terms_version: TERMS_VERSION,
      expires_at: expiresAt,
    });

    // ── send the magic link (non-blocking) ────────────────────────────────────
    sendDirectOfferMagicLink({
      to: (contact_email as string).toLowerCase().trim(),
      contactName: (contact_name as string).trim(),
      freelancerName: freelancerDisplayName(profile, freelancerUser),
      jobTitle: payload.title,
      token: rawToken,
    }).catch((err) => console.error("Direct offer magic link email failed:", err));

    return res.status(201).json({
      message: "Check your email for a link to confirm and send your offer.",
    });
  } catch (error) {
    console.error("submitDirectOffer error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/jobs/direct/confirm?token=<raw>
export async function confirmDirectOffer(req: Request, res: Response) {
  try {
    const rawToken = req.query.token as string | undefined;
    if (!rawToken) {
      return res.status(400).json({ error: "Missing token" });
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const draft = await storage.getJobDraftByTokenHash(tokenHash);

    if (!draft) {
      return res.status(404).json({ error: "Invalid or expired confirmation link" });
    }
    if (draft.consumed_at) {
      return res.status(409).json({ error: "This offer has already been sent" });
    }
    if (new Date() > draft.expires_at) {
      return res.status(410).json({ error: "This confirmation link has expired" });
    }

    const payload = draft.payload as Record<string, unknown>;
    const directFreelancerId = Number(payload.direct_freelancer_id);
    if (!directFreelancerId) {
      return res.status(400).json({ error: "This link is not a direct offer" });
    }

    // The target freelancer must still exist.
    const freelancerUser = await storage.getUser(directFreelancerId);
    if (!freelancerUser || freelancerUser.role !== "freelancer") {
      return res.status(410).json({ error: "This freelancer is no longer available" });
    }

    // …and must still accept direct offers. The toggle is checked at submit, but
    // drafts live 24h, so a freelancer who turns the link off (fully booked, or
    // being pestered) would otherwise still receive every offer already in
    // flight. Re-check here and consume the draft so the sender can't retry.
    const freelancerProfile = await storage.getFreelancerProfile(directFreelancerId);
    if (
      (freelancerProfile as { accepts_direct_offers?: boolean } | undefined)
        ?.accepts_direct_offers === false
    ) {
      await storage.expireJobDraft(draft.id);
      return res
        .status(410)
        .json({ error: "This freelancer is no longer accepting direct offers." });
    }

    // ── find or create a slim guest recruiter account (no password) ───────────
    let user = await storage.getUserByEmail(draft.contact_email);
    const isNewAccount = !user;
    if (!user) {
      const nameParts = draft.contact_name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? draft.contact_name;
      const lastName = nameParts.slice(1).join(" ") || null;
      user = await storage.createUser({
        email: draft.contact_email,
        password: null as unknown as string, // social-style: no password
        role: "recruiter",
        first_name: firstName,
        last_name: lastName ?? undefined,
        email_verified: false,
        status: "pending",
        created_via: "direct_offer",
      } as any);
    }

    // ── create the PRIVATE job (never listed; direct only) ────────────────────
    // moderation_status is left pending, not auto-approved: if this job is ever
    // made public (e.g. after a decline), it must pass moderation first.
    const job = await storage.createJob({
      title: payload.title as string,
      company: (payload.company as string) || draft.contact_name,
      location: payload.location as string,
      country: (payload.country as string) || null,
      currency: (payload.currency as string) || "GBP",
      rate: (payload.rate as string) || "Rate to be agreed",
      description: (payload.description as string) || (payload.title as string),
      event_date: parseCalendarDate(payload.event_date as string),
      end_date: parseCalendarDate(payload.end_date as string),
      start_time: (payload.start_time as string) || null,
      end_time: (payload.end_time as string) || null,
      type: "freelance" as any,
      status: "private",
      recruiter_id: user.id,
      posted_by_user_id: user.id,
      is_freelancer_posted: false,
      poster_type: "guest",
      moderation_status: "pending",
    } as any);

    await storage.consumeJobDraft(draft.id, job.id);

    // ── create the offer as an `enquired` booking for the freelancer ──────────
    const [booking] = await db
      .insert(bookings)
      .values({
        jobId: job.id,
        employerId: user.id,
        freelancerId: directFreelancerId,
        status: "enquired",
        agreedRate: (payload.rate as string) || null,
        currency: (payload.currency as string) || "GBP",
        employerNotes: (payload.notes as string) || null,
      })
      .returning();

    await db.insert(bookingStatusHistory).values({
      bookingId: booking.id,
      fromStatus: null,
      toStatus: "enquired",
      changedById: user.id,
      note: "Direct offer sent",
    });

    // ── notify the freelancer ─────────────────────────────────────────────────
    await storage
      .createNotification({
        user_id: directFreelancerId,
        type: "job_update",
        title: "New direct job offer",
        message: `${job.company} sent you a job directly: "${job.title}". Open it to accept or decline.`,
        priority: "high",
        related_entity_type: "job",
        related_entity_id: job.id,
        action_url: "/dashboard?tab=jobs",
      } as any)
      .catch((err) => console.error("Direct offer notification failed:", err));

    // ── set-password token for the guest account ──────────────────────────────
    // Only for an account we just created (or one that has no password set).
    // Minting one for an established recruiter would send them an unsolicited
    // "set your password" email and silently invalidate any genuine reset in
    // flight — so skip it when the account already has a password.
    let setPasswordToken: string | undefined;
    if (isNewAccount || !user.password) {
      try {
        const token = randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await storage.setPasswordResetToken(draft.contact_email, token, expires);
        setPasswordToken = token;
      } catch (err) {
        console.error("Failed to generate set-password token for direct offer:", err);
      }
    }

    // ── confirm to the client (non-blocking) ──────────────────────────────────
    sendDirectOfferConfirmation({
      to: draft.contact_email,
      contactName: draft.contact_name,
      freelancerName: freelancerDisplayName(undefined, freelancerUser),
      jobTitle: job.title,
      setPasswordToken,
    }).catch((err) => console.error("Direct offer confirmation email failed:", err));

    return res.status(201).json({
      message: "Your offer has been sent.",
      job_id: job.id,
      booking_id: booking.id,
    });
  } catch (error) {
    console.error("confirmDirectOffer error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
