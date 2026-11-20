import { eq, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../config/db";
import { reportInfo } from "../utils/error-reporting";

/**
 * Addresses that hard-bounce or complain stop receiving email: sending to
 * them is useless and damages the sending reputation every message shares.
 * The person sees a banner saying their address is failing, and can clear it
 * once it's fixed.
 */
import { suppressionFor } from "../utils/sendgrid-events";
export { suppressionFor, verifySendgridSignature } from "../utils/sendgrid-events";

export async function recordSendgridEvents(
  events: Array<{ email?: string; event?: string; type?: string; reason?: string }>
): Promise<number> {
  let n = 0;
  for (const e of events) {
    const reason = suppressionFor(e);
    if (!reason || !e.email) continue;
    const rows = await db
      .update(users)
      .set({ email_suppressed_at: new Date(), email_suppression_reason: reason })
      .where(sql`lower(${users.email}) = ${e.email.toLowerCase()}`)
      .returning({ id: users.id });
    if (rows.length) {
      n++;
      // ids only — never the address
      reportInfo("email suppressed", { users: rows.map((r) => r.id), cause: reason });
    }
  }
  return n;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const [row] = await db
    .select({ at: users.email_suppressed_at })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return !!row?.at;
}

export async function emailStatus(userId: number) {
  const [row] = await db
    .select({ at: users.email_suppressed_at, reason: users.email_suppression_reason })
    .from(users)
    .where(eq(users.id, userId));
  return { suppressed: !!row?.at, reason: row?.reason ?? null, since: row?.at ?? null };
}

export async function clearSuppression(userId: number) {
  await db
    .update(users)
    .set({ email_suppressed_at: null, email_suppression_reason: null })
    .where(eq(users.id, userId));
}
