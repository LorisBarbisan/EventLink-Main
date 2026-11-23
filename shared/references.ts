/**
 * Which references may be shown publicly.
 *
 * The card at `/card/:userId` and the public profile both read references from
 * an unauthenticated endpoint, so what counts as "public" has to be decided in
 * exactly one place and enforced at the data layer — not in a view.
 */

/**
 * Badge values that must never reach a public card or profile.
 *
 * - `flagged` — the referee did not confirm the working relationship, or the
 *   fraud checks tripped. Never a signal to publish.
 * - `verified_private` — the referee rated the work "mixed", or said they would
 *   be unlikely to work with the person again (see `computeBadge` in
 *   reference.controller.ts). It still counts towards the verification signal
 *   and still reaches an admin; it just isn't published on a document the
 *   freelancer uses to win work. (Decision: ref epic §2.1.)
 */
export const NON_PUBLIC_BADGE_RESULTS = ["flagged", "verified_private"] as const;

export type NonPublicBadgeResult = (typeof NON_PUBLIC_BADGE_RESULTS)[number];

/**
 * True when a reference may appear on the public, unauthenticated card/profile.
 *
 * A reference is withheld when it is flagged, when its badge is one of
 * {@link NON_PUBLIC_BADGE_RESULTS}, or when it has no computed badge at all
 * (an unknown state is not something to publish). This mirrors the SQL filter
 * in `storage.getPublicReferences`, which is built from the same constant.
 */
export function isPublicReference(ref: {
  is_flagged?: boolean | null;
  badge_result?: string | null;
}): boolean {
  if (ref.is_flagged) return false;
  if (ref.badge_result == null) return false;
  return !(NON_PUBLIC_BADGE_RESULTS as readonly string[]).includes(ref.badge_result);
}
