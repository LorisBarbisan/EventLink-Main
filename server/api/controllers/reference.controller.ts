import type { Request, Response } from "express";
import { storage } from "../../storage";
import { sendEmail } from "../utils/emailService";
import { getOrigin } from "../utils/auth.util";
import crypto from "crypto";

const HIGH_TRUST_DOMAINS = [
  "aeg.com", "livenation.com", "bbc.co.uk", "itv.com", "sky.com",
  "prg.com", "neg.earth", "sseaudio.com", "whitelight.ltd.uk", "starlightdesign.com",
  "caa.com", "wmeagency.com", "paradigmagency.com", "creativeartsagency.com",
  "fremantle.com", "endemolshine.com", "img.com", "octagon.com",
  "nhs.uk", "gov.uk", "ac.uk", "edu",
];

const LOW_TRUST_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "protonmail.com", "icloud.com", "mail.com", "zoho.com", "yandex.com",
  "live.com", "msn.com", "googlemail.com",
];

function getDomainTrustLevel(email: string): { domain: string; level: "high" | "medium" | "low" } {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (HIGH_TRUST_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))) {
    return { domain, level: "high" };
  }
  if (LOW_TRUST_DOMAINS.includes(domain)) {
    return { domain, level: "low" };
  }
  return { domain, level: "medium" };
}

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
    return { badge_result: "verified_private", is_flagged: false };
  }
  if (q2 === "excellent" && q3 === "absolutely") {
    return { badge_result: "highly_recommended", is_flagged: false };
  }
  if (q2 === "good" || (q2 === "excellent" && q3 === "yes")) {
    return { badge_result: "recommended", is_flagged: false };
  }
  return { badge_result: "work_history_confirmed", is_flagged: false };
}

