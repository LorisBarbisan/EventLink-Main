import { fmtDate as fmtSharedDate } from "@shared/dates";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PoundSterling,
  Clock,
  Receipt,
  Navigation,
  FileText,
  CheckCircle,
  AlertCircle,
  Pencil,
  Plus,
  Info,
} from "lucide-react";
const fmtDate = (d: string | null | undefined) => fmtSharedDate(d, "—");

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobEntry {
  id: number;
  description: string | null;
  work_date: string;
  work_end_date: string | null;
  gross_amount_pence: number;
  currency: string;
  status: string;
  client_name?: string | null;
  invoice_id: number | null;
  paid_date: string | null;
  booking_id: number | null;
  work_status?: string | null;
  standard_hours_per_day?: number | null;
  overtime_rate_pence?: number | null;
  /** The job's billable overtime (confirmed, else logged); null when none. */
  overtime_hours?: number | null;
  overtime_pence?: number | null;
  venue?: string | null;
  venue_address?: string | null;
  call_time?: string | null;
  notes?: string | null;
  job_ref?: string | null;
  unit?: string | null;
  quantity?: string | number | null;
  unit_amount_pence?: number | null;
}

interface BookingDetail {
  booking: {
    agreedRate: string | null;
    callTime: string | null;
    venueAddress: string | null;
    employerNotes: string | null;
  };
  job: {
    id: number;
    title: string;
    location: string | null;
    eventDate: string | null;
    payRate: string | null;
    description: string | null;
  };
  employer: {
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
  } | null;
}

interface Expense {
  id: number;
  description: string;
  net_amount_pence: number;
  vat_amount_pence: number;
  expense_date: string;
  supplier?: string | null;
  billable_to_client: boolean;
  receipts?: { id: number }[];
}

interface MileageTrip {
  id: number;
  trip_date: string;
  from_place: string;
  to_place: string;
  miles: number;
  amount_pence: number;
}

interface OvertimeSummary {
  total_worked_minutes: number;
  total_overtime_minutes: number | null;
  overtime_hours_suggested: number | null;
  overtime_pence_suggested: number | null;
  overtime_hours_billable: number | null;
  overtime_pence_billable: number | null;
  overtime_source: "confirmed" | "logged" | null;
}

