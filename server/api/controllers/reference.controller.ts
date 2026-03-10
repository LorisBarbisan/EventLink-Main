import type { Request, Response } from "express";
import { storage } from "../../storage";
import { sendEmail } from "../utils/emailService";

function computeBadge(
  q1: boolean,
  q2: string | null | undefined,
  q3: string | null | undefined
): { badge_result: string; is_flagged: boolean } {
  if (!q1) return { badge_result: "flagged", is_flagged: true };
  if (q2 === "prefer_not_to_say" || q3 === "prefer_not_to_say") {
    return { badge_result: "work_history_confirmed", is_flagged: false };
  }
  if (q2 === "mixed" || q3 === "unlikely") {
    return { badge_result: "verified_private", is_flagged: true };
  }
  if (q2 === "excellent" && q3 === "absolutely") {
    return { badge_result: "highly_recommended", is_flagged: false };
  }
  if (q2 === "good" || (q2 === "excellent" && q3 === "yes")) {
    return { badge_result: "recommended", is_flagged: false };
  }
  return { badge_result: "work_history_confirmed", is_flagged: false };
}

export async function getReferenceFormInfo(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const freelancer = await storage.getFreelancerByReferenceToken(token);
    if (!freelancer) {
      return res.status(404).json({ error: "Invalid or expired reference link" });
    }
    res.json({
      freelancerUserId: freelancer.userId,
      firstName: freelancer.firstName,
      lastName: freelancer.lastName,
    });
  } catch (err) {
    console.error("getReferenceFormInfo error:", err);
    res.status(500).json({ error: "Failed to load reference form" });
  }
}

export async function submitReference(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const freelancer = await storage.getFreelancerByReferenceToken(token);
    if (!freelancer) {
      return res.status(404).json({ error: "Invalid reference link" });
    }

    const { referee_name, referee_organisation, q1_confirmed, q2_rating, q3_would_work_again, comment } = req.body;

    if (typeof q1_confirmed !== "boolean") {
      return res.status(400).json({ error: "Question 1 answer is required" });
    }

    const { badge_result, is_flagged } = computeBadge(q1_confirmed, q2_rating, q3_would_work_again);

    const reference = await storage.createFreelancerReference({
      freelancer_id: freelancer.userId,
      referee_name: referee_name || null,
      referee_organisation: referee_organisation || null,
      q1_confirmed,
      q2_rating: q2_rating || null,
      q3_would_work_again: q3_would_work_again || null,
      comment: comment || null,
      badge_result,
      is_flagged,
    });

    // Send notification email to freelancer
    try {
      const freelancerUser = await storage.getUser(freelancer.userId);
      if (freelancerUser?.email) {
        const refereeName = referee_name || "Someone";
        const fromOrg = referee_organisation ? ` from ${referee_organisation}` : "";
        const badgeLabel =
          badge_result === "highly_recommended" ? "Verified & Highly Recommended" :
          badge_result === "recommended" ? "Verified & Recommended" :
          badge_result === "work_history_confirmed" ? "Work History Confirmed" :
          null;
        const publicBadge = badgeLabel ? `<p style="margin:12px 0">You earned a new badge: <strong>${badgeLabel}</strong></p>` : "";

        await sendEmail({
          to: freelancerUser.email,
          subject: `New reference received from ${refereeName}${fromOrg}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#D8690E,#f59e0b);padding:24px;border-radius:8px 8px 0 0;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:22px">EventLink</h1>
              </div>
              <div style="background:#fff;padding:28px;border-radius:0 0 8px 8px;border:1px solid #eee">
                <h2 style="color:#1a1a1a;margin:0 0 16px">You have a new reference!</h2>
                <p style="color:#444;margin:0 0 12px">
                  <strong>${refereeName}${fromOrg}</strong> has completed your reference request.
                </p>
                ${publicBadge}
                <p style="color:#444;margin:12px 0">
                  Visit your profile to see how this reference contributes to your reputation.
                </p>
                <a href="https://eventlink.one/profile/${freelancer.userId}"
                   style="display:inline-block;background:linear-gradient(135deg,#D8690E,#f59e0b);color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
                  View My Profile
                </a>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send reference notification email:", emailErr);
    }

    res.status(201).json({ message: "Reference submitted successfully", badge_result });
  } catch (err) {
    console.error("submitReference error:", err);
    res.status(500).json({ error: "Failed to submit reference" });
  }
}

export async function getMyReferenceToken(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const token = await storage.getOrCreateReferenceToken(userId);
    const baseUrl = "https://eventlink.one";
    res.json({ token, url: `${baseUrl}/reference/${token}` });
  } catch (err) {
    console.error("getMyReferenceToken error:", err);
    res.status(500).json({ error: "Failed to get reference token" });
  }
}

export async function getPublicReferences(req: Request, res: Response) {
  try {
    const freelancerId = parseInt(req.params.freelancerId);
    if (isNaN(freelancerId)) return res.status(400).json({ error: "Invalid freelancer ID" });
    const references = await storage.getPublicReferences(freelancerId);
    res.json(references);
  } catch (err) {
    console.error("getPublicReferences error:", err);
    res.status(500).json({ error: "Failed to get references" });
  }
}