async function runFraudChecks(
  freelancerEmail: string,
  refereeEmail: string
): Promise<{ passed: boolean; flags: string[] }> {
  const flags: string[] = [];

  if (refereeEmail.toLowerCase() === freelancerEmail.toLowerCase()) {
    flags.push("self_reference");
  }

  const recentRefs = await storage.getRecentReferencesByEmail(refereeEmail, 48);
  if (recentRefs.length >= 5) {
    flags.push("rapid_submission_pattern");
  }

  const { level } = getDomainTrustLevel(refereeEmail);
  const recentFromDomain = recentRefs.filter(r => {
    const d = r.referee_email?.split("@")[1]?.toLowerCase();
    return d && LOW_TRUST_DOMAINS.includes(d);
  });
  if (recentFromDomain.length >= 5) {
    flags.push("multiple_free_email_refs");
  }

  return { passed: flags.length === 0, flags };
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

    const {
      referee_name, referee_organisation, referee_email, referee_role,
      q1_confirmed, q2_rating, q3_would_work_again, comment,
    } = req.body;

    const authenticatedUserId = (req as any).user?.id || null;

    if (typeof q1_confirmed !== "boolean") {
      return res.status(400).json({ error: "Question 1 answer is required" });
    }
    if (!referee_name || !referee_name.trim()) {
      return res.status(400).json({ error: "Your name is required" });
    }
    if (!referee_organisation || !referee_organisation.trim()) {
      return res.status(400).json({ error: "Your organisation is required" });
    }

    const { badge_result, is_flagged } = computeBadge(q1_confirmed, q2_rating, q3_would_work_again);

    let verification_type: "none" | "email" | "linkedin" | "eventlink_member" = "none";
    let verificationToken: string | null = null;
    let domainInfo: { domain: string; level: "high" | "medium" | "low" } | null = null;
    let fraudFlags: string[] = [];

    if (authenticatedUserId && authenticatedUserId !== freelancer.userId) {
      verification_type = "eventlink_member";
    }

    if (referee_email) {
      domainInfo = getDomainTrustLevel(referee_email);

      const freelancerUser = await storage.getUser(freelancer.userId);
      if (freelancerUser?.email) {
        const fraudResult = await runFraudChecks(freelancerUser.email, referee_email);
        fraudFlags = fraudResult.flags;
      }

      if (verification_type === "none") {
        verificationToken = crypto.randomBytes(32).toString("hex");
        verification_type = "none";
      }
    }

    const referenceData: any = {
      freelancer_id: freelancer.userId,
      referee_name: referee_name?.trim() || null,
      referee_organisation: referee_organisation?.trim() || null,
      referee_email: referee_email?.trim()?.toLowerCase() || null,
      referee_role: referee_role?.trim() || null,
      q1_confirmed,
      q2_rating: q2_rating || null,
      q3_would_work_again: q3_would_work_again || null,
      comment: comment?.trim() || null,
      badge_result,
      is_flagged: is_flagged || fraudFlags.length > 0,
      verification_type,
      email_domain: domainInfo?.domain || null,
      domain_trust_level: domainInfo?.level || null,
      verification_token: verificationToken,
      eventlink_user_id: authenticatedUserId || null,
      verification_timestamp: verification_type === "eventlink_member" ? new Date() : null,
    };

    if (verification_type === "eventlink_member" && authenticatedUserId) {
      referenceData.verified_email = (await storage.getUser(authenticatedUserId))?.email || null;
    }

    const reference = await storage.createFreelancerReference(referenceData);

    if (referee_email && verification_type !== "eventlink_member") {
      try {
        const verifyUrl = `https://eventlink.one/api/references/verify-email?token=${verificationToken}`;
        await sendEmail({
          to: referee_email,
          subject: `Verify your reference for ${freelancer.firstName || "a freelancer"} on EventLink`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#D8690E,#f59e0b);padding:24px;border-radius:8px 8px 0 0;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:22px">EventLink</h1>
              </div>
              <div style="background:#fff;padding:28px;border-radius:0 0 8px 8px;border:1px solid #eee">
                <h2 style="color:#1a1a1a;margin:0 0 16px">Verify Your Reference</h2>
                <p style="color:#444;margin:0 0 12px">
                  Thank you for submitting a reference for <strong>${freelancer.firstName} ${freelancer.lastName || ""}</strong>.
                </p>
                <p style="color:#444;margin:0 0 20px">
                  Click the button below to verify your email address and strengthen the credibility of your reference.
                </p>
                <a href="${verifyUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#D8690E,#f59e0b);color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                  Verify My Email
                </a>
                <p style="color:#999;font-size:12px;margin:20px 0 0">
                  This link will expire in 7 days. If you didn't submit this reference, you can safely ignore this email.
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send verification email to referee:", emailErr);
      }
    }

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

        const verificationLabel =
          verification_type === "eventlink_member" ? "EventLink Member Verified" :
          verification_type === "email" ? "Email Verified" :
          "Pending Email Verification";

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
                <p style="color:#444;margin:0 0 12px">
                  Verification status: <strong>${verificationLabel}</strong>
                </p>
                ${publicBadge}
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

    if (referee_email) {
      try {
        const requests = await storage.getReferenceRequests(freelancer.userId);
        const matchingRequest = requests.find(
          r => r.referee_email.toLowerCase() === referee_email.toLowerCase() && r.status === "pending"
        );
        if (matchingRequest) {
          await storage.updateReferenceRequest(matchingRequest.id, {
            status: "completed",
            reference_id: reference.id,
          });
        }
      } catch (err) {
        console.error("Failed to update reference request:", err);
      }
    }

    res.status(201).json({
      message: "Reference submitted successfully",
      badge_result,
      reference_id: reference.id,
      verification_type,
      fraud_flags: fraudFlags.length > 0 ? fraudFlags : undefined,
    });
  } catch (err) {
    console.error("submitReference error:", err);
    res.status(500).json({ error: "Failed to submit reference" });
  }
}

export async function verifyRefereeEmail(req: Request, res: Response) {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.redirect("/reference-verified?status=invalid");
    }

    const { db } = await import("../config/db");
    const { eq } = await import("drizzle-orm");
    const { freelancer_references } = await import("@shared/schema");

    const refs = await db.select()
      .from(freelancer_references)
      .where(eq(freelancer_references.verification_token, token))
      .limit(1);

    if (!refs[0]) {
      return res.redirect("/reference-verified?status=invalid");
    }

    const ref = refs[0];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (ref.created_at < sevenDaysAgo) {
      return res.redirect("/reference-verified?status=invalid");
    }

    await db.update(freelancer_references)
      .set({
        verification_type: "email",
        verified_email: ref.referee_email,
        verification_timestamp: new Date(),
        verification_token: null,
      })
      .where(eq(freelancer_references.id, ref.id));

    return res.redirect("/reference-verified?status=success");
  } catch (err) {
    console.error("verifyRefereeEmail error:", err);
    return res.redirect("/reference-verified?status=error");
  }
}

