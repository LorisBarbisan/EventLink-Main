import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";

const UK_COUNTRY_VALUES = new Set([
  "united kingdom",
  "uk",
  "gb",
  "gbr",
  "great britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
]);

function isUkCountry(country: unknown): boolean {
  if (typeof country !== "string") return false;
  return UK_COUNTRY_VALUES.has(country.trim().toLowerCase());
}

/**
 * Gate for UK-specific tax surfaces (Books, mileage, expenses, import, SA exports).
 *
 * - UK country  → pass
 * - NULL country → pass  (prompt shown client-side; don't remove access before they answer)
 * - non-UK      → 404   (not 403, to avoid confirming the feature exists)
 * - No profile  → pass  (new user; country prompt will follow)
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
    const profile = await storage.getFreelancerProfile(userId);
    if (!profile) return next(); // no profile yet — new user, pass through
    const country = profile.country;
    if (country === null || country === undefined) return next(); // unanswered → pass
    if (isUkCountry(country)) return next();
    res.status(404).json({ error: "Not found" });
  } catch {
    // Fail open: don't remove access on a transient DB error
    next();
  }
}
