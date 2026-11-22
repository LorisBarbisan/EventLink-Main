import type { Request, Response } from "express";

/**
 * JSON 404 for any /api path no route answered.
 *
 * Mounted after every API route and before the SPA catch-all. Without it the
 * catch-all serves index.html with a 200 for a mistyped or removed endpoint:
 * the client's `response.ok` is true, `.json()` then throws a SyntaxError,
 * and an uptime check on an API path reports healthy whether or not the
 * route exists.
 */
export function apiNotFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}