function signLinkedInState(payload: Record<string, string>): string {
  const secret = process.env.LINKEDIN_CLIENT_SECRET || process.env.SESSION_SECRET || "fallback-secret";
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return Buffer.from(JSON.stringify({ d: data, s: signature })).toString("base64url");
}

function verifyLinkedInState(state: string): Record<string, string> | null {
  try {
    const secret = process.env.LINKEDIN_CLIENT_SECRET || process.env.SESSION_SECRET || "fallback-secret";
    const { d, s } = JSON.parse(Buffer.from(state, "base64url").toString());
    const expected = crypto.createHmac("sha256", secret).update(d).digest("base64url");
    if (s !== expected) return null;
    const payload = JSON.parse(d);
    if (payload.exp && Date.now() > parseInt(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function startLinkedInReferenceAuth(req: Request, res: Response) {
  try {
    const { reference_id } = req.query;
    if (!reference_id) {
      return res.redirect("/reference-verified?status=invalid");
    }

    const refId = parseInt(String(reference_id));
    if (isNaN(refId)) {
      return res.redirect("/reference-verified?status=invalid");
    }

    const reference = await storage.getReferenceById(refId);
    if (!reference) {
      return res.redirect("/reference-verified?status=invalid");
    }

    if (reference.verification_type === "linkedin" || reference.verification_type === "eventlink_member") {
      return res.redirect("/reference-verified?status=success&method=linkedin");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return res.redirect("/reference-verified?status=error&reason=linkedin_not_configured");
    }

    const origin = getOrigin(req);
    const redirectUri = `${origin}/api/references/linkedin-callback`;
    const nonce = crypto.randomBytes(16).toString("hex");
    const exp = String(Date.now() + 10 * 60 * 1000);
    const state = signLinkedInState({ reference_id: String(refId), nonce, exp });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state,
    });

    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
  } catch (err) {
    console.error("startLinkedInReferenceAuth error:", err);
    res.redirect("/reference-verified?status=error");
  }
}

export async function linkedInReferenceCallback(req: Request, res: Response) {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError || !code || !state) {
      return res.redirect("/reference-verified?status=invalid");
    }

    const payload = verifyLinkedInState(String(state));
    if (!payload || !payload.reference_id) {
      console.warn("LinkedIn reference callback: invalid or expired state");
      return res.redirect("/reference-verified?status=invalid");
    }

    const referenceId = parseInt(payload.reference_id);
    if (isNaN(referenceId)) {
      return res.redirect("/reference-verified?status=invalid");
    }

    const reference = await storage.getReferenceById(referenceId);
    if (!reference) {
      return res.redirect("/reference-verified?status=invalid");
    }

    if (reference.verification_type === "linkedin" || reference.verification_type === "eventlink_member") {
      return res.redirect("/reference-verified?status=success&method=linkedin");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.redirect("/reference-verified?status=error&reason=linkedin_not_configured");
    }

    const origin = getOrigin(req);
    const redirectUri = `${origin}/api/references/linkedin-callback`;

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error("LinkedIn token exchange failed:", await tokenRes.text());
      return res.redirect("/reference-verified?status=error&reason=linkedin_token_failed");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      console.error("LinkedIn userinfo fetch failed:", await userInfoRes.text());
      return res.redirect("/reference-verified?status=error&reason=linkedin_profile_failed");
    }

    const userInfo = await userInfoRes.json();

    const linkedinName = [userInfo.given_name, userInfo.family_name].filter(Boolean).join(" ") || null;

    await storage.updateReferenceVerification(referenceId, {
      verification_type: "linkedin",
      linkedin_name: linkedinName,
      linkedin_title: null,
      linkedin_company: null,
      linkedin_profile_id: userInfo.sub || null,
      verified_email: userInfo.email || null,
      verification_timestamp: new Date(),
      verification_token: null,
    });

    return res.redirect("/reference-verified?status=success&method=linkedin");
  } catch (err) {
    console.error("linkedInReferenceCallback error:", err);
    return res.redirect("/reference-verified?status=error");
  }
}

