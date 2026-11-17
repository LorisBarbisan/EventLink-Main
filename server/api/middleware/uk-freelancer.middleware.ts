import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import { isUkCountry, isCountryUnset } from "@shared/uk-country";

type Verdict = "pass" | "blocked";

async function ukVerdict(userId: number): Promise<Verdict> {
  const profile = await storage.getFreelancerProfile(userId);
  if (!profile) return "pass"; // no profile yet — new user
  if (isCountryUnset(profile.country)) return "pass"; // unanswered (incl. "") → prompt client-side
  return isUkCountry(profile.country) ? "pass" : "blocked";
}

/**
 * Gate for UK-specific tax surfaces (Books and everything under it).
 *
 * - UK country             → pass
 * - no / empty country     → pass  (prompt shown client-side)
 * - no profile             → pass  (new user)
 * - non-UK                 → 404   (not 403, so the feature is not confirmed)
 * - database error         → pass  (fail open: never remove access on a blip)
 */
export async function requireUkFreelancer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    if ((await ukVerdict(userId)) === "pass") return next();
    res.status(404).json({ error: "Not found" });
  } catch {
    next();
  }
}

/**
 * For exports of a freelancer's own records: the UK gate, except that anyone
 * who already has records can always take them away. A freelancer who moves
 * abroad keeps the right to download what they recorded; an export is not a
 * UK tax surface.
 */
export async function requireUkOrOwnRecords(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    if ((await ukVerdict(userId)) === "pass") return next();
    if (await storage.hasBooksRecords(userId)) return next();
    res.status(404).json({ error: "Not found" });
  } catch {
    next();
  }
}
