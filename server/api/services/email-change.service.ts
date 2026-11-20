import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../config/db";
import { cache } from "../utils/cache.util";
import { sendEmail } from "../utils/emailService";

/**
 * Changing your email address. The new address only replaces the old one
 * once the link sent to it is opened — so a typo can't lock anyone out, and
 * a stolen session can't quietly move the account (the password is asked
 * for too). Confirming also clears any bounce suppression: the flag sits on
 * the user row, but its cause was the old address.
 */

const LINK_HOURS = 24;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export type EmailChangeError =
  | "invalid_email"
  | "same_email"
  | "email_taken"
  | "social_account"
  | "wrong_password"
  | "not_found";

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function forgetUser(id: number, ...emails: string[]) {
  cache.delete(`user:${id}`);
  cache.delete(`user_with_profile:${id}`);
  for (const e of emails) cache.delete(`user:email:${e.toLowerCase()}`);
}

async function addressInUse(email: string, exceptUserId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, exceptUserId)))
    .limit(1);
  return !!row;
}

export async function requestEmailChange(
  userId: number,
  newEmailRaw: string,
  password: string,
  baseUrl: string
): Promise<{ ok: true; pendingEmail: string } | { ok: false; error: EmailChangeError }> {
  const newEmail = String(newEmailRaw ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(newEmail)) return { ok: false, error: "invalid_email" };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, error: "not_found" };
  if (!user.password) return { ok: false, error: "social_account" };
  if (!(await bcrypt.compare(String(password ?? ""), user.password))) {
    return { ok: false, error: "wrong_password" };
  }
  if (newEmail === user.email.toLowerCase()) return { ok: false, error: "same_email" };
  if (await addressInUse(newEmail, userId)) return { ok: false, error: "email_taken" };

  const token = randomBytes(32).toString("hex");
  await db
    .update(users)
    .set({
      pending_email: newEmail,
      pending_email_token: token,
      pending_email_expires: new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000),
    })
    .where(eq(users.id, userId));

  const url = `${baseUrl}/confirm-email-change?token=${token}`;
  await sendEmail({
    // The person just asked for this, at an address that isn't suppressed
    ignoreSuppression: true,
    to: newEmail,
    subject: "Confirm your new EventLink email address",
    html: `<p>Hi${user.first_name ? ` ${esc(user.first_name)}` : ""},</p>
<p>You asked to use <strong>${esc(newEmail)}</strong> for your EventLink account. Open this link to confirm — until you do, we keep using your old address.</p>
<p><a href="${url}">Confirm my new email address</a></p>
<p>The link works for ${LINK_HOURS} hours. If you didn't ask for this, ignore this email and nothing changes.</p>
<p>The EventLink Team</p>`,
    text: `You asked to use ${newEmail} for your EventLink account. Confirm it here (the link works for ${LINK_HOURS} hours):\n\n${url}\n\nIf you didn't ask for this, ignore this email and nothing changes.`,
  });

  return { ok: true, pendingEmail: newEmail };
}

export async function confirmEmailChange(
  token: string
): Promise<{ ok: true } | { ok: false; error: "invalid" | "email_taken" }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, error: "invalid" };
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.pending_email_token, token), gt(users.pending_email_expires, new Date())))
    .limit(1);
  if (!user?.pending_email) return { ok: false, error: "invalid" };
  const newEmail = user.pending_email;
  if (await addressInUse(newEmail, user.id)) return { ok: false, error: "email_taken" };

  try {
    await db
      .update(users)
      .set({
        email: newEmail,
        email_verified: true,
        pending_email: null,
        pending_email_token: null,
        pending_email_expires: null,
        email_suppressed_at: null,
        email_suppression_reason: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));
  } catch (err) {
    // unique(email): someone took the address between the check and here
    if ((err as { code?: string }).code === "23505") return { ok: false, error: "email_taken" };
    throw err;
  }
  forgetUser(user.id, user.email, newEmail);

  // Tell the old address — the usual guard against an account being moved
  // without its owner knowing. Skipped automatically if it's bouncing.
  sendEmail({
    to: user.email,
    subject: "Your EventLink email address was changed",
    html: `<p>The email address on your EventLink account was changed to <strong>${esc(newEmail)}</strong>.</p>
<p>If this wasn't you, reply to this email or contact support straight away.</p>`,
    text: `The email address on your EventLink account was changed to ${newEmail}. If this wasn't you, contact support straight away.`,
  }).catch(() => {
    /* best effort */
  });

  return { ok: true };
}

/** The address waiting for confirmation, if any (for the settings screen). */
export async function pendingEmailFor(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ e: users.pending_email, exp: users.pending_email_expires })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.e && row.exp && row.exp > new Date() ? row.e : null;
}
