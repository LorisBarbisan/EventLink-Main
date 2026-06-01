import ExcelJS from "exceljs";
import { ObjectStorageService } from "../utils/object-storage.js";

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(val: string | Date | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "";
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hours}:${mins}`;
}

function capitalise(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
}

function rowsToCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsv).join(","));
  return lines.join("\r\n");
}

async function getAttachmentUrls(attachments: any[]): Promise<string[]> {
  const urls: string[] = [];
  for (const att of attachments ?? []) {
    try {
      const url = await ObjectStorageService.getDownloadUrl(att.objectPath);
      urls.push(`${att.originalFilename}: ${url}`);
    } catch {
      urls.push(`${att.originalFilename}: (unavailable)`);
    }
  }
  return urls;
}

// ── Bookings Excel ─────────────────────────────────────────

export async function generateBookingsExcel(data: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EventLink FMS";
  wb.created = new Date();
  const ws = wb.addWorksheet("Bookings");

  ws.columns = [
    { header: "Booking ID", key: "id", width: 12 },
    { header: "Event Title", key: "eventTitle", width: 30 },
    { header: "Event Date", key: "eventDate", width: 14 },
    { header: "Call Time", key: "callTime", width: 12 },
    { header: "Venue", key: "venue", width: 30 },
    { header: "Freelancer Name", key: "freelancerName", width: 24 },
    { header: "Freelancer Email", key: "freelancerEmail", width: 30 },
    { header: "Role", key: "role", width: 20 },
    { header: "Agreed Rate", key: "rate", width: 14 },
    { header: "Booking Status", key: "status", width: 16 },
    { header: "Brief Status", key: "briefStatus", width: 16 },
    { header: "Brief Acknowledged At", key: "acknowledgedAt", width: 22 },
    { header: "Acknowledgement Note", key: "ackNote", width: 30 },
    { header: "Employer Notes", key: "notes", width: 30 },
    { header: "Attachments", key: "attachments", width: 50 },
    { header: "Booking Created", key: "createdAt", width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;

  for (const row of data) {
    const attachmentUrls = await getAttachmentUrls(row.attachments ?? []);
    const briefStatus = !row.brief
      ? "Not sent"
      : row.brief.status === "acknowledged"
      ? "Acknowledged"
      : "Sent";
    ws.addRow({
      id: row.booking.id,
      eventTitle: row.jobTitle ?? row.booking.employerNotes ?? "",
      eventDate: formatDate(row.booking.eventDate),
      callTime: row.booking.callTime ?? "",
      venue: row.booking.venueAddress ?? "",
      freelancerName: `${row.freelancerFirstName ?? ""} ${row.freelancerLastName ?? ""}`.trim(),
      freelancerEmail: row.freelancerEmail ?? "",
      role: row.freelancerTitle ?? "",
      rate: row.booking.agreedRate ?? "",
      status: capitalise(row.booking.status),
      briefStatus,
      acknowledgedAt: formatDateTime(row.brief?.acknowledgedAt),
      ackNote: row.brief?.acknowledgementNote ?? "",
      notes: row.booking.employerNotes ?? "",
      attachments: attachmentUrls.join("\n"),
      createdAt: formatDate(row.booking.createdAt),
    });
  }

  ws.eachRow((row, rowNum) => {
    if (rowNum > 1 && rowNum % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      });
    }
    row.alignment = { wrapText: true, vertical: "top" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}

// ── Crew List Excel ────────────────────────────────────────

export async function generateCrewListExcel(data: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EventLink FMS";
  const ws = wb.addWorksheet("Crew List");

  ws.columns = [
    { header: "Freelancer Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "Title / Role", key: "title", width: 22 },
    { header: "Location", key: "location", width: 20 },
    { header: "Skills", key: "skills", width: 40 },
    { header: "Total Bookings", key: "totalBookings", width: 16 },
    { header: "Last Booked", key: "lastBooked", width: 14 },
    { header: "Avg Rating", key: "avgRating", width: 12 },
    { header: "Profile URL", key: "profileUrl", width: 40 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.height = 20;

  for (const row of data) {
    const profile = row.profile as any;
    const user = row.user as any;
    ws.addRow({
      name: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
      email: user?.email ?? "",
      title: profile?.title ?? "",
      location: profile?.location ?? "",
      skills: (profile?.skills ?? []).join(", "),
      totalBookings: row.totalBookings,
      lastBooked: formatDate(row.lastBooked),
      avgRating: row.avgRating ?? "",
      profileUrl: profile?.slug ? `https://eventlink.one/profile/${profile.slug}` : "",
    });
  }

  ws.eachRow((row, rowNum) => {
    if (rowNum > 1 && rowNum % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      });
    }
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}

