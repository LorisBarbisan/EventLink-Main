import { db } from "../config/db";
import { reportError } from "../utils/error-reporting";
import { LOCK, scheduleExclusive } from "../utils/scheduled-lock";
import { calendar_connections } from "@shared/schema";
import { and, eq, lt, isNotNull } from "drizzle-orm";
import { registerGoogleWebhook, stopGoogleWebhook } from "./googleCalendar.service";
import { syncAllBookings, readExternalEvents } from "./calendarSync.service";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";
const GOOGLE_WEBHOOK_URL = `${BASE_URL}/api/calendar/webhook/google`;

/** Renew Google watch channels expiring within the next 24 hours. */
async function renewGoogleWebhooks(): Promise<void> {
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const expiring = await db
    .select()
    .from(calendar_connections)
    .where(
      and(
        eq(calendar_connections.provider, "google"),
        eq(calendar_connections.status, "active"),
        isNotNull(calendar_connections.webhook_expires_at),
        lt(calendar_connections.webhook_expires_at, cutoff)
      )
    );

  for (const conn of expiring) {
    try {
      // Stop old channel then register a fresh one
      if (conn.webhook_channel_id && conn.webhook_resource_id) {
        await stopGoogleWebhook(conn.user_id, conn.webhook_channel_id, conn.webhook_resource_id);
      }
      const { channelId, resourceId, expiration } = await registerGoogleWebhook(
        conn.user_id,
        GOOGLE_WEBHOOK_URL
      );
      await db
        .update(calendar_connections)
        .set({
          webhook_channel_id: channelId,
          webhook_resource_id: resourceId,
          webhook_expires_at: expiration,
        })
        .where(eq(calendar_connections.user_id, conn.user_id));
      console.log(`[calendarScheduler] Google webhook renewed for user ${conn.user_id}`);
    } catch (err) {
      console.error(
        `[calendarScheduler] Google webhook renewal failed for user ${conn.user_id}:`,
        err
      );
      await db
        .update(calendar_connections)
        .set({ status: "needs_reconnect", last_error: "Webhook renewal failed" })
        .where(eq(calendar_connections.user_id, conn.user_id));
    }
  }
}

/** Daily reconciliation sweep — catches anything missed by delta/syncToken. */
async function dailyReconcile(): Promise<void> {
  const active = await db
    .select({ user_id: calendar_connections.user_id })
    .from(calendar_connections)
    .where(eq(calendar_connections.status, "active"));

  let synced = 0;
  for (const { user_id } of active) {
    try {
      await syncAllBookings(user_id);
      await readExternalEvents(user_id);
      synced++;
    } catch (err) {
      console.error(`[calendarScheduler] Daily reconcile failed for user ${user_id}:`, err);
    }
  }
  console.log(`[calendarScheduler] Daily reconcile: ${synced}/${active.length} users synced`);
}

export function registerCalendarScheduler(): void {
  // Renew Google webhooks every 6 hours
  scheduleExclusive(
    LOCK.CAL_GOOGLE_RENEW,
    "0 */6 * * *",
    () => {
      renewGoogleWebhooks().catch((err) =>
        reportError(err, {
          tags: { kind: "scheduled-job" },
          extra: { where: "[calendarScheduler] Google webhook renewal error:" },
        })
      );
    },
    { timezone: "Europe/London" }
  );

  // Daily reconciliation at 03:00 UK
  scheduleExclusive(
    LOCK.CAL_RECONCILE,
    "0 3 * * *",
    () => {
      dailyReconcile().catch((err) =>
        reportError(err, {
          tags: { kind: "scheduled-job" },
          extra: { where: "[calendarScheduler] Daily reconcile error:" },
        })
      );
    },
    { timezone: "Europe/London" }
  );

  console.log(
    "✅ Calendar scheduler registered (webhook renewal every 6h, reconcile daily at 03:00 UK)"
  );
}
