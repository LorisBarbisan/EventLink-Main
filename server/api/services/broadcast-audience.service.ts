import type { User } from "@shared/schema";
import { storage } from "../../storage";

export type BroadcastCategory = "announcement" | "service";

export interface BroadcastFilters {
  search?: string;
  role?: string;
  status?: string;
  profileStatus?: string;
  country?: string;
  // "all" | "3" | "6" | "12" — active (last_login_at) within N months
  lastActive?: string;
}

export interface AudienceBreakdown {
  matching: number;
  demo: number;
  unverified: number;
  suppressed: number;
  // Only meaningful for an announcement (service/legal is ungated).
  optedOut: number;
  willReceiveEmail: number;
  willReceiveInApp: number;
}

export interface ResolvedAudience {
  breakdown: AudienceBreakdown;
  emailRecipients: User[];
  inAppRecipients: User[];
}

/**
 * The single source of truth for who a broadcast reaches. The count endpoint
 * and the send path both call this, so the number a sender is shown is the
 * number that is actually used. Set-based (three queries) so it holds up on the
 * whole base rather than one preference lookup per recipient.
 *
 * Channel follows the type:
 *   announcement — email only, gated on email_system_updates; no in-app.
 *   service/legal — email (ungated) AND in-app for everyone matching.
 * Demo accounts never receive either. Unverified/suppressed addresses are
 * dropped from email (deliverability) but kept for the in-app message.
 */
export async function resolveBroadcastAudience(opts: {
  adminId: number;
  category: BroadcastCategory;
  userIds?: number[];
  filters?: BroadcastFilters;
}): Promise<ResolvedAudience> {
  const { adminId, category } = opts;

  // 1. Candidate users — an explicit id list, or the filter set.
  let candidates: User[];
  if (Array.isArray(opts.userIds) && opts.userIds.length > 0) {
    const idSet = new Set(opts.userIds);
    const { users } = await storage.getAllUsers(1, 100000);
    candidates = users.filter((u) => idSet.has(u.id));
  } else {
    const f = opts.filters ?? {};
    const norm = (v?: string) => (v && v !== "all" ? v : undefined);
    const { users } = await storage.getAllUsers(
      1,
      100000,
      f.search || undefined,
      norm(f.role),
      norm(f.status),
      "created_at",
      "desc",
      norm(f.profileStatus),
      norm(f.country)
    );
    candidates = users;
  }

  // Never the sender or another admin.
  candidates = candidates.filter((u) => u.id !== adminId && u.role !== "admin");

  // Last-active window (on last_login_at).
  const lastActive = opts.filters?.lastActive;
  if (lastActive && lastActive !== "all") {
    const months = Number(lastActive);
    if (Number.isFinite(months) && months > 0) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      candidates = candidates.filter(
        (u) => u.last_login_at != null && new Date(u.last_login_at) >= cutoff
      );
    }
  }

  const demoSet = new Set(await storage.getDemoUserIds());
  const optedOutSet = new Set(await storage.getSystemUpdatesOptedOutUserIds());

  // Cumulative exclusions, so the breakdown reads as a subtraction.
  const notDemo = candidates.filter((u) => !demoSet.has(u.id));
  const notUnverified = notDemo.filter((u) => u.email_verified);
  const notSuppressed = notUnverified.filter((u) => u.email_suppressed_at == null);
  const emailRecipients =
    category === "announcement"
      ? notSuppressed.filter((u) => !optedOutSet.has(u.id))
      : notSuppressed;

  // In-app: only for service/legal, and it doesn't bounce, so verification and
  // suppression don't apply — demo accounts are still excluded.
  const inAppRecipients = category === "announcement" ? [] : notDemo;

  const breakdown: AudienceBreakdown = {
    matching: candidates.length,
    demo: candidates.length - notDemo.length,
    unverified: notDemo.length - notUnverified.length,
    suppressed: notUnverified.length - notSuppressed.length,
    optedOut: category === "announcement" ? notSuppressed.length - emailRecipients.length : 0,
    willReceiveEmail: emailRecipients.length,
    willReceiveInApp: inAppRecipients.length,
  };

  return { breakdown, emailRecipients, inAppRecipients };
}
