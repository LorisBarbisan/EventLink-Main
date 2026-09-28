import cron from "node-cron";
import { db } from "../config/db";
import { invoices, invoice_reminders } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { storage } from "../../storage";

type ReminderStage = "due_soon" | "overdue_1" | "overdue_7" | "overdue_14" | "final";

interface StageRule {
  stage: ReminderStage;
  /** Positive = days AFTER due date; negative = days BEFORE */
  daysOffset: number;
}

const STAGES: StageRule[] = [
  { stage: "due_soon", daysOffset: -3 },
  { stage: "overdue_1", daysOffset: 1 },
  { stage: "overdue_7", daysOffset: 7 },
  { stage: "overdue_14", daysOffset: 14 },
  { stage: "final", daysOffset: 30 },
];

const STAGE_TITLES: Record<ReminderStage, string> = {
  due_soon: "Invoice due in 3 days",
  overdue_1: "Invoice overdue",
  overdue_7: "Invoice 7 days overdue",
  overdue_14: "Invoice 14 days overdue",
  final: "Invoice 30 days overdue — action required",
};

export function registerInvoiceChaserScheduler(): void {
  // 09:00 every day, Europe/London
  cron.schedule("0 9 * * *", runChaser, { timezone: "Europe/London" });
  console.log("✅ Invoice chaser scheduler registered (daily 09:00 Europe/London)");
}

async function runChaser(): Promise<void> {
  try {
    // 1. Flip sent invoices past due_date to overdue
    const flipped = await storage.flipOverdueInvoices();
    if (flipped > 0) console.log(`📋 Invoice chaser: flipped ${flipped} invoice(s) to overdue`);

    // 2. Raise per-stage notifications for active invoices
    const today = new Date().toISOString().slice(0, 10);

    for (const rule of STAGES) {
      const targetDate = offsetDate(today, -rule.daysOffset); // the due_date that triggers this stage today

      // Invoices whose due_date matches this stage's trigger date,
      // status is sent or overdue, not yet paid/cancelled,
      // and haven't already had this stage actioned
      const rows = await db
        .select({
          id: invoices.id,
          freelancer_id: invoices.freelancer_id,
          invoice_number: invoices.invoice_number,
        })
        .from(invoices)
        .where(
          and(
            sql`${invoices.due_date} = ${targetDate}`,
            sql`${invoices.status} IN ('sent', 'overdue')`
          )
        );

      for (const inv of rows) {
        // Check if this stage already has a row (unique constraint prevents duplicates at DB level too)
        const existing = await db
          .select({ id: invoice_reminders.id })
          .from(invoice_reminders)
          .where(
            and(
              eq(invoice_reminders.invoice_id, inv.id),
              eq(invoice_reminders.stage as any, rule.stage)
            )
          )
          .limit(1);

        if (existing.length > 0) continue; // already actioned

        await storage.createNotification({
          user_id: inv.freelancer_id,
          type: "system",
          title: STAGE_TITLES[rule.stage],
          message: `Invoice ${inv.invoice_number} — ${STAGE_TITLES[rule.stage].toLowerCase()}. Open your invoices tab to send a reminder.`,
          related_entity_type: null,
          related_entity_id: null,
          action_url: `/dashboard?tab=invoices`,
          metadata: JSON.stringify({ invoice_id: inv.id, stage: rule.stage }),
        });

        console.log(
          `🔔 Invoice chaser: raised ${rule.stage} notification for invoice ${inv.invoice_number} (id=${inv.id})`
        );
      }
    }
  } catch (err) {
    console.error("Invoice chaser run failed:", err);
  }
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