// ── Availability Excel ─────────────────────────────────────

export async function generateAvailabilityExcel(data: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EventLink FMS";
  const ws = wb.addWorksheet("Availability Enquiries");

  ws.columns = [
    { header: "Enquiry ID", key: "id", width: 12 },
    { header: "Event Title", key: "eventTitle", width: 30 },
    { header: "Event Date", key: "eventDate", width: 14 },
    { header: "Role Required", key: "role", width: 20 },
    { header: "Venue", key: "venue", width: 30 },
    { header: "Rate", key: "rate", width: 14 },
    { header: "Enquiry Status", key: "status", width: 16 },
    { header: "Total Sent", key: "total", width: 12 },
    { header: "Yes", key: "yes", width: 8 },
    { header: "Maybe", key: "maybe", width: 8 },
    { header: "No", key: "no", width: 8 },
    { header: "Pending", key: "pending", width: 10 },
    { header: "Sent At", key: "sentAt", width: 14 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.height = 20;

  for (const row of data) {
    ws.addRow({
      id: row.id,
      eventTitle: row.eventTitle,
      eventDate: formatDate(row.eventDate),
      role: row.roleRequired ?? "",
      venue: row.venueAddress ?? "",
      rate: row.agreedRate ?? "",
      status: capitalise(row.status),
      total: row.total,
      yes: row.yes,
      maybe: row.maybe,
      no: row.no,
      pending: row.pending,
      sentAt: formatDate(row.createdAt),
    });
  }

  ws.eachRow((row, rowNum) => {
    if (rowNum > 1 && rowNum % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      });
    }
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}

// ── CSV generators ─────────────────────────────────────────

export async function generateBookingsCsv(data: any[]): Promise<string> {
  const headers = [
    "Booking ID", "Event Title", "Event Date", "Call Time", "Venue",
    "Freelancer Name", "Freelancer Email", "Role", "Agreed Rate", "Booking Status",
    "Brief Status", "Brief Acknowledged At", "Acknowledgement Note",
    "Employer Notes", "Attachments", "Booking Created",
  ];
  const rows = await Promise.all(
    data.map(async (row) => {
      const attachmentUrls = await getAttachmentUrls(row.attachments ?? []);
      const briefStatus = !row.brief
        ? "Not sent"
        : row.brief.status === "acknowledged"
        ? "Acknowledged"
        : "Sent";
      return [
        String(row.booking.id),
        row.jobTitle ?? row.booking.employerNotes ?? "",
        formatDate(row.booking.eventDate),
        row.booking.callTime ?? "",
        row.booking.venueAddress ?? "",
        `${row.freelancerFirstName ?? ""} ${row.freelancerLastName ?? ""}`.trim(),
        row.freelancerEmail ?? "",
        row.freelancerTitle ?? "",
        row.booking.agreedRate ?? "",
        capitalise(row.booking.status),
        briefStatus,
        formatDateTime(row.brief?.acknowledgedAt),
        row.brief?.acknowledgementNote ?? "",
        row.booking.employerNotes ?? "",
        attachmentUrls.join(" | "),
        formatDate(row.booking.createdAt),
      ];
    })
  );
  return rowsToCsv(headers, rows);
}

export async function generateCrewListCsv(data: any[]): Promise<string> {
  const headers = [
    "Freelancer Name", "Email", "Title / Role", "Location",
    "Skills", "Total Bookings", "Last Booked", "Avg Rating", "Profile URL",
  ];
  const rows = data.map((row) => {
    const p = row.profile as any;
    const u = row.user as any;
    return [
      `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim(),
      u?.email ?? "",
      p?.title ?? "",
      p?.location ?? "",
      (p?.skills ?? []).join(", "),
      String(row.totalBookings),
      formatDate(row.lastBooked),
      row.avgRating ?? "",
      p?.slug ? `https://eventlink.one/profile/${p.slug}` : "",
    ];
  });
  return rowsToCsv(headers, rows);
}

export async function generateAvailabilityCsv(data: any[]): Promise<string> {
  const headers = [
    "Enquiry ID", "Event Title", "Event Date", "Role Required",
    "Venue", "Rate", "Enquiry Status", "Total Sent", "Yes", "Maybe", "No", "Pending", "Sent At",
  ];
  const rows = data.map((row) => [
    String(row.id),
    row.eventTitle,
    formatDate(row.eventDate),
    row.roleRequired ?? "",
    row.venueAddress ?? "",
    row.agreedRate ?? "",
    capitalise(row.status),
    String(row.total),
    String(row.yes),
    String(row.maybe),
    String(row.no),
    String(row.pending),
    formatDate(row.createdAt),
  ]);
  return rowsToCsv(headers, rows);
}
