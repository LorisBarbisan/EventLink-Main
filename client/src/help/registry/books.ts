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
    detail: {
      paragraphs: [
        "Earnings is the record of work you've done and what you were paid for it. Each line is one job: a date, a description, a client and a gross amount, with a status that tracks it from finished to paid.",
        "Jobs are grouped by month, newest first, and each month shows its own total. This list shows work dated today or earlier; upcoming jobs are in My jobs, above it, and move here once their date passes.",
        "The figures here feed your tax-year totals, the charts on the Overview and the tax estimate. Anything flagged for review is left out of those totals until you've checked it.",
      ],
      canDo: [
        "Filter the list by status, or show only the entries that need review",
        "Collapse a month you're not working in; it stays collapsed next time",
        "Select several jobs and change their status together",
        "Open any line to see the brief, hours, receipts, mileage and invoice for that job",
      ],
      cannotDo: [
        "See upcoming jobs in this list — they're in My jobs, above it, until their date passes",
      ],
    },
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
    detail: {
      manualOrder: 20,
      paragraphs: [
        "Sync looks at every EventLink booking you've been hired for and makes sure each one has an earnings line. Bookings that are missing one get it, lines whose job has finished move on to the right status, and anything already in order is left alone.",
        "It runs by itself when you open Books and a past booking has no line, so most of the time you won't need it. Press it if something you know you worked isn't showing.",
      ],
      canDo: ["Run it as often as you like — it never creates a second line for the same booking"],
      cannotDo: [
        "Bring in work booked outside EventLink — add that yourself, or use Import for a batch",
      ],
      seeAlso: ["books.earnings.addJob"],
    },
  },
  {
    key: "books.earnings.logPayment",
    scope: "action",
    title: "Recording a payment",
    body: "Mark an expected earning as received so your outstanding total stays accurate.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 40,
      paragraphs: [
        "Press the status badge on a line to change it. Choosing Paid asks for the date the money arrived and the amount, which defaults to the gross figure.",
        "The paid date matters more than the work date: your tax figures count income in the year you were paid, so a job worked in March and paid in April belongs to the April side of the tax year.",
        "If the client paid less than the gross — a deduction, a fee, a part payment — enter what actually arrived.",
      ],
      canDo: [
        "Set a paid date in the past",
        "Mark many jobs paid at once from the selection bar, using the work date, the end of the following month, or a date you choose",
        "Undo a bulk change from the notice that appears for 30 seconds afterwards",
      ],
      cannotDo: [
        "Change the status of a job linked to an invoice from here — mark the invoice paid in Invoices and the job follows",
      ],
      seeAlso: ["books.earnings.status"],
    },
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
    body: "Your equipment, for insurance and proof of ownership. A purchase counts towards your tax through its linked expense.",
    audience: ["freelancer"],
    priority: 5,
    oncePerUser: true,
    minVisits: 4,
    maxVisits: 12,
    version: 2,
    detail: {
      paragraphs: [
        "The kit register is a list of what you own, not a tax calculation. It exists so you can prove a piece of equipment is yours and business kit — for an insurance claim, for a hire company, or for HMRC asking what a payment was for.",
        "Equipment does not depreciate for tax in the UK. Under cash basis you deduct what you paid in the year you paid it, as an ordinary expense, so the deduction comes from the expense record rather than from this list. That is why an item here shows whether it has an expense linked to it.",
        "Vehicles are the exception and are handled separately.",
      ],
      seeAlso: ["books.kit.addItem", "books.kit.recordExpense"],
    },
  },
  {
    key: "books.kit.addItem",
    scope: "action",
    body: "Add a piece of kit with what you paid for it, so you can prove it is yours and link it to the expense.",
    audience: ["freelancer"],
    version: 2,
    detail: {
      manualOrder: 10,
    },
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
    title: "Adding a job",
    body: "Records work you found outside EventLink so it counts towards your earnings and tax estimate.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 10,
      paragraphs: [
        "Use this for anything you were booked for directly — a client who rang you, a cash job, a day for a crew you know. Give it a date, a description and the gross amount; a client and a job reference are optional but make it easier to invoice and find later.",
        "A job dated in the future goes into My Jobs as upcoming work. Once its date passes it moves into Earnings as Expected.",
      ],
      canDo: [
        "Save the client once and pick them from the list next time",
        "Remove a job you added yourself if you entered it by mistake",
      ],
      cannotDo: [
        "Add EventLink bookings by hand — Sync brings those in, and adding them yourself would count them twice",
      ],
      seeAlso: ["books.earnings.sync"],
    },
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
    detail: {
      manualOrder: 30,
      paragraphs: [
        "A job usually moves Expected → Invoiced → Paid. Overdue means an invoice has passed its due date without payment; it goes back to Paid once the money arrives.",
        "Your totals can be counted two ways. On cash basis only Paid work counts, in the year it was paid — work that's done but not yet received sits outside the total until it arrives. On accruals, a job counts once it's invoiced, whether or not you've been paid.",
      ],
      canDo: [
        "Change several statuses at once: tick the lines, or tick a month to select all of it, then pick a status in the bar that appears",
        "Filter the list to a single status from the menu in the section header",
      ],
      cannotDo: [
        "Change a job linked to an invoice from here — the invoice controls its status, and a bulk change skips those lines and tells you so",
        "Change more than 500 jobs in one go",
      ],
      seeAlso: ["books.earnings.logPayment"],
    },
  },
  {
    key: "books.earnings.needsReview",
    scope: "field",
    title: "Entries that need review",
    body: "The amount couldn't be read cleanly from the source — worth checking this one against your own records.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 50,
      paragraphs: [
        "An amber dot on a line means it came in from an import and something about it was uncertain. Point at the dot to see why: the amount couldn't be read, the source had a range like £250–300, the amount came out as zero, or there was no date and one had to be assumed.",
        "Flagged lines are left out of your totals and the tax estimate until you've checked them, so an unchecked figure never quietly changes what you owe. The notice on the Overview says how many are waiting; pressing it shows just those lines.",
        "To clear one, open it, correct anything that's wrong and save — or, if it was right all along, select it and choose Mark as reviewed.",
      ],
      canDo: [
        "Show only flagged lines with the Needs review filter",
        "Mark several as reviewed at once from the selection bar",
        "Run Backfill on the Overview to clear lines from older imports that were flagged even though nothing was wrong with them",
      ],
      cannotDo: ["Include a flagged line in your totals before it's been reviewed"],
      seeAlso: ["books.section.import"],
    },
  },

  // ── Import ─────────────────────────────────────────────────────────────────

  {
    key: "books.import.dateFormat",
    scope: "field",
    title: "Why we ask",
    body: "03/04/2026 could be March or April depending on where the file came from, so we'd rather you told us than guessed wrong.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 10,
    },
  },
  {
    key: "books.import.columnMapping",
    scope: "feature",
    body: "Tell us which column holds what and we'll remember it for the next file from the same source.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 20,
    },
  },
  {
    key: "books.import.review",
    scope: "feature",
    title: "Check before importing",
    body: "Nothing is saved until you confirm, and anything we weren't sure about is flagged for you to look at.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 30,
    },
  },

  // ── Exports ────────────────────────────────────────────────────────────────

  {
    key: "books.export.workbook",
    scope: "action",
    title: "Year-end pack",
    body: "An Excel workbook with a summary, your HMRC quarters and a sheet per record type — the thing to send your accountant.",
    audience: ["freelancer"],
    version: 2,
    detail: {
      paragraphs: [
        "The pack opens on a summary of the tax year, followed by a sheet showing each MTD quarter and the year to date, then one sheet for each kind of record you keep: earnings, expenses, mileage, invoices and kit.",
        "The quarters sheet counts income by the date you were paid, not the date you worked. A quarter can therefore show less than the earnings sheet suggests for the same months, and work still waiting to be paid does not appear in it at all.",
        "There are no formulas anywhere in the file, so it opens the same way in Excel, Numbers, LibreOffice or Google Sheets, and you or your accountant can edit it without breaking anything.",
      ],
    },
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

  // ── Kit linkage and undoing things (help registry update 2) ──────────────] = [
  // ── Kit ────────────────────────────────────────────────────────────────────

  {
    key: "books.kit.recordExpense",
    scope: "action",
    title: "Recording it as an expense",
    body: "Adds the purchase to your expenses so it counts towards your tax — the kit list alone does not.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 20,
      paragraphs: [
        "Adding something to your kit register records that you own it. It does not record that you paid for it, and the two are separate on purpose: plenty of kit was a gift, came with a van, or was bought years before you went freelance.",
        'So when you add an item you bought, with a purchase price and a date, you are offered the matching expense in one click. Accept it and the expense is created and linked, and the item shows it has been recorded. Choose "No, already recorded" and you are not asked again — the right answer if you already entered the expense from the receipt, and the reason you are asked rather than told.',
        "Vehicles are deliberately left out of this. A car is not an ordinary expense: it usually goes through capital allowances, spread over several years at a rate that depends on its emissions, and claiming the full price in one year would normally overstate your deduction. Vans are treated differently and are often deductible outright. Because it depends on the vehicle, EventLink does not offer either as an expense — check with your accountant how to record it.",
      ],
      canDo: [
        "Mark a purchase as already recorded, so it is not entered twice",
        "See at a glance which kit has an expense behind it and which does not",
      ],
      cannotDo: [
        "Create the expense twice — once an item is linked or you have said no, you are not asked again",
        "Record a car or van this way",
      ],
      seeAlso: ["books.section.kit", "books.kit.sold"],
    },
  },
  {
    key: "books.kit.sold",
    scope: "action",
    body: "Records what you sold it for, which counts as income if you claimed the purchase.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 30,
    },
  },

  // ── Earnings ───────────────────────────────────────────────────────────────

  {
    key: "books.earnings.filterOrigin",
    scope: "field",
    body: "Narrows the list to EventLink jobs, records you imported, or ones you added yourself.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 60,
    },
  },

  // ── Import ─────────────────────────────────────────────────────────────────

  {
    key: "books.import.rollback",
    scope: "action",
    title: "Rolling an import back",
    body: "Removes everything that import created and nothing else — recoverable for 30 days.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 40,
      paragraphs: [
        "Every record an import creates is remembered against the file that created it, so rolling back takes out exactly those records and leaves everything else standing. Work you added by hand, EventLink bookings and anything from a different import are untouched.",
        "Before it happens you are told how many records will go, and — the part worth reading — how many of them you have edited since the import. Those are the ones carrying work the file never had: an amount you corrected, a receipt you attached, a job you linked. Rolling back takes that with them, which is usually a reason to fix the records rather than remove them.",
        "Nothing is destroyed straight away. Rolled-back records move to Recently removed and stay there for 30 days, so anything you took back by mistake can be restored rather than re-imported. After 30 days they are deleted for good.",
        "You can also download the affected records as a spreadsheet first, which is worth doing if you are not certain.",
      ],
      canDo: [
        "Roll back an import weeks later — the file stays in your import history",
        "Restore its records within 30 days if you change your mind",
        "Download the records before they go",
      ],
      cannotDo: [
        "Roll back part of an import — it is all of that file or none of it",
        "Recover a rolled-back import after 30 days",
      ],
      seeAlso: ["books.import.removed", "books.import.startAgain"],
    },
  },
  {
    key: "books.import.removed",
    scope: "feature",
    body: "Records taken out in the last 30 days, with what removed them — restore any of them from here.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 50,
    },
  },
  {
    key: "books.import.startAgain",
    scope: "action",
    title: "Starting your books again",
    body: "Clears your records so you can begin from scratch — your EventLink work can be kept.",
    audience: ["freelancer"],
    version: 1,
    detail: {
      manualOrder: 60,
      paragraphs: [
        "For when the problem is not one bad import but the state of everything. You choose how much of your earnings and expenses goes: everything; everything except your EventLink work; or only records that came from imports. Mileage, invoices and kit are not touched.",
        "The middle option is the usual one. Work booked through EventLink is the only part of your books the platform can rebuild for you, so keeping it costs you nothing and losing it means re-entering jobs that are still sitting in your bookings. Everything else was typed or imported, and only you have the original.",
        "As with a rollback, nothing is destroyed straight away — records move to Recently removed for 30 days. You are offered a workbook of everything first, and the confirmation asks you to type the word rather than click, because this is the one action in Books that touches records you have not looked at.",
      ],
      canDo: [
        "Keep your EventLink jobs and clear everything else",
        "Clear only what you imported and keep what you typed",
        "Download a full workbook before anything is cleared",
      ],
      cannotDo: [
        "Clear a single tab in isolation — remove those records from the tab itself",
        "Undo it after 30 days",
      ],
      seeAlso: ["books.import.rollback", "books.import.removed"],
    },
  },
];

export default entries;
