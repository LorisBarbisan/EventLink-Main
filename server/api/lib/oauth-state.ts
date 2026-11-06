import crypto from "crypto";
import type { Request, Response } from "express";

const COOKIE = "oauth_state";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates a single-use CSRF nonce, sets it in an httpOnly cookie, and returns
 * the value to send as the OAuth `state` parameter. Any extra payload (such as
 * `role`) rides along inside the state and is returned by verifyOAuthState.
 */
export function createOAuthState(res: Response, payload: Record<string, unknown> = {}): string {
  const nonce = crypto.randomBytes(32).toString("base64url");

  res.cookie(COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must not be "strict" — the callback is a cross-site redirect.
    // NOTE: "lax" is sent on the GET callbacks (Google/LinkedIn/Facebook) but
    // NOT on a cross-site POST. Apple's callback is a form_post; if Apple is
    // ever wired up (no strategy is registered today) its state cookie needs
    // sameSite "none" (which requires secure) to survive that POST.
    maxAge: MAX_AGE_MS,
    path: "/",
  });

  return Buffer.from(JSON.stringify({ nonce, ...payload })).toString("base64url");
}

/**
 * Verifies the returned `state` against the cookie. Always clears the cookie,
 * so a nonce can only be used once whether it succeeds or fails.
 */
export function verifyOAuthState(
  req: Request,
  res: Response
): { ok: boolean; payload: Record<string, any> } {
  // GET callbacks carry state in the query; a form_post callback (Apple) in the body.
  const raw = (req.query.state as string | undefined) ?? (req.body?.state as string | undefined);
  const cookie = readCookie(req, COOKIE);

  res.clearCookie(COOKIE, { path: "/" });

  if (!raw || !cookie) return { ok: false, payload: {} };

  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false, payload: {} };
  }

  const a = Buffer.from(String(parsed?.nonce ?? ""), "utf8");
  const b = Buffer.from(cookie, "utf8");
  // timingSafeEqual throws on length mismatch, so check length first.
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  // Return the extra payload (e.g. role) without the nonce.
  const payload: Record<string, any> = { ...(parsed ?? {}) };
  delete payload.nonce;
  return { ok, payload };
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return null;
}