interface Invoice {
  id: number;
  invoice_number: string | null;
  status: string;
  total_pence: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPence(p: number | null | undefined, currency = "GBP"): string {
  if (p == null) return "—";
  const sym =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${sym}${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function statusColor(s: string | null | undefined): string {
  switch (s) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "pencilled":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "completed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function invoiceStatusColor(s: string): string {
  switch (s) {
    case "paid":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "sent":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ── Section row component ─────────────────────────────────────────────────────

function SectionRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-0">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-24 shrink-0 text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function JobDetailDialog({
  earningsEntryId,
  onClose,
  onInvoice,
  onOpenInvoice,
  onEdit,
  onAddExpense,
  onEditExpense,
}: {
  earningsEntryId: number;
  onClose: () => void;
  onInvoice?: (entryId: number) => void;
  onOpenInvoice?: (invoiceId: number) => void;
  onEdit?: (entryId: number) => void;
  onAddExpense?: (entryId: number) => void;
  onEditExpense?: (expenseId: number) => void;
}) {
  const { data: entry, isLoading: entryLoading } = useQuery<JobEntry>({
    queryKey: ["/api/earnings", earningsEntryId],
    queryFn: () => apiRequest(`/api/earnings/${earningsEntryId}`),
  });

  const { data: expensesData } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ["/api/expenses", { earnings_entry_id: earningsEntryId }],
    queryFn: () => apiRequest(`/api/expenses?earnings_entry_id=${earningsEntryId}&page=1`),
    enabled: !!entry,
  });

  const { data: mileageData } = useQuery<{ trips: MileageTrip[]; total_pence: number }>({
    queryKey: ["/api/mileage", { earnings_entry_id: earningsEntryId }],
    queryFn: () => apiRequest(`/api/mileage?earnings_entry_id=${earningsEntryId}`),
    enabled: !!entry,
  });

  const { data: timeSummary } = useQuery<OvertimeSummary>({
    queryKey: ["/api/earnings/entries", earningsEntryId, "time/summary"],
    queryFn: () => apiRequest(`/api/earnings/entries/${earningsEntryId}/time/summary`),
    enabled: !!entry,
  });

  const { data: invoice } = useQuery<Invoice>({
    queryKey: ["/api/invoices", entry?.invoice_id],
    queryFn: () => apiRequest(`/api/invoices/${entry!.invoice_id}`),
    enabled: !!entry?.invoice_id,
  });

  const { data: booking } = useQuery<BookingDetail>({
    queryKey: ["/api/bookings", entry?.booking_id],
    queryFn: () => apiRequest(`/api/bookings/${entry!.booking_id}`),
    enabled: !!entry?.booking_id,
  });

  const expenseList = expensesData?.expenses ?? [];
  const tripList = mileageData?.trips ?? [];
  const totalExpensePence = expenseList.reduce(
    (s, e) => s + e.net_amount_pence + e.vat_amount_pence,
    0
  );
  const totalMiles = tripList.reduce((s, t) => s + t.miles, 0);
  const totalMileagePence = mileageData?.total_pence ?? 0;

  if (entryLoading || !entry) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Job details</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        </DialogContent>
      </Dialog>
    );
  }

  const dateRange = entry.work_end_date
    ? `${fmtDate(entry.work_date)} – ${fmtDate(entry.work_end_date)}`
    : fmtDate(entry.work_date);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-lg font-bold leading-snug">
                {entry.description ?? "Booked job"}
              </DialogTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {(entry.client_name ?? booking?.employer?.companyName)
                  ? `${entry.client_name ?? booking?.employer?.companyName} · `
                  : ""}
                {dateRange}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {entry.work_status && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor(entry.work_status)}`}
                >
                  {entry.work_status}
                </span>
              )}
              {onEdit && !entry.booking_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    onEdit(earningsEntryId);
                    onClose();
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 divide-y rounded-md border">
          <JobDetailsRow entry={entry} booking={booking} />

          {/* Money */}
          <SectionRow icon={<PoundSterling className="h-4 w-4" />} label="Money">
            <div className="space-y-1">
              <span className="font-semibold">
                {fmtPence(entry.gross_amount_pence + (entry.overtime_pence ?? 0), entry.currency)}
              </span>
              {entry.overtime_hours != null && entry.overtime_hours > 0 && (
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                  incl. {entry.overtime_hours.toFixed(2)}h overtime
                  {entry.overtime_pence
                    ? ` · ${fmtPence(entry.overtime_pence, entry.currency)}`
                    : ""}
                </span>
              )}
              {entry.status === "paid" ? (
                <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="mr-0.5 inline h-3 w-3" />
                  paid {entry.paid_date ? fmtDate(entry.paid_date) : ""}
                </span>
              ) : entry.status === "invoiced" ? (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  invoiced · awaiting payment
                </span>
              ) : (
                <span className="ml-2 text-xs text-muted-foreground">expected</span>
              )}
              {invoice && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Invoice {invoice.invoice_number ?? `#${invoice.id}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${invoiceStatusColor(invoice.status)}`}
                  >
                    {invoice.status}
                  </span>
                  {onOpenInvoice && (
                    <button
                      className="text-xs text-primary underline"
                      onClick={() => {
                        onOpenInvoice(invoice.id);
                        onClose();
                      }}
                    >
                      Open
                    </button>
                  )}
                </div>
              )}
              {!entry.invoice_id && onInvoice && (
                <div className="mt-2">
                  <Button
                    size="sm"
                    className="bg-orange-500 text-white hover:bg-orange-600"
                    onClick={() => {
                      onInvoice(earningsEntryId);
                      onClose();
                    }}
                  >
                    Create invoice
                  </Button>
                </div>
              )}
            </div>
          </SectionRow>

          {/* Time */}
          <SectionRow icon={<Clock className="h-4 w-4" />} label="Time">
            {timeSummary && timeSummary.total_worked_minutes > 0 ? (
              <div className="space-y-0.5">
                <span>{minutesToHHMM(timeSummary.total_worked_minutes)} worked</span>
                {timeSummary.overtime_hours_billable !== null &&
                  timeSummary.overtime_hours_billable > 0 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      {timeSummary.overtime_hours_billable.toFixed(2)}h overtime
                      {timeSummary.overtime_source === "confirmed"
                        ? " (confirmed)"
                        : " (from logged days)"}
                      {timeSummary.overtime_pence_billable
                        ? ` · ${fmtPence(timeSummary.overtime_pence_billable)}`
                        : ""}
                    </div>
                  )}
              </div>
            ) : (
              <span className="text-muted-foreground">No days logged</span>
            )}
          </SectionRow>

          {/* Expenses */}
          <SectionRow icon={<Receipt className="h-4 w-4" />} label="Expenses">
            <div className="space-y-1.5">
              {expenseList.length > 0 ? (
                <>
                  <div className="text-xs font-medium text-muted-foreground">
                    {expenseList.length} expense{expenseList.length !== 1 ? "s" : ""} ·{" "}
                    <span className="font-semibold text-foreground">
                      {fmtPence(totalExpensePence)}
                    </span>
                  </div>
                  <div className="divide-y rounded-md border">
                    {expenseList.slice(0, 5).map((e) => (
                      <button
                        key={e.id}
                        className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors ${onEditExpense ? "cursor-pointer hover:bg-muted/60" : "cursor-default"}`}
                        onClick={() => {
                          if (onEditExpense) {
                            onEditExpense(e.id);
                            onClose();
                          }
                        }}
                      >
                        <span className="max-w-48 truncate text-left">{e.description}</span>
                        <span className="ml-4 shrink-0 font-medium tabular-nums">
                          {fmtPence(e.net_amount_pence + e.vat_amount_pence)}
                        </span>
                      </button>
                    ))}
                    {expenseList.length > 5 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground">
                        +{expenseList.length - 5} more
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">No expenses linked</span>
              )}
              {onAddExpense && (
                <button
                  className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => {
                    onAddExpense(earningsEntryId);
                    onClose();
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add expense
                </button>
              )}
            </div>
          </SectionRow>

          {/* Mileage */}
          <SectionRow icon={<Navigation className="h-4 w-4" />} label="Mileage">
            {tripList.length > 0 ? (
              <div className="space-y-0.5">
                <div className="font-medium">
                  {tripList.length} trip{tripList.length !== 1 ? "s" : ""} · {totalMiles} miles ·{" "}
                  {fmtPence(totalMileagePence)}
                </div>
                {tripList.slice(0, 3).map((t) => (
                  <div key={t.id} className="text-xs text-muted-foreground">
                    {fmtDate(t.trip_date)} · {t.from_place} → {t.to_place}
                  </div>
                ))}
                {tripList.length > 3 && (
                  <div className="text-xs text-muted-foreground">+{tripList.length - 3} more</div>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">No trips</span>
            )}
          </SectionRow>

          {/* Documents — only for platform bookings */}
          {entry.booking_id && (
            <SectionRow icon={<FileText className="h-4 w-4" />} label="Documents">
              <DocumentsSection jobId={booking?.job.id} />
            </SectionRow>
          )}
        </div>

        {!entry.booking_id && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            Manually logged job — platform documents not available
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Details: what was entered on the job, filled in from the booking ─────────

const UNIT_LABEL: Record<string, string> = { day: "day", hour: "hour", job: "job" };

function JobDetailsRow({ entry, booking }: { entry: JobEntry; booking?: BookingDetail }) {
  const employerName = booking?.employer
    ? [booking.employer.firstName, booking.employer.lastName].filter(Boolean).join(" ")
    : "";
  const callTime = entry.call_time || booking?.booking.callTime;
  const venue = [entry.venue, entry.venue_address || booking?.booking.venueAddress]
    .filter(Boolean)
    .join(", ");
  const where = venue || booking?.job.location || "";
  const qty = entry.quantity != null ? Number(entry.quantity) : null;
  const rate =
    entry.unit && qty && entry.unit_amount_pence
      ? `${qty} ${UNIT_LABEL[entry.unit] ?? entry.unit}${qty === 1 ? "" : "s"} × ${fmtPence(entry.unit_amount_pence, entry.currency)}`
      : booking?.booking.agreedRate || booking?.job.payRate || "";
  const client = entry.client_name || booking?.employer?.companyName;
  const contact = booking && employerName && employerName !== client ? employerName : "";

  const rows: [string, string][] = [
    ["Client", [client, contact].filter(Boolean).join(" · ")],
    ["Call time", callTime ?? ""],
    ["Where", where],
    ["Rate", rate],
    ["Reference", entry.job_ref ?? ""],
  ].filter(([, v]) => v) as [string, string][];

  const brief = booking?.job.description?.trim();
  const notes = entry.notes?.trim();
  const employerNotes = booking?.booking.employerNotes?.trim();

  if (!rows.length && !brief && !notes && !employerNotes) return null;

  return (
    <SectionRow icon={<Info className="h-4 w-4" />} label="Details">
      <div className="space-y-2">
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {employerNotes && (
          <div>
            <p className="text-xs text-muted-foreground">From the employer</p>
            <p className="whitespace-pre-line text-sm">{employerNotes}</p>
          </div>
        )}
        {brief && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">Job brief</summary>
            <p className="mt-1 whitespace-pre-line">{brief}</p>
          </details>
        )}
        {notes && (
          <div>
            <p className="text-xs text-muted-foreground">Your notes</p>
            <p className="whitespace-pre-line text-sm">{notes}</p>
          </div>
        )}
      </div>
    </SectionRow>
  );
}

// ── Documents sub-section ─────────────────────────────────────────────────────

interface JobDoc {
  id: number;
  documentType: string;
  fileName: string;
  downloadUrl: string | null;
}

function DocumentsSection({ jobId }: { jobId: number | undefined }) {
  const { data: docs = [] } = useQuery<JobDoc[]>({
    queryKey: ["/api/job", jobId, "documents"],
    queryFn: () => apiRequest(`/api/job/${jobId}/documents`),
    enabled: !!jobId,
  });

  if (!jobId) return <span className="text-muted-foreground">Loading…</span>;
  if (docs.length === 0)
    return <span className="text-muted-foreground">No documents uploaded</span>;

  return (
    <div className="divide-y rounded-md border">
      {docs.map((d) => (
        <a
          key={d.id}
          href={d.downloadUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/60"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs capitalize text-muted-foreground">
            {d.documentType.replace(/_/g, " ")}
          </span>
          <span className="ml-auto max-w-40 truncate text-xs text-primary underline">
            {d.fileName}
          </span>
        </a>
      ))}
    </div>
  );
}
