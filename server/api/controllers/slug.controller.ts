import type { Request, Response } from "express";
import { storage } from "../../storage";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function checkSlugAvailability(req: Request, res: Response) {
  const slug = (req.query.slug as string | undefined)?.toLowerCase().trim();
  const excludeUserId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;

  if (!slug) return res.status(400).json({ available: false, reason: "No slug provided." });

  if (!SLUG_REGEX.test(slug)) {
    return res.json({
      available: false,
      reason: "Must be 3–30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
    });
  }

  const result = await storage.checkSlugAvailability(slug, excludeUserId);
  return res.json(result);
}

export async function setCustomSlug(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });

  const userId = (req.user as any).id as number;
  const { slug } = req.body as { slug: string | null };

  if (slug !== null) {
    const normalized = slug.toLowerCase().trim();
    if (!SLUG_REGEX.test(normalized)) {
      return res.status(400).json({ error: "Invalid slug format." });
    }
    const check = await storage.checkSlugAvailability(normalized, userId);
    if (!check.available) return res.status(409).json({ error: check.reason });

    const profile = await storage.setFreelancerCustomSlug(userId, normalized);
    return res.json({ profile, slug: normalized });
  }

  const profile = await storage.setFreelancerCustomSlug(userId, null);
  return res.json({ profile, slug: null });
}