export async function getMyReferenceToken(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const token = await storage.getOrCreateReferenceToken(userId);
    const protocol = ((req.headers["x-forwarded-proto"] as string) || req.protocol || "https").split(",")[0].trim();
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "eventlink.one";
    const baseUrl = `${protocol}://${host}`;
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
    const sanitized = references.map(ref => ({
      id: ref.id,
      freelancer_id: ref.freelancer_id,
      referee_name: ref.referee_name,
      referee_organisation: ref.referee_organisation,
      referee_role: ref.referee_role,
      q1_confirmed: ref.q1_confirmed,
      q2_rating: ref.q2_rating,
      q3_would_work_again: ref.q3_would_work_again,
      comment: ref.comment,
      badge_result: ref.badge_result,
      verification_type: ref.verification_type,
      domain_trust_level: ref.domain_trust_level,
      linkedin_name: ref.linkedin_name,
      linkedin_title: ref.linkedin_title,
      linkedin_company: ref.linkedin_company,
      eventlink_user_id: ref.eventlink_user_id,
      created_at: ref.created_at,
    }));
    res.json(sanitized);
  } catch (err) {
    console.error("getPublicReferences error:", err);
    res.status(500).json({ error: "Failed to get references" });
  }
}

export async function createReferenceRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { referee_email, referee_name } = req.body;
    if (!referee_email || !referee_email.trim()) {
      return res.status(400).json({ error: "Referee email is required" });
    }

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (referee_email.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({ error: "You cannot request a reference from yourself" });
    }

    const token = await storage.getOrCreateReferenceToken(userId);

    const request = await storage.createReferenceRequest({
      freelancer_id: userId,
      referee_email: referee_email.trim().toLowerCase(),
      referee_name: referee_name?.trim() || null,
    });

    try {
      const referenceUrl = `https://eventlink.one/reference/${token}`;
      const freelancerName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "A colleague";
      await sendEmail({
        to: referee_email,
        subject: `${freelancerName} has requested a professional reference`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#D8690E,#f59e0b);padding:24px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:22px">EventLink</h1>
            </div>
            <div style="background:#fff;padding:28px;border-radius:0 0 8px 8px;border:1px solid #eee">
              <h2 style="color:#1a1a1a;margin:0 0 16px">Reference Request</h2>
              <p style="color:#444;margin:0 0 12px">
                <strong>${freelancerName}</strong> has asked you to provide a brief professional reference on EventLink.
              </p>
              <p style="color:#444;margin:0 0 20px">
                It takes approximately 45 seconds and helps build verified professional reputations in the events industry.
              </p>
              <a href="${referenceUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#D8690E,#f59e0b);color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                Submit Reference
              </a>
              <p style="color:#999;font-size:12px;margin:20px 0 0">
                If you don't know this person, you can safely ignore this email.
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send reference request email:", emailErr);
    }

    res.status(201).json(request);
  } catch (err) {
    console.error("createReferenceRequest error:", err);
    res.status(500).json({ error: "Failed to create reference request" });
  }
}

