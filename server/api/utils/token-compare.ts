import { timingSafeEqual } from "crypto";

/** Constant-time token comparison that fails closed when either side is missing. */
export function tokensMatch(
  presented: string | null | undefined,
  stored: string | null | undefined
): boolean {
  if (!presented || !stored) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
