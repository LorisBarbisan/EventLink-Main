import { createHash } from "crypto";
import type { Request, Response } from "express";
import { storage } from "../../storage";

// GET /api/applications/guest-view?token=<raw>
export async function getGuestApplicationView(req: Request, res: Response) {
  try {
    const rawToken = req.query.token as string | undefined;
    if (!rawToken) {
      return res.status(400).json({ error: "Missing token" });
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const tokenRow = await storage.getGuestApplicationToken(tokenHash);

    if (!tokenRow) {
      return res.status(404).json({ error: "Invalid or expired link" });
    }
    if (new Date() > tokenRow.expires_at) {
      return res.status(410).json({ error: "This link has expired" });
    }

    // Mark as viewed (non-blocking)
    storage.markGuestApplicationTokenViewed(tokenHash).catch(() => {});

    const application = await storage.getJobApplicationById(tokenRow.application_id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const job = await storage.getJobById(tokenRow.job_id);
    const freelancerProfile = await storage.getFreelancerProfile(application.freelancer_id);
    const freelancerUser = await storage.getUser(application.freelancer_id);

    const freelancerName =
      freelancerProfile?.first_name || freelancerProfile?.last_name
        ? `${freelancerProfile?.first_name || ""} ${freelancerProfile?.last_name || ""}`.trim()
        : (freelancerUser?.email ?? "Freelancer");

    return res.json({
      application: {
        id: application.id,
        status: application.status,
        cover_letter: application.cover_letter,
        applied_at: application.applied_at,
      },
      job: job
        ? { id: job.id, title: job.title, location: job.location }
        : { id: tokenRow.job_id, title: "Job", location: "" },
      freelancer: {
        user_id: application.freelancer_id,
        name: freelancerName,
        title: freelancerProfile?.title ?? null,
        bio: freelancerProfile?.bio ?? null,
        location: freelancerProfile?.location ?? null,
        profile_photo_url: freelancerUser?.profile_photo_url ?? null,
        email: freelancerUser?.email ?? null,
      },
    });
  } catch (error) {
    console.error("getGuestApplicationView error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
