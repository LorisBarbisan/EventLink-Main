import type { Express, Request, Response } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { emailChangeLimiter, emailResetLimiter } from "../middleware/expensive-limit.middleware";
import {
  confirmEmailChange,
  pendingEmailFor,
  requestEmailChange,
} from "../services/email-change.service";
import {
  clearSuppression,
  emailStatus,
  recordSendgridEvents,
  verifySendgridSignature,
} from "../services/email-suppression.service";
import { getOrigin } from "../utils/auth.util";
import { reportError } from "../utils/error-reporting";
import { isFreshTimestamp } from "../utils/sendgrid-events";

/**
 * POST /api/webhooks/sendgrid — SendGrid's signed event webhook. Registered in
 * server/index.ts with express.raw() so the signature can be checked against
 * the exact bytes received. Refuses anything unsigned or stale (and
 * everything, if the public key isn't configured).
 */
export async function sendgridEventWebhook(req: Request, res: Response) {
  const key = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: "Webhook not configured" });
  const sig = req.get("X-Twilio-Email-Event-Webhook-Signature");
  const ts = req.get("X-Twilio-Email-Event-Webhook-Timestamp");
  const raw = req.body as Buffer;
  if (!sig || !ts || !Buffer.isBuffer(raw) || !verifySendgridSignature(key, raw, sig, ts)) {
    return res.status(403).json({ error: "Invalid signature" });
  }
  if (!isFreshTimestamp(ts)) return res.status(403).json({ error: "Stale timestamp" });
  try {
    const events = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(events)) return res.status(400).json({ error: "Expected an array" });
    await recordSendgridEvents(events);
    return res.status(204).end();
  } catch (err) {
    reportError(err, { tags: { kind: "webhook", source: "sendgrid" } });
    // 500 makes SendGrid retry later, which is what we want
    return res.status(500).json({ error: "Failed to record events" });
  }
}

const CHANGE_ERRORS: Record<string, [number, string]> = {
  invalid_email: [400, "That doesn't look like an email address."],
  same_email: [400, "That's already your email address."],
  email_taken: [409, "Another account already uses that address."],
  social_account: [
    400,
    "You sign in with Google or LinkedIn, so your address comes from there. Contact support to change it.",
  ],
  wrong_password: [400, "Your password isn't right."],
  not_found: [404, "Account not found."],
};

/**
 * The signed-in person's email status, "I've fixed it — try again", and
 * changing the address (confirmed by a link sent to the new one).
 */
export function registerEmailStatusRoutes(app: Express) {
  app.get("/api/me/email-status", authenticateJWT, async (req: Request, res: Response) => {
    const id = (req as any).user.id;
    const [status, pendingEmail] = await Promise.all([emailStatus(id), pendingEmailFor(id)]);
    res.json({ ...status, pendingEmail });
  });

  app.post(
    "/api/me/email-status/reset",
    authenticateJWT,
    emailResetLimiter,
    async (req: Request, res: Response) => {
      await clearSuppression((req as any).user.id);
      res.json({ suppressed: false });
    }
  );

  app.post(
    "/api/me/email",
    authenticateJWT,
    emailChangeLimiter,
    async (req: Request, res: Response) => {
      try {
        const r = await requestEmailChange(
          (req as any).user.id,
          req.body?.email,
          req.body?.password,
          getOrigin(req)
        );
        if (!r.ok) {
          const [status, error] = CHANGE_ERRORS[r.error];
          return res.status(status).json({ error, code: r.error });
        }
        res.json({ pendingEmail: r.pendingEmail });
      } catch (err) {
        reportError(err, { tags: { kind: "email-change" } });
        res.status(500).json({ error: "We couldn't send the confirmation email. Try again." });
      }
    }
  );

  // Opened from the email, possibly signed out or on another device
  app.get("/confirm-email-change", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    try {
      const r = await confirmEmailChange(token);
      res.redirect(
        `${getOrigin(req)}/dashboard?${r.ok ? "email_changed=1" : `email_change_error=${r.error}`}`
      );
    } catch (err) {
      reportError(err, { tags: { kind: "email-change" } });
      res.redirect(`${getOrigin(req)}/dashboard?email_change_error=failed`);
    }
  });
}