export async function getReferenceRequests(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const requests = await storage.getReferenceRequests(userId);
    const total = requests.length;
    const completed = requests.filter(r => r.status === "completed").length;
    const pending = requests.filter(r => r.status === "pending").length;

    res.json({
      requests,
      summary: { total, completed, pending },
    });
  } catch (err) {
    console.error("getReferenceRequests error:", err);
    res.status(500).json({ error: "Failed to get reference requests" });
  }
}

export async function cancelReferenceRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

    const request = await storage.getReferenceRequestById(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.freelancer_id !== userId) return res.status(403).json({ error: "Not authorized" });
    if (request.status !== "pending") return res.status(400).json({ error: "Can only cancel pending requests" });

    const updated = await storage.updateReferenceRequest(requestId, { status: "cancelled" });
    res.json(updated);
  } catch (err) {
    console.error("cancelReferenceRequest error:", err);
    res.status(500).json({ error: "Failed to cancel request" });
  }
}

export async function sendReferenceReminder(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

    const request = await storage.getReferenceRequestById(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.freelancer_id !== userId) return res.status(403).json({ error: "Not authorized" });
    if (request.status !== "pending") return res.status(400).json({ error: "Can only remind for pending requests" });
    if (request.reminder_sent) return res.status(400).json({ error: "Reminder has already been sent" });

    const user = await storage.getUser(userId);
    const token = await storage.getOrCreateReferenceToken(userId);
    const referenceUrl = `https://eventlink.one/reference/${token}`;
    const freelancerName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "A colleague";

    try {
      await sendEmail({
        to: request.referee_email,
        subject: `Gentle reminder: ${freelancerName} is still waiting for your reference`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#D8690E,#f59e0b);padding:24px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:22px">EventLink</h1>
            </div>
            <div style="background:#fff;padding:28px;border-radius:0 0 8px 8px;border:1px solid #eee">
              <h2 style="color:#1a1a1a;margin:0 0 16px">Quick Reminder</h2>
              <p style="color:#444;margin:0 0 12px">
                <strong>${freelancerName}</strong> recently asked you for a brief professional reference. It only takes about 45 seconds.
              </p>
              <a href="${referenceUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#D8690E,#f59e0b);color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
                Submit Reference
              </a>
              <p style="color:#999;font-size:12px;margin:20px 0 0">
                No further reminders will be sent. If you don't know this person, please ignore this email.
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send reminder email:", emailErr);
    }

    const updated = await storage.updateReferenceRequest(requestId, {
      reminder_sent: true,
      reminder_sent_at: new Date(),
    });

    res.json(updated);
  } catch (err) {
    console.error("sendReferenceReminder error:", err);
    res.status(500).json({ error: "Failed to send reminder" });
  }
}

export async function reportReference(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const referenceId = parseInt(req.params.referenceId);
    if (isNaN(referenceId)) return res.status(400).json({ error: "Invalid reference ID" });

    const reference = await storage.getReferenceById(referenceId);
    if (!reference) return res.status(404).json({ error: "Reference not found" });

    const { reason } = req.body;

    const report = await storage.createReferenceReport({
      reference_id: referenceId,
      reporter_id: userId,
      reason: reason?.trim() || null,
    });

    res.status(201).json({ message: "Report submitted", report });
  } catch (err) {
    console.error("reportReference error:", err);
    res.status(500).json({ error: "Failed to report reference" });
  }
}

export async function getDomainTrustInfo(req: Request, res: Response) {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    const info = getDomainTrustLevel(email);
    res.json(info);
  } catch (err) {
    console.error("getDomainTrustInfo error:", err);
    res.status(500).json({ error: "Failed to get domain trust info" });
  }
}
