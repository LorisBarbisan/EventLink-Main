import type { NextFunction, Request, Response } from "express";
import { SITE_URL } from "../config/site";

/**
 * Hosts that serve the same app but aren't its address: send visitors on to
 * SITE_URL with a 301, keeping the path and query.
 *
 * Only GET and HEAD move. Anything else (Stripe, SendGrid and Google Calendar
 * webhooks registered while a legacy host was the address) is served where it
 * landed, because a 301 turns a POST into a GET and drops the body.
 */
export const LEGACY_HOSTS = ["app.eventlink.one"];

export function canonicalRedirect(
  method: string,
  hostname: string,
  originalUrl: string,
  siteUrl: string = SITE_URL
): string | null {
  if (method !== "GET" && method !== "HEAD") return null;
  const host = hostname.toLowerCase();
  if (!LEGACY_HOSTS.includes(host)) return null;
  let target: URL;
  try {
    target = new URL(siteUrl);
  } catch {
    return null;
  }
  if (target.hostname === host) return null; // the legacy host *is* the site
  return `${target.origin}${originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`}`;
}

export function canonicalHost(req: Request, res: Response, next: NextFunction) {
  const to = canonicalRedirect(req.method, req.hostname || "", req.originalUrl);
  if (to) return res.redirect(301, to);
  next();
}
