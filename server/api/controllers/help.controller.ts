// ============================================================
// Contextual help system — server endpoints.
// All routes are behind authenticateJWT; the user id always comes from the
// token, never from the request body.
// ============================================================

import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { help_user_state, help_route_visits, help_content_overrides, users } from "@shared/schema";

type HelpEventType = "seen" | "dismissed" | "completed" | "visit";

interface HelpEvent {
  type: HelpEventType;
  key?: string;
  route?: string;
  at?: string; // ISO timestamp
  count?: number; // aggregate count (seen / visit)
  version?: number; // entry content version at interaction time
}

function reqUserId(req: Request): number | null {
  const id = (req as any).user?.id;
  return typeof id === "number" ? id : null;
}

function toDate(at?: string): Date {
  if (!at) return new Date();
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// GET /api/help/state → { entries, routes, mode }
export async function getHelpState(req: Request, res: Response) {
  try {
    const userId = reqUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [states, visits, [user]] = await Promise.all([
      db.select().from(help_user_state).where(eq(help_user_state.user_id, userId)),
      db.select().from(help_route_visits).where(eq(help_route_visits.user_id, userId)),
      db.select({ help_mode: users.help_mode }).from(users).where(eq(users.id, userId)).limit(1),
    ]);

    const entries: Record<string, unknown> = {};
    for (const s of states) {
      entries[s.help_key] = {
        seenCount: s.seen_count,
        lastSeenAt: s.last_seen_at,
        dismissedCount: s.dismissed_count,
        dismissedAt: s.dismissed_at,
        completedAt: s.completed_at,
        contentVersion: s.content_version,
      };
    }

    const routes: Record<string, number> = {};
    for (const v of visits) routes[v.route] = v.visit_count;

    res.set("Cache-Control", "no-store");
    res.json({ entries, routes, mode: user?.help_mode ?? "full" });
  } catch (error) {
    console.error("getHelpState error:", error);
    res.status(500).json({ error: "Failed to load help state" });
  }
}

// POST /api/help/events → batched array of { type, key?, route?, at?, count?, version? }
export async function postHelpEvents(req: Request, res: Response) {
  try {
    const userId = reqUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const events: HelpEvent[] = Array.isArray(req.body?.events) ? req.body.events : [];
    if (events.length === 0) return res.json({ ok: true, applied: 0 });

    let applied = 0;
    for (const ev of events) {
      const at = toDate(ev.at);
      if (ev.type === "visit") {
        if (!ev.route) continue;
        const count = Math.max(1, Number(ev.count) || 1);
        await db
          .insert(help_route_visits)
          .values({
            user_id: userId,
            route: ev.route,
            visit_count: count,
            first_visited_at: at,
            last_visited_at: at,
          })
          .onConflictDoUpdate({
            target: [help_route_visits.user_id, help_route_visits.route],
            set: {
              // Server is cross-device truth: take the larger visit count.
              visit_count: sql`greatest(${help_route_visits.visit_count}, excluded.visit_count)`,
              last_visited_at: sql`greatest(${help_route_visits.last_visited_at}, excluded.last_visited_at)`,
            },
          });
        applied++;
        continue;
      }

      if (!ev.key) continue;
      const version = Number(ev.version) || 1;

      if (ev.type === "seen") {
        const count = Math.max(1, Number(ev.count) || 1);
        await db
          .insert(help_user_state)
          .values({
            user_id: userId,
            help_key: ev.key,
            seen_count: count,
            last_seen_at: at,
            content_version: version,
            updated_at: at,
          })
          .onConflictDoUpdate({
            target: [help_user_state.user_id, help_user_state.help_key],
            set: {
              seen_count: sql`greatest(${help_user_state.seen_count}, excluded.seen_count)`,
              last_seen_at: sql`greatest(${help_user_state.last_seen_at}, excluded.last_seen_at)`,
              content_version: sql`excluded.content_version`,
              updated_at: at,
            },
          });
        applied++;
      } else if (ev.type === "dismissed") {
        await db
          .insert(help_user_state)
          .values({
            user_id: userId,
            help_key: ev.key,
            dismissed_count: 1,
            dismissed_at: at,
            content_version: version,
            updated_at: at,
          })
          .onConflictDoUpdate({
            target: [help_user_state.user_id, help_user_state.help_key],
            set: {
              dismissed_count: sql`${help_user_state.dismissed_count} + 1`,
              // Earliest dismissal wins (first time it was dismissed).
              dismissed_at: sql`least(${help_user_state.dismissed_at}, excluded.dismissed_at)`,
              content_version: sql`excluded.content_version`,
              updated_at: at,
            },
          });
        applied++;
      } else if (ev.type === "completed") {
        await db
          .insert(help_user_state)
          .values({
            user_id: userId,
            help_key: ev.key,
            completed_at: at,
            content_version: version,
            updated_at: at,
          })
          .onConflictDoUpdate({
            target: [help_user_state.user_id, help_user_state.help_key],
            set: {
              completed_at: sql`least(${help_user_state.completed_at}, excluded.completed_at)`,
              updated_at: at,
            },
          });
        applied++;
      }
    }

    res.json({ ok: true, applied });
  } catch (error) {
    console.error("postHelpEvents error:", error);
    res.status(500).json({ error: "Failed to record help events" });
  }
}

// PATCH /api/help/preferences → { mode: "full" | "hover_only" | "off" }
export async function patchHelpPreferences(req: Request, res: Response) {
  try {
    const userId = reqUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const mode = req.body?.mode;
    if (mode !== "full" && mode !== "hover_only" && mode !== "off") {
      return res.status(400).json({ error: "Invalid help mode" });
    }

    await db.update(users).set({ help_mode: mode }).where(eq(users.id, userId));
    res.json({ ok: true, mode });
  } catch (error) {
    console.error("patchHelpPreferences error:", error);
    res.status(500).json({ error: "Failed to update help preferences" });
  }
}

// GET /api/help/content → admin copy override rows (merged over the registry client-side)
export async function getHelpContent(_req: Request, res: Response) {
  try {
    const rows = await db.select().from(help_content_overrides);
    res.set("Cache-Control", "no-store");
    res.json({ overrides: rows });
  } catch (error) {
    console.error("getHelpContent error:", error);
    res.status(500).json({ error: "Failed to load help content" });
  }
}
