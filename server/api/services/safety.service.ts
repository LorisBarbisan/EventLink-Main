import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { bookings, user_blocks, user_reports, users } from "@shared/schema";
import { db } from "../config/db";
import { ACTIVE_BOOKING_STATUSES, type ReportCategory, type ReportStatus } from "@shared/safety";

const pair = (a: number, b: number) =>
  or(
    and(eq(user_blocks.blocker_id, a), eq(user_blocks.blocked_id, b)),
    and(eq(user_blocks.blocker_id, b), eq(user_blocks.blocked_id, a))
  );

export async function isBlockedEitherWay(a: number, b: number): Promise<boolean> {
  const rows = await db
    .select({ x: user_blocks.blocker_id })
    .from(user_blocks)
    .where(pair(a, b))
    .limit(1);
  return rows.length > 0;
}

export async function activeBookingsBetween(a: number, b: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
        or(
          and(eq(bookings.employerId, a), eq(bookings.freelancerId, b)),
          and(eq(bookings.employerId, b), eq(bookings.freelancerId, a))
        )
      )
    );
  return Number(row?.n ?? 0);
}

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  await db
    .insert(user_blocks)
    .values({ blocker_id: blockerId, blocked_id: blockedId })
    .onConflictDoNothing();
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<void> {
  await db
    .delete(user_blocks)
    .where(and(eq(user_blocks.blocker_id, blockerId), eq(user_blocks.blocked_id, blockedId)));
}

export async function hasBlocked(blockerId: number, blockedId: number): Promise<boolean> {
  const rows = await db
    .select({ x: user_blocks.blocker_id })
    .from(user_blocks)
    .where(and(eq(user_blocks.blocker_id, blockerId), eq(user_blocks.blocked_id, blockedId)))
    .limit(1);
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
  const [row] = await db
    .insert(user_reports)
    .values({
      reporter_id: r.reporterId,
      subject_id: r.subjectId,
      subject_name: r.subjectName,
      category: r.category,
      details: r.details,
      conversation_id: r.conversationId,
      booking_id: r.bookingId,
    })
    .returning({ id: user_reports.id });
  return row;
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
  created_at: Date;
  /** How many reports this subject has in total — the pattern signal */
  subject_report_count: number;
}

const fullName = (u: typeof users) =>
  sql<
    string | null
  >`NULLIF(TRIM(COALESCE(${u.first_name},'') || ' ' || COALESCE(${u.last_name},'')), '')`;

export async function listUserReports(): Promise<AdminReportRow[]> {
  const rep = alias(users, "rep");
  const sub = alias(users, "sub");
  const rows = await db
    .select({
      id: user_reports.id,
      reporter_id: user_reports.reporter_id,
      reporter_name: fullName(rep as unknown as typeof users),
      subject_id: user_reports.subject_id,
      live_subject_name: fullName(sub as unknown as typeof users),
      stored_subject_name: user_reports.subject_name,
      subject_live_id: sub.id,
      category: user_reports.category,
      details: user_reports.details,
      conversation_id: user_reports.conversation_id,
      booking_id: user_reports.booking_id,
      status: user_reports.status,
      admin_notes: user_reports.admin_notes,
      created_at: user_reports.created_at,
      subject_report_count: sql<number>`(SELECT count(*)::int FROM user_reports x WHERE x.subject_id = ${user_reports.subject_id})`,
    })
    .from(user_reports)
    .leftJoin(rep, eq(rep.id, user_reports.reporter_id))
    .leftJoin(sub, eq(sub.id, user_reports.subject_id))
    .orderBy(desc(sql`${user_reports.status} = 'open'`), desc(user_reports.created_at))
    .limit(500);
  return rows.map(({ live_subject_name, stored_subject_name, subject_live_id, ...r }) => ({
    ...r,
    subject_name: live_subject_name ?? stored_subject_name,
    subject_deleted: subject_live_id == null,
    subject_report_count: Number(r.subject_report_count),
  }));
}

export async function updateUserReport(
  id: number,
  patch: { status?: ReportStatus; admin_notes?: string | null }
): Promise<void> {
  const set: Partial<typeof user_reports.$inferInsert> = { updated_at: new Date() };
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.admin_notes !== undefined) set.admin_notes = patch.admin_notes;
  await db.update(user_reports).set(set).where(eq(user_reports.id, id));
}
