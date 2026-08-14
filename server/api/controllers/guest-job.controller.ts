import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import { storage } from "../../storage";
import {
  sendGuestJobMagicLink,
  sendGuestJobPublishedConfirmation,
} from "../services/guest-job-email.service";

const DRAFT_TTL_HOURS = 24;
const TERMS_VERSION = "1.0";

// Basic field validation shared between submit and confirm
function validateJobPayload(body: Record<string, unknown>): string | null {
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return "Job title is required";
  }
  if (!body.location || typeof body.location !== "string" || !body.location.trim()) {
    return "Location is required";
  }
  if (!body.rate || typeof body.rate !== "string" || !body.rate.trim()) {
    return "Rate / budget is required";
  }
  if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
    return "Job description is required";
  }
  return null;
}

// POST /api/jobs/guest
export async function submitGuestJob(req: Request, res: Response) {
  try {
    const {
      // contact
      contact_name,
      contact_email,
      // job fields
      title,
      company,
      location,
      country,
      currency,
      rate,
      description,
      event_date,
      end_date,
      start_time,
      end_time,
      type: jobType,
      terms_accepted,
    } = req.body as Record<string, unknown>;

    // ── validate contact details ────────────────────────────────────────────
    if (!contact_name || typeof contact_name !== "string" || !contact_name.trim()) {
      return res.status(400).json({ error: "Contact name is required" });
    }
    if (!contact_email || typeof contact_email !== "string") {
      return res.status(400).json({ error: "Contact email is required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }
    if (!terms_accepted) {
      return res.status(400).json({ error: "You must accept the terms to continue" });
    }

    // ── validate job payload ────────────────────────────────────────────────
    const payloadError = validateJobPayload(req.body);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    // ── build the stored payload (everything except contact / terms) ────────
    const payload = {
      title: (title as string).trim(),
      company: company ? (company as string).trim() : (contact_name as string).trim(),
      location: (location as string).trim(),
      country: country || null,
      currency: currency || "GBP",
      rate: (rate as string).trim(),
      description: (description as string).trim(),
      event_date: event_date || null,
      end_date: end_date || null,
      start_time: start_time || null,
      end_time: end_time || null,
      type: jobType || "freelance",
    };

    // ── generate magic-link token ───────────────────────────────────────────
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

    // ── send email (non-blocking on failure — still return 201) ─────────────
    sendGuestJobMagicLink({
      to: (contact_email as string).toLowerCase().trim(),
      contactName: (contact_name as string).trim(),
      jobTitle: payload.title,
      token: rawToken,
    }).catch((err) => console.error("Guest job magic link email failed:", err));

    return res.status(201).json({
      message: "Draft saved. Check your email for a confirmation link to publish your job post.",
    });
  } catch (error) {
    console.error("submitGuestJob error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/jobs/guest/confirm?token=<raw>
export async function confirmGuestJob(req: Request, res: Response) {
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
      return res.status(409).json({ error: "This job has already been published" });
    }
    if (new Date() > draft.expires_at) {
      return res.status(410).json({ error: "This confirmation link has expired" });
    }

    const payload = draft.payload as Record<string, unknown>;

    // ── find or create a guest user account ────────────────────────────────
    let user = await storage.getUserByEmail(draft.contact_email);
    if (!user) {
      // Create a slim guest recruiter account — no password, not verified
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
        created_via: "guest_job_post",
      } as any);
    }

    // ── publish the job ─────────────────────────────────────────────────────
    const job = await storage.createJob({
      title: payload.title as string,
      company: (payload.company as string) || draft.contact_name,
      location: payload.location as string,
      country: (payload.country as string) || null,
      currency: (payload.currency as string) || "GBP",
      rate: payload.rate as string,
      description: payload.description as string,
      event_date: (payload.event_date as string) || null,
      end_date: (payload.end_date as string) || null,
      start_time: (payload.start_time as string) || null,
      end_time: (payload.end_time as string) || null,
      type: ((payload.type as string) || "freelance") as any,
      status: "active",
      recruiter_id: user.id,
      posted_by_user_id: user.id,
      is_freelancer_posted: false,
      poster_type: "guest",
      moderation_status: "approved", // auto-approved in Phase 2; Phase 7 will gate on trust
    } as any);

    await storage.consumeJobDraft(draft.id, job.id);

    // ── send "you're live" email ─────────────────────────────────────────────
    sendGuestJobPublishedConfirmation({
      to: draft.contact_email,
      contactName: draft.contact_name,
      jobTitle: job.title,
      jobId: job.id,
    }).catch((err) => console.error("Guest job published confirmation email failed:", err));

    return res.status(201).json({
      message: "Your job is now live!",
      job_id: job.id,
    });
  } catch (error) {
    console.error("confirmGuestJob error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
