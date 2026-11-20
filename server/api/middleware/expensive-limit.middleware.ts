import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/**
 * A backstop for work that is expensive per request: the year-end workbook,
 * CSV/Excel exports, import upload and commit, invoice PDFs and receipt
 * uploads. The buttons already stop double-taps; this stops a stuck loop or a
 * script from tying up the one instance everyone shares.
 *
 * Keyed on the signed-in user, not the IP: a whole crew on a venue's wifi
 * shares one address. Lenient on purpose — 12 per minute per user across all
 * of these together is far above any real use.
 */
export const expensiveWorkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const id = (req as Request & { user?: { id?: number } }).user?.id;
    return id ? `user:${id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: {
    error: "That's a lot of downloads in a short time — please wait a minute and try again.",
  },
});

/**
 * Receipt uploads get their own, roomier allowance: filing a stack of
 * receipts at a desk is a real burst, and shouldn't eat the export budget.
 */
export const receiptUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const id = (req as Request & { user?: { id?: number } }).user?.id;
    return id ? `user:${id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: { error: "Too many receipts in a minute — please wait a moment and try again." },
});
