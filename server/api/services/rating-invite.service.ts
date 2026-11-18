import { randomUUID } from "crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { freelancer_profiles, ratings } from "@shared/schema";
import { db } from "../config/db";

/**
 * Direct ("invited") ratings: a freelancer sends a link to a past client from
 * work done off EventLink. The link carries rating_invite_token — its own
 * token, separate from the reference/share token, so a leaked rating link
 * grants nothing else and can be reset on its own.
 */

export { tokensMatch } from "../utils/token-compare";

export async function getRatingInviteToken(freelancerId: number, rotate = false): Promise<string> {
  const [p] = await db
    .select({ token: freelancer_profiles.rating_invite_token })
    .from(freelancer_profiles)
    .where(eq(freelancer_profiles.user_id, freelancerId));
  if (p?.token && !rotate) return p.token;
  const token = randomUUID();
  await db
    .update(freelancer_profiles)
    .set({ rating_invite_token: token })
    .where(eq(freelancer_profiles.user_id, freelancerId));
  return token;
}

export async function storedRatingInviteToken(freelancerId: number): Promise<string | null> {
  const [p] = await db
    .select({ token: freelancer_profiles.rating_invite_token })
    .from(freelancer_profiles)
    .where(eq(freelancer_profiles.user_id, freelancerId));
  return p?.token ?? null;
}

/**
 * Issue a new share/reference token. Every share link, QR code and reference
 * request link sent before stops working.
 */
export async function rotateReferenceToken(freelancerId: number): Promise<string> {
  const token = randomUUID();
  await db
    .update(freelancer_profiles)
    .set({ reference_token: token })
    .where(eq(freelancer_profiles.user_id, freelancerId));
  return token;
}

/** One direct rating per employer per freelancer (removed ones don't count). */
export async function hasDirectRating(recruiterId: number, freelancerId: number): Promise<boolean> {
  const rows = await db
    .select({ id: ratings.id })
    .from(ratings)
    .where(
      and(
        eq(ratings.recruiter_id, recruiterId),
        eq(ratings.freelancer_id, freelancerId),
        isNull(ratings.job_application_id),
        ne(ratings.status, "removed")
      )
    )
    .limit(1);
  return rows.length > 0;
}
