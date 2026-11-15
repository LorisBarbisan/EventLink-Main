import type { HelpEntry } from "../types";

// Copy rules: one sentence, say what it does for the user, British English,
// no "click here", never restate the label.
const entries: HelpEntry[] = [
  // ── Books tab (dashboard entry-point) ──────────────────────────────────────
  {
    key: "dashboard.tab.books",
    scope: "feature",
    title: "Books",
    body: "Your financial hub — earnings, expenses, mileage, kit and invoices all in one place.",
    audience: ["freelancer"],
    priority: 9,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },

  // ── Overview ───────────────────────────────────────────────────────────────
  {
    key: "books.section.overview",
    scope: "feature",
    title: "Overview",
    body: "A snapshot of your earnings, outstanding invoices and upcoming gigs for the current tax year.",
    audience: ["freelancer"],
    priority: 8,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },

  // ── Earnings ───────────────────────────────────────────────────────────────
  {
    key: "books.section.earnings",
    scope: "feature",
    title: "Earnings",
    body: "Every gig you've worked, with gross pay, tax-year totals and an Excel workbook you can send your accountant.",
    audience: ["freelancer"],
    priority: 8,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 2,
  },
  {
    key: "books.earnings.sync",
    scope: "action",
    title: "Sync",
    body: "Imports all your confirmed and completed EventLink bookings as expected earnings — no manual entry needed.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 10,
    version: 1,
  },
  {
    key: "books.earnings.addGig",
    scope: "action",
    body: "Log a gig that wasn't booked through EventLink, such as a direct hire or cash job.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.earnings.logPayment",
    scope: "action",
    body: "Mark an expected earning as received so your outstanding total stays accurate.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Expenses ───────────────────────────────────────────────────────────────
  {
    key: "books.section.expenses",
    scope: "feature",
    title: "Expenses",
    body: "Track deductible costs against each job so you're ready when HMRC asks.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 3,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.expenses.addExpense",
    scope: "action",
    body: "Record a business cost with a receipt photo; grouped by category for your tax return.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Mileage ────────────────────────────────────────────────────────────────
  {
    key: "books.section.mileage",
    scope: "feature",
    title: "Mileage",
    body: "Log business trips at the HMRC approved rate so you don't miss a deductible penny.",
    audience: ["freelancer"],
    priority: 6,
    oncePerUser: true,
    minVisits: 3,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.mileage.addTrip",
    scope: "action",
    body: "Record a journey — enter the postcode pair and the mileage is calculated automatically.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Kit register ───────────────────────────────────────────────────────────
  {
    key: "books.section.kit",
    scope: "feature",
    title: "Kit register",
    body: "A list of your owned equipment with purchase value, so you can claim depreciation and prove ownership.",
    audience: ["freelancer"],
    priority: 5,
    oncePerUser: true,
    minVisits: 4,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.kit.addItem",
    scope: "action",
    body: "Add a piece of kit with its purchase price — used to calculate your annual depreciation allowance.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Invoices ───────────────────────────────────────────────────────────────
  {
    key: "books.section.invoices",
    scope: "feature",
    title: "Invoices",
    body: "Create, send and track invoices for every job — PDF generated automatically from your billing profile.",
    audience: ["freelancer"],
    priority: 9,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.invoices.new",
    scope: "action",
    title: "New invoice",
    body: "Creates a draft invoice pre-numbered from your billing profile; fill in the client and line items.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 10,
    version: 1,
  },
  {
    key: "books.invoices.linkJob",
    scope: "feature",
    title: "Linked job",
    body: "Connecting an invoice to an EventLink booking lets you send it directly to the employer through messages.",
    audience: ["freelancer"],
    priority: 8,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 8,
    version: 1,
  },
  {
    key: "books.invoices.send",
    scope: "action",
    body: "Sends the invoice PDF to the employer via your EventLink message thread and emails them a notification.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.invoices.markPaid",
    scope: "action",
    body: "Records the invoice as settled so your outstanding total stays accurate.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.invoices.settings",
    scope: "feature",
    title: "Invoice settings",
    body: "Set your trading name, bank details and VAT number once — they appear on every invoice you create.",
    audience: ["freelancer"],
    priority: 10,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 6,
    version: 1,
  },
  {
    key: "books.invoices.download",
    scope: "action",
    body: "Downloads the invoice as a PDF you can email or attach to a purchase order manually.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Sections added since 10 November ───────────────────────────────────────

  {
    key: "books.section.calendar",
    scope: "feature",
    title: "Calendar",
    body: "Every confirmed job on one grid, with the days you've marked unavailable, so you can see your year at a glance.",
    audience: ["freelancer"],
    priority: 8,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.section.time",
    scope: "feature",
    title: "Time",
    body: "Log the hours you actually worked on a job and any overtime is worked out for you, ready to add to an invoice.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.section.clients",
    scope: "feature",
    title: "Clients",
    body: "Save a client's billing details once and every invoice to them is filled in for you.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "books.section.import",
    scope: "feature",
    title: "Import",
    body: "Bring in your existing records from QuickBooks, FreeAgent, Xero, a bank statement or your own spreadsheet.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 8,
    version: 1,
  },
  {
    key: "books.earnings.addJob",
    scope: "action",
    body: "Records work you found outside EventLink so it counts towards your earnings and tax estimate.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Calendar ───────────────────────────────────────────────────────────────

  {
    key: "books.calendar.markAvailability",
    scope: "action",
    body: "Blocks out days you can't work, so your calendar reflects what you're actually free for.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.calendar.connect",
    scope: "action",
    title: "Calendar sync",
    body: "Pushes your confirmed jobs to Google or Outlook so they sit alongside the rest of your diary.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Job detail ─────────────────────────────────────────────────────────────

  {
    key: "books.job.detail",
    scope: "feature",
    title: "Everything about this job",
    body: "The brief, your hours, receipts, mileage and the invoice, all against the one booking.",
    audience: ["freelancer"],
    priority: 8,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 8,
    version: 1,
  },
  {
    key: "books.job.linkExpense",
    scope: "field",
    body: "Attaching an expense to a job keeps its receipts with the work, and lets you rebill it if the client agreed to cover it.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.job.overtime",
    scope: "feature",
    title: "Overtime",
    body: "Worked out from the hours you logged against the standard day — check it against your own agreement before invoicing, as overtime terms vary by client.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Earnings: statuses ─────────────────────────────────────────────────────

  {
    key: "books.earnings.status",
    scope: "field",
    title: "What these statuses mean",
    body: "Expected is work you've done but not billed, Invoiced is sent and waiting, Overdue is past its due date, and Paid is money received.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.earnings.needsReview",
    scope: "field",
    body: "The amount couldn't be read cleanly from the source — worth checking this one against your own records.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Import ─────────────────────────────────────────────────────────────────

  {
    key: "books.import.dateFormat",
    scope: "field",
    title: "Why we ask",
    body: "03/04/2026 could be March or April depending on where the file came from, so we'd rather you told us than guessed wrong.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.import.columnMapping",
    scope: "feature",
    body: "Tell us which column holds what and we'll remember it for the next file from the same source.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "books.import.review",
    scope: "feature",
    title: "Check before importing",
    body: "Nothing is saved until you confirm, and anything we weren't sure about is flagged for you to look at.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Exports ────────────────────────────────────────────────────────────────

  {
    key: "books.export.workbook",
    scope: "action",
    title: "Year-end pack",
    body: "An Excel workbook with a sheet for each of your records — the thing to send your accountant.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Invoices: correction ───────────────────────────────────────────────────

  {
    key: "books.invoices.correct",
    scope: "action",
    title: "Correcting a sent invoice",
    body: "Cancels the original and opens a copy you can fix, so your client's records and yours stay in step.",
    audience: ["freelancer"],
    version: 1,
  },
];

export default entries;
