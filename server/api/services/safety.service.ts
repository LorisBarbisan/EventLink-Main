import { sql } from "drizzle-orm";
import { db } from "../config/db";
import { ACTIVE_BOOKING_STATUSES, type ReportCategory, type ReportStatus } from "@shared/safety";

const ACTIVE = sql.raw(ACTIVE_BOOKING_STATUSES.map((s) => `'${s}'`).join(","));

export async function isBlockedEitherWay(a: number, b: number): Promise<boolean> {
  const rows = (await db.execute(sql`
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = ${a} AND blocked_id = ${b}) OR (blocker_id = ${b} AND blocked_id = ${a})
    LIMIT 1`)) as unknown as unknown[];
  return rows.length > 0;
}

export async function activeBookingsBetween(a: number, b: number): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM bookings
    WHERE status IN (${ACTIVE})
      AND ((employer_id = ${a} AND freelancer_id = ${b}) OR (employer_id = ${b} AND freelancer_id = ${a}))`)) as unknown as Array<{
    n: number;
  }>;
  return Number(rows[0]?.n ?? 0);
}

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (${blockerId}, ${blockedId})
    ON CONFLICT DO NOTHING`);
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<void> {
  await db.execute(
    sql`DELETE FROM user_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`
  );
}

export async function hasBlocked(blockerId: number, blockedId: number): Promise<boolean> {
  const rows = (await db.execute(sql`
    SELECT 1 FROM user_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`)) as unknown as unknown[];
  return rows.length > 0;
}

export async function createUserReport(r: {
  reporterId: number;
  subjectId: number;
  subjectName: string | null;
  category: ReportCategory;
  details: string | null;
  conversationId: number | null;
  bookingId: number | null;
}): Promise<{ id: number }> {
  const rows = (await db.execute(sql`
    INSERT INTO user_reports (reporter_id, subject_id, subject_name, category, details, conversation_id, booking_id)
    VALUES (${r.reporterId}, ${r.subjectId}, ${r.subjectName}, ${r.category}, ${r.details}, ${r.conversationId}, ${r.bookingId})
    RETURNING id`)) as unknown as Array<{ id: number }>;
  return rows[0];
}

export interface AdminReportRow {
  id: number;
  reporter_id: number | null;
  reporter_name: string | null;
  subject_id: number;
  subject_name: string | null;
  subject_deleted: boolean;
  category: ReportCategory;
  details: string | null;
  conversation_id: number | null;
  booking_id: number | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  /** How many reports this subject has in total — the pattern signal */
  subject_report_count: number;
}

export async function listUserReports(): Promise<AdminReportRow[]> {
  return (await db.execute(sql`
    SELECT r.id, r.reporter_id,
           NULLIF(TRIM(COALESCE(rep.first_name,'') || ' ' || COALESCE(rep.last_name,'')), '') AS reporter_name,
           r.subject_id,
           COALESCE(NULLIF(TRIM(COALESCE(sub.first_name,'') || ' ' || COALESCE(sub.last_name,'')), ''), r.subject_name) AS subject_name,
           (sub.id IS NULL) AS subject_deleted,
           r.category, r.details, r.conversation_id, r.booking_id, r.status, r.admin_notes, r.created_at,
           (SELECT COUNT(*)::int FROM user_reports x WHERE x.subject_id = r.subject_id) AS subject_report_count
    FROM user_reports r
    LEFT JOIN users rep ON rep.id = r.reporter_id
    LEFT JOIN users sub ON sub.id = r.subject_id
    ORDER BY (r.status = 'open') DESC, r.created_at DESC
    LIMIT 500`)) as unknown as AdminReportRow[];
}

export async function updateUserReport(
  id: number,
  patch: { status?: ReportStatus; admin_notes?: string | null }
): Promise<void> {
  await db.execute(sql`
    UPDATE user_reports SET
      status = COALESCE(${patch.status ?? null}, status),
      admin_notes = CASE WHEN ${patch.admin_notes !== undefined} THEN ${patch.admin_notes ?? null} ELSE admin_notes END,
      updated_at = now()
    WHERE id = ${id}`);
}
