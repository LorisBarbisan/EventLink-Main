import type { Express, Request, Response } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import {
  clearSuppression,
  emailStatus,
  recordSendgridEvents,
  verifySendgridSignature,
} from "../services/email-suppression.service";
import { reportError } from "../utils/error-reporting";

/**
 * POST /api/webhooks/sendgrid — SendGrid's signed event webhook. Registered in
 * server/index.ts with express.raw() so the signature can be checked against
 * the exact bytes received. Refuses anything unsigned (and everything, if the
 * public key isn't configured).
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

/** The signed-in person's email status, and "I've fixed it — try again". */
export function registerEmailStatusRoutes(app: Express) {
  app.get("/api/me/email-status", authenticateJWT, async (req: Request, res: Response) => {
    res.json(await emailStatus((req as any).user.id));
  });
  app.post("/api/me/email-status/reset", authenticateJWT, async (req: Request, res: Response) => {
    await clearSuppression((req as any).user.id);
    res.json({ suppressed: false });
  });
}
