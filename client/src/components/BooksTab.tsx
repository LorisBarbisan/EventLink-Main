import { fmtDate as fmtSharedDate } from "@shared/dates";
import { addMonths, ukToday } from "@shared/job-dates";
import { keyActivate, pressable } from "@/lib/a11y";
import type { BookingStatus } from "@shared/schema";
import React, { useEffect, useRef, useState } from "react";
import { JobSelect, type JobOption } from "./JobSelect";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFreelancerJobs } from "@/hooks/useFreelancerJobs";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BusinessDetailsCard } from "@/components/BusinessDetailsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Camera,
  CheckCircle,
  ChevronDown,
  Clock,
  FileText,
  ImageIcon,
  MapPin,
  Navigation,
  TrendingUp,
  RefreshCw,
  Download,
  Plus,
  Pencil,
  Receipt,
  Trash2,
  X,
  Timer,
  Settings2,
} from "lucide-react";
import { KitTab } from "./KitTab";
import { InvoicesTab, type InvoicePrefill, type InvoicePrefillLineItem } from "./InvoicesTab";
import { CalendarTab } from "./CalendarTab";
import { JobDetailDialog } from "./JobDetailDialog";
import { ClientsTab } from "./ClientsTab";
import { ImportWizard } from "./ImportWizard";
import { RecentlyRemoved } from "./RecentlyRemoved";
import { StartAgainCard } from "./StartAgainCard";
import { matchesOrigin, ORIGIN_OPTIONS, type OriginFilter } from "@/lib/origin";
import { isBooksCurrency, reclaimsInputVat } from "@shared/expense-totals";
import { VAT_SCHEME_LABELS, vatTreatmentNote, type VatScheme } from "@shared/vat-return";
import { VatReturnCard } from "./VatReturnCard";
import { ManualToggle } from "@/help/ManualPane";
import { manualStore } from "@/help/manualStore";
import { type GigForm, EMPTY_GIG_FORM, GigFormBody } from "./GigFormFields";
import { SearchableSelect } from "@/components/ui/searchable-select";
const fmtDate = (d: string | null | undefined) => fmtSharedDate(d, "—");

// ── Money helpers ──────────────────────────────────────────────────────────────

function formatPence(pence: number | null | undefined, currency = "GBP"): string {
  if (pence == null) return "—";
  const amount = pence / 100;
  const symbol =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Month grouping helper + component ─────────────────────────────────────────

/**
 * What an expense costs the business before business-use %: the net for a
 * VAT-registered freelancer (the VAT is reclaimed), the gross otherwise.
 * Same rule as allowableExpensePence in shared/expense-totals.ts, which the
 * server totals use; this one keeps every currency so a list row still shows
 * its own amount.
 */
function expenseBase(
  e: { net_amount_pence: number; vat_amount_pence: number },
  vatRegistered: boolean
): number {
  return vatRegistered ? e.net_amount_pence : e.net_amount_pence + e.vat_amount_pence;
}

function groupByMonth<T>(items: T[], dateKey: keyof T): { key: string; items: T[] }[] {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    const key = String(item[dateKey]).slice(0, 7);
    (map[key] ??= []).push(item);
  }
  return Object.keys(map)
    .sort()
    .map((key) => ({ key, items: map[key] }));
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

interface MonthSectionProps {
  monthKey: string;
  total: number | null;
  accentClass: string;
  headerClass: string;
  storageKey: string;
  children: React.ReactNode;
  divider?: boolean;
  selectAll?: React.ReactNode;
}

function MonthSection({
  monthKey,
  total,
  accentClass,
  headerClass,
  storageKey,
  children,
  divider,
  selectAll,
}: MonthSectionProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "0";
    } catch {
      return true;
    }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return (
    <div>
      <button
        className={`flex w-full items-center justify-between border-b px-5 py-2 text-left ${headerClass}`}
        onClick={toggle}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"} ${accentClass}`}
          />
          {selectAll && (
            // Only stops the click reaching the row behind it; not itself a control
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span onClick={(e) => e.stopPropagation()} className="flex items-center">
              {selectAll}
            </span>
          )}
          <span className={`text-xs font-bold uppercase tracking-wide ${accentClass}`}>
            {monthLabel(monthKey)}
          </span>
        </div>
        {total != null && (
          <span className={`text-xs font-semibold tabular-nums ${accentClass}`}>
            {formatPence(total)}
          </span>
        )}
      </button>
      {open && children}
      {divider && <div className="border-b" />}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface EarningsEntry {
  id: number;
  description: string | null;
  work_date: string;
  work_end_date?: string | null;
  gross_amount_pence: number;
  currency: string;
  status: string;
  source?: string;
  needs_review: boolean;
  review_reason?: "unparsed_amount" | "ambiguous_amount" | "assumed_date" | "zero_amount" | null;
  client_id: number | null;
  client_name?: string | null;
  invoice_id: number | null;
  paid_date: string | null;
  paid_amount_pence: number | null;
  unit?: string | null;
  quantity?: string | null;
  notes?: string | null;
  work_status?: string | null;
  call_time?: string | null;
  venue_address?: string | null;
  booking_id?: number | null;
}

interface SummaryGroup {
  key: string;
  label: string;
  total_pence: number;
  entry_count: number;
}

interface EarningsSummary {
  total_pence: number;
  deductions_pence: number;
  entry_count: number;
  groups: SummaryGroup[];
  excluded: {
    needs_review: number;
    needs_review_pence: number;
    unpaid: number;
    unpaid_pence: number;
    other_currency: number;
  };
}

interface EarningsData {
  tax_year: { label: string; from: string; to: string };
  basis: string;
  summary: EarningsSummary;
  owed: EarningsEntry[];
  entries: EarningsEntry[];
}

// ── Invoice status badge ───────────────────────────────────────────────────────

function StatusBadge({ entry }: { entry: EarningsEntry }) {
  if (entry.status === "paid")
    return (
      <Badge
        variant="secondary"
        className="bg-green-100 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400"
      >
        Paid
      </Badge>
    );
  if (entry.status === "overdue")
    return (
      <Badge variant="outline" className="border-red-400 text-xs text-red-600 dark:text-red-400">
        Overdue
      </Badge>
    );
  if (entry.invoice_id || entry.status === "invoiced")
    return (
      <Badge variant="outline" className="border-blue-400 text-xs text-blue-600 dark:text-blue-400">
        Invoice sent
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Not invoiced
    </Badge>
  );
}

// ── Gig dialog (add / edit manual entries) ───────────────────────────────────

function JobDialog({
  open,
  onClose,
  editing,
  clients,
  prefill,
  jobApplicationId,
}: {
  open: boolean;
  onClose: () => void;
  editing: EarningsEntry | null;
  clients: Array<{ id: number; name: string }>;
  prefill?: Partial<GigForm>;
  jobApplicationId?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GigForm>(EMPTY_GIG_FORM);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          description: editing.description ?? "",
          client_name: editing.client_name ?? "",
          work_date: editing.work_date?.slice(0, 10) ?? "",
          work_end_date: editing.work_end_date?.slice(0, 10) ?? "",
          unit: (editing.unit as GigForm["unit"]) ?? "day",
          quantity: String(editing.quantity ?? 1),
          gross_amount:
            editing.gross_amount_pence != null ? (editing.gross_amount_pence / 100).toFixed(2) : "",
          currency: editing.currency ?? "GBP",
          status: (editing.status as GigForm["status"]) ?? "expected",
          paid_date: editing.paid_date?.slice(0, 10) ?? "",
          notes: editing.notes ?? "",
          work_status: (editing.work_status as GigForm["work_status"]) ?? "",
          call_time: editing.call_time ?? "",
          venue_address: editing.venue_address ?? "",
        });
      } else {
        setForm({ ...EMPTY_GIG_FORM, ...prefill });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = (k: keyof GigForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing
        ? apiRequest(`/api/earnings/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest("/api/earnings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/freelancer"] });
      toast({ title: editing ? "Job updated" : "Job added" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.description.trim() || !form.work_date) return;
    saveMutation.mutate({
      description: form.description.trim(),
      client_name: form.client_name.trim() || null,
      work_date: form.work_date,
      work_end_date: form.work_end_date || null,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 1,
      gross_amount: parseFloat(form.gross_amount) || 0,
      currency: form.currency,
      status: form.status,
      paid_date: form.status === "paid" ? form.paid_date || form.work_date : null,
      notes: form.notes || null,
      work_status: form.work_status || null,
      call_time: form.call_time || null,
      venue_address: form.venue_address || null,
      ...(jobApplicationId ? { job_application_id: jobApplicationId } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit job" : "Add job"}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <GigFormBody form={form} onChange={set} clients={clients} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !form.description.trim() || !form.work_date}
          >
            {editing ? "Save changes" : "Add job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Expense types ─────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  is_system: boolean;
  freelancer_id: number | null;
}

interface Expense {
  id: number;
  category_id: number | null;
  booking_id: number | null;
  earnings_entry_id: number | null;
  source: string;
  supplier: string | null;
  description: string;
  expense_date: string;
  net_amount_pence: number;
  vat_amount_pence: number;
  currency: string;
  payment_method: string | null;
  business_use_percent: number;
  billable_to_client: boolean;
  rebilled: boolean;
  allowable: boolean;
  notes: string | null;
}

interface ExpenseForm {
  description: string;
  supplier: string;
  expense_date: string;
  net_amount: string;
  category_id: string;
  job_id: string; // earnings_entry_id as string; "" = not linked
  // more details
  vat_amount: string;
  business_use_percent: string;
  payment_method: string;
  billable_to_client: boolean;
  allowable: boolean;
  notes: string;
}

function todayIso() {
  return ukToday();
}

function emptyExpenseForm(lastCategoryId?: string): ExpenseForm {
  return {
    description: "",
    supplier: "",
    expense_date: todayIso(),
    net_amount: "",
    category_id: lastCategoryId ?? "",
    job_id: "",
    vat_amount: "",
    business_use_percent: "100",
    payment_method: "",
    billable_to_client: false,
    allowable: true,
    notes: "",
  };
}

// ── Expense dialog ────────────────────────────────────────────────────────────

function ExpenseDialog({
  open,
  onClose,
  editing,
  categories,
  vatRegistered,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  editing: Expense | null;
  categories: ExpenseCategory[];
  vatRegistered: boolean;
  prefill?: Partial<ExpenseForm>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const amountRef = useRef<HTMLInputElement>(null);
  const lastCategoryRef = useRef<string>("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyExpenseForm());

  const { data: jobOptions = [] } = useQuery<JobOption[]>({
    queryKey: ["/api/earnings/jobs"],
    queryFn: () => apiRequest("/api/earnings/jobs"),
  });

  // Seed / reset form whenever the dialog opens or the expense being edited changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        description: editing.description,
        supplier: editing.supplier ?? "",
        expense_date: editing.expense_date.slice(0, 10),
        net_amount: (editing.net_amount_pence / 100).toFixed(2),
        category_id: editing.category_id ? String(editing.category_id) : "",
        job_id: editing.earnings_entry_id ? String(editing.earnings_entry_id) : "",
        vat_amount: editing.vat_amount_pence > 0 ? (editing.vat_amount_pence / 100).toFixed(2) : "",
        business_use_percent: String(editing.business_use_percent),
        payment_method: editing.payment_method ?? "",
        billable_to_client: editing.billable_to_client,
        allowable: editing.allowable,
        notes: editing.notes ?? "",
      });
      setMoreOpen(
        editing.business_use_percent < 100 ||
          !!editing.payment_method ||
          editing.billable_to_client ||
          !editing.allowable
      );
    } else {
      const base = emptyExpenseForm(lastCategoryRef.current || undefined);
      setForm({ ...base, ...prefill });
      setMoreOpen(false);
      setTimeout(() => amountRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = <K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Also shown when editing an expense that already carries VAT (entered while
  // registered), so it can't be hidden and silently kept.
  const showVat = vatRegistered || (editing?.vat_amount_pence ?? 0) > 0;

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      const token = localStorage.getItem("auth_token");
      const url = editing ? `/api/expenses/${editing.id}` : "/api/expenses";
      const method = editing ? "PATCH" : "POST";
      return apiRequest(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      if (form.category_id) lastCategoryRef.current = form.category_id;
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: editing ? "Expense updated" : "Expense added" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.description.trim() || !form.expense_date || !form.net_amount) return;
    const bookingId = form.job_id
      ? (jobOptions.find((j) => j.id === parseInt(form.job_id))?.booking_id ?? null)
      : null;
    saveMutation.mutate({
      description: form.description.trim(),
      supplier: form.supplier.trim() || null,
      expense_date: form.expense_date,
      net_amount_pence: Math.round(parseFloat(form.net_amount) * 100),
      vat_amount_pence: form.vat_amount ? Math.round(parseFloat(form.vat_amount) * 100) : 0,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      earnings_entry_id: form.job_id ? parseInt(form.job_id) : null,
      booking_id: bookingId,
      business_use_percent: parseInt(form.business_use_percent) || 100,
      payment_method: form.payment_method || null,
      billable_to_client: form.billable_to_client,
      allowable: form.allowable,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Amount — focused first. A VAT-registered freelancer deducts the net
              and reclaims the VAT, so the VAT sits beside the amount where it
              can't be skipped: left blank, the receipt looks zero-rated and the
              books count the reclaimed VAT as a cost. */}
          <div className={showVat ? "grid grid-cols-2 gap-3" : ""}>
            <div className="space-y-1">
              <Label htmlFor="exp-amount">
                {showVat ? "Amount excl. VAT (£) *" : "Amount (£) *"}
              </Label>
              <Input
                id="exp-amount"
                ref={amountRef}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.net_amount}
                onChange={(e) => set("net_amount", e.target.value)}
                style={{ fontSize: "16px" }}
              />
            </div>
            {showVat && (
              <div className="space-y-1">
                <Label htmlFor="exp-vat">VAT (£)</Label>
                <Input
                  id="exp-vat"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.vat_amount}
                  onChange={(e) => set("vat_amount", e.target.value)}
                  style={{ fontSize: "16px" }}
                />
              </div>
            )}
          </div>
          {showVat && (
            <p className="-mt-2 text-xs text-muted-foreground">
              From the receipt. Leave VAT blank only if none was charged.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="exp-date">Date *</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.expense_date}
                onChange={(e) => set("expense_date", e.target.value)}
                style={{ fontSize: "16px" }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-category">Category</Label>
              <SearchableSelect
                id="expense-category"
                value={form.category_id}
                onChange={(v) => set("category_id", v)}
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder="Pick one"
                searchPlaceholder="Type a category"
                emptyLabel="No categories match"
                triggerClassName="text-base"
                aria-label="Category"
              />
            </div>
          </div>

          {/* Car purchase guard */}
          {(() => {
            const selectedCat = categories.find((c) => String(c.id) === form.category_id);
            const isVehicleCategory = selectedCat?.name.toLowerCase().includes("vehicle");
            if (!isVehicleCategory) return null;
            return (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <p data-help="tax.vehicleCapitalAllowance" className="font-semibold">
                  Recording a car? Capital allowances apply.
                </p>
                <p className="mt-0.5">
                  Under HMRC&apos;s cash basis, cars are not deductible as an ordinary expense —
                  they go through capital allowances at a writing-down rate based on CO₂ emissions.
                  Recording the purchase here will <span className="font-medium">overstate</span>{" "}
                  your allowable expenses and produce a wrong profit figure.
                </p>
                <p className="mt-0.5">
                  <span className="font-medium">Vans are fine here</span> — a commercial van is
                  deductible under cash basis. If this is a van, carry on.
                </p>
                <p
                  data-help="tax.mileageOrCosts"
                  className="mt-0.5 text-amber-700 dark:text-amber-300"
                >
                  Also note: if you claim simplified mileage on a vehicle, you cannot also claim
                  running costs or capital allowances for the same vehicle.
                </p>
              </div>
            );
          })()}

          {/* Job link (optional) */}
          <JobSelect value={form.job_id} onChange={(v) => set("job_id", v)} />

          <div className="space-y-1">
            <Label htmlFor="exp-supplier">Supplier</Label>
            <Input
              id="exp-supplier"
              placeholder="e.g. Shell, Travelodge, Screwfix"
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              style={{ fontSize: "16px" }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="exp-desc">Description *</Label>
            <Input
              id="exp-desc"
              placeholder="What was this for?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* More details — collapsed by default */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                />
                More details
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="exp-biz">Business use %</Label>
                <Input
                  id="exp-biz"
                  type="number"
                  min="0"
                  max="100"
                  value={form.business_use_percent}
                  onChange={(e) => set("business_use_percent", e.target.value)}
                  style={{ fontSize: "16px" }}
                />
                <p className="text-xs text-muted-foreground">
                  For mixed personal/business use, e.g. 50% for a phone used half for work.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="books-payment-method-set-719">Payment method</Label>
                <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                  <SelectTrigger id="books-payment-method-set-719" style={{ fontSize: "16px" }}>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="exp-billable"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.billable_to_client}
                  onChange={(e) => set("billable_to_client", e.target.checked)}
                />
                <Label htmlFor="exp-billable" className="cursor-pointer font-normal">
                  Billable to client
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="exp-allowable"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.allowable}
                  onChange={(e) => set("allowable", e.target.checked)}
                />
                <Label htmlFor="exp-allowable" className="cursor-pointer font-normal">
                  Allowable for tax
                </Label>
              </div>
              {!form.allowable && (
                <p className="text-xs text-muted-foreground">
                  Disallowable expenses are excluded from your tax estimate (client entertainment,
                  fines, non-business costs, etc.).
                </p>
              )}

              <div className="space-y-1">
                <Label htmlFor="exp-notes">Notes</Label>
                <Textarea
                  id="exp-notes"
                  rows={2}
                  placeholder="Any extra details…"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saveMutation.isPending ||
              !form.description.trim() ||
              !form.expense_date ||
              !form.net_amount
            }
          >
            {editing ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Receipt types ─────────────────────────────────────────────────────────────

interface ReceiptRecord {
  id: number;
  expense_id: number | null;
  file_name: string;
  mime_type: string;
  captured_at: string;
  url: string;
}

// ── Receipt thumbnails + upload for a single expense ──────────────────────────

function ReceiptRow({ expenseId }: { expenseId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: recs = [] } = useQuery<ReceiptRecord[]>({
    queryKey: ["/api/expenses", expenseId, "receipts"],
    queryFn: () => {
      const token = localStorage.getItem("auth_token");
      return fetch(`/api/expenses/${expenseId}/receipts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      const fileData: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData,
          filename: file.name,
          contentType: file.type || "image/jpeg",
          expense_id: expenseId,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", expenseId, "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unattached/count"] });
      toast({ title: "Receipt saved" });
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => {
      const token = localStorage.getItem("auth_token");
      return fetch(`/api/receipts/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", expenseId, "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unattached/count"] });
    },
    onError: () => toast({ title: "Failed to remove receipt", variant: "destructive" }),
  });

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {recs.map((r) => (
        <div key={r.id} className="group relative">
          {r.mime_type.startsWith("image/") ? (
            <button onClick={() => setLightboxUrl(r.url)}>
              <img
                src={r.url}
                alt={r.file_name}
                className="h-10 w-10 rounded border object-cover"
              />
            </button>
          ) : (
            <a href={r.url} target="_blank" rel="noreferrer">
              <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            </a>
          )}
          <button
            className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
            onClick={() => archiveMutation.mutate(r.id)}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      {/* Camera-first add button */}
      <button
        className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        title="Add receipt"
        disabled={uploadMutation.isPending}
        onClick={() => fileRef.current?.click()}
      >
        {uploadMutation.isPending ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadMutation.mutate(f);
          e.target.value = "";
        }}
      />

      {/* Lightbox */}
      {lightboxUrl && (
        // Backdrop click-to-close is a mouse convenience; the dialog has its own close control
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          {/* Only stops the click closing the lightbox; not a control */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src={lightboxUrl}
            alt="Receipt"
            className="max-h-[90vh] max-w-[90vw] rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-4 top-4 text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Unattached receipt inbox ───────────────────────────────────────────────────

function UnattachedInbox({ expenses }: { expenses: Expense[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: recs = [], refetch } = useQuery<ReceiptRecord[]>({
    queryKey: ["/api/receipts/unattached"],
    queryFn: () => {
      const token = localStorage.getItem("auth_token");
      return fetch("/api/receipts/unattached", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
    },
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      const fileData: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData,
          filename: file.name,
          contentType: file.type || "image/jpeg",
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unattached"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unattached/count"] });
      toast({ title: "Receipt saved — attach it to an expense when ready" });
      setOpen(true);
      refetch();
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const attachMutation = useMutation({
    mutationFn: ({ receiptId, expenseId }: { receiptId: number; expenseId: number }) => {
      const token = localStorage.getItem("auth_token");
      return fetch(`/api/receipts/${receiptId}/attach`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ expense_id: expenseId }),
      });
    },
    onSuccess: (_, { expenseId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unattached"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unattached/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses", expenseId, "receipts"] });
      toast({ title: "Receipt attached" });
    },
    onError: () => toast({ title: "Failed to attach", variant: "destructive" }),
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/receipts/unattached/count"],
    queryFn: () => {
      const token = localStorage.getItem("auth_token");
      return fetch("/api/receipts/unattached/count", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
    },
  });

  const unattachedCount = countData?.count ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-base font-semibold"
            onClick={() => setOpen((v) => !v)}
          >
            <Camera className="h-4 w-4" />
            Receipt inbox
            {unattachedCount > 0 && <Badge className="ml-1 text-xs">{unattachedCount}</Badge>}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            title="Capture receipt now"
            disabled={uploadMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadMutation.mutate(f);
              e.target.value = "";
            }}
          />
        </div>
        {!open && unattachedCount === 0 && (
          <p className="text-xs text-muted-foreground">
            Capture receipts on site — attach to an expense later.
          </p>
        )}
      </CardHeader>
      {open && (
        <CardContent>
          {recs.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No unattached receipts.</p>
          ) : (
            <div className="space-y-3">
              {recs.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  {r.mime_type.startsWith("image/") ? (
                    <button
                      className="shrink-0 cursor-zoom-in"
                      onClick={() => setLightboxUrl(r.url)}
                      title="View full size"
                    >
                      <img
                        src={r.url}
                        alt={r.file_name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    </button>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.file_name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(r.captured_at)}</p>
                  </div>
                  {expenses.length > 0 && (
                    <SearchableSelect
                      value=""
                      onChange={(v) => {
                        const expId = parseInt(v);
                        if (expId) attachMutation.mutate({ receiptId: r.id, expenseId: expId });
                      }}
                      options={expenses.map((exp) => ({
                        value: String(exp.id),
                        label: exp.supplier || exp.description,
                        sublabel: fmtDate(exp.expense_date),
                        keywords: [exp.description, exp.supplier],
                      }))}
                      placeholder="Attach to…"
                      searchPlaceholder="Type a supplier, description or date"
                      emptyLabel="No expenses match"
                      className="h-8 w-40 shrink-0 px-2 text-xs"
                      aria-label="Attach receipt to expense"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        // Backdrop click-to-close is a mouse convenience; the dialog has its own close control
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          {/* Only stops the click closing the lightbox; not a control */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src={lightboxUrl}
            alt="Receipt"
            className="max-h-[90vh] max-w-[90vw] rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-4 top-4 text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Expenses section ──────────────────────────────────────────────────────────

// ── List filters ───────────────────────────────────────────────────────────────
// A labelled filter row at the top of an opened list (Earnings, Expenses).

const EARNINGS_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "expected", label: "Expected" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "needs_review", label: "Needs review" },
  { value: "other_currency", label: "Other currency" },
];

const CURRENCY_OPTIONS = [
  { value: "all", label: "All currencies" },
  { value: "gbp", label: "Pounds only" },
  { value: "other", label: "Other currencies" },
];

function ListFilters({
  active,
  onClear,
  children,
}: {
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/30 px-5 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Filter
      </span>
      {children}
      {active && (
        <button
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          onClick={onClear}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  helpKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  helpKey?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-help={helpKey} className="h-8 w-40 bg-background text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ExpensesSection({ initialCurrency = "all" }: { initialCurrency?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data: categoriesData = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const { data: billingProfile } = useQuery<{
    vat_registered?: boolean;
    vat_scheme?: string;
  } | null>({
    queryKey: ["/api/billing-profile"],
    retry: false,
  });

  const { data: expensesData, isLoading } = useQuery<{
    expenses: Expense[];
    total: number;
  }>({
    queryKey: ["/api/expenses"],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => {
      const token = localStorage.getItem("auth_token");
      return apiRequest(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense removed" });
    },
    onError: () => toast({ title: "Failed to remove expense", variant: "destructive" }),
  });

  const vatRegistered = Boolean(billingProfile?.vat_registered);
  // Flat Rate Scheme users are registered but reclaim nothing: their costs count gross
  const reclaimsVat = reclaimsInputVat(billingProfile);
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState(initialCurrency);
  const expenses = (expensesData?.expenses ?? [])
    .filter((e) => matchesOrigin(e, originFilter))
    .filter((e) =>
      currencyFilter === "gbp"
        ? isBooksCurrency(e.currency)
        : currencyFilter === "other"
          ? !isBooksCurrency(e.currency)
          : true
    );

  const categoryMap = Object.fromEntries(categoriesData.map((c) => [c.id, c.name]));

  const expenseMonths = groupByMonth(expenses, "expense_date").reverse();

  const uid = user?.id ?? "anon";
  const [sectionOpen, setSectionOpen] = useState(() => {
    try {
      return localStorage.getItem(`books-section-expenses-${uid}`) !== "0";
    } catch {
      return true;
    }
  });
  const toggleSection = () => {
    const next = !sectionOpen;
    setSectionOpen(next);
    try {
      localStorage.setItem(`books-section-expenses-${uid}`, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const openAdd = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* Whole header is a mouse target; it holds a button, so the title block below is the keyboard control */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className="cursor-pointer bg-amber-500 px-5 py-3 dark:bg-amber-700"
          onClick={toggleSection}
        >
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2"
              {...keyActivate(toggleSection, { expanded: sectionOpen })}
            >
              <ChevronDown
                className={`h-4 w-4 text-amber-100 transition-transform ${sectionOpen ? "" : "-rotate-90"}`}
              />
              <Receipt className="h-4 w-4 text-amber-100" />
              <p className="font-semibold text-white">Expenses</p>
              {expenses.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                  {expenses.length}
                </span>
              )}
              {originFilter !== "all" && (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Filtered
                </span>
              )}
            </div>
            <Button
              data-help="books.expenses.addExpense"
              size="sm"
              className="h-7 bg-white text-xs text-amber-700 hover:bg-amber-50"
              onClick={(e) => {
                e.stopPropagation();
                openAdd();
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add expense
            </Button>
          </div>
        </div>
        {sectionOpen && (
          <CardContent className="p-0">
            <ListFilters
              active={originFilter !== "all" || currencyFilter !== "all"}
              onClear={() => {
                setOriginFilter("all");
                setCurrencyFilter("all");
              }}
            >
              <FilterSelect
                label="Source"
                helpKey="books.earnings.filterOrigin"
                value={originFilter}
                onChange={(v) => setOriginFilter(v as OriginFilter)}
                options={ORIGIN_OPTIONS}
              />
              <FilterSelect
                label="Currency"
                helpKey="books.expenses.filterCurrency"
                value={currencyFilter}
                onChange={setCurrencyFilter}
                options={CURRENCY_OPTIONS}
              />
            </ListFilters>
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg border p-3">
                    <div className="mb-1 h-3 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : expenses.length === 0 && (originFilter !== "all" || currencyFilter !== "all") ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses match these filters.
              </p>
            ) : expenses.length === 0 ? (
              <div className="py-10 text-center">
                <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="mb-1 font-medium text-muted-foreground">No expenses yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first expense — travel and parking, tools, PPE, kit hire
                </p>
                <Button className="mt-4" size="sm" onClick={openAdd}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add your first expense
                </Button>
              </div>
            ) : (
              <div>
                {expenseMonths.map(({ key, items: monthExpenses }, mi) => {
                  const monthTotal = monthExpenses.reduce(
                    (sum, e) =>
                      e.allowable
                        ? sum +
                          Math.round((expenseBase(e, reclaimsVat) * e.business_use_percent) / 100)
                        : sum,
                    0
                  );
                  return (
                    <MonthSection
                      key={key}
                      monthKey={key}
                      total={monthTotal}
                      accentClass="text-amber-700 dark:text-amber-400"
                      headerClass="bg-amber-50/60 dark:bg-amber-950/20"
                      storageKey={`books-exp-month-${key}-${user?.id}`}
                      divider={mi < expenseMonths.length - 1}
                    >
                      {monthExpenses.map((expense, i) => {
                        const allowableAmount = Math.round(
                          (expenseBase(expense, reclaimsVat) * expense.business_use_percent) / 100
                        );
                        const catName = expense.category_id
                          ? categoryMap[expense.category_id]
                          : null;
                        return (
                          <div
                            key={expense.id}
                            className={`flex items-start justify-between px-5 py-3 ${i % 2 === 0 ? "bg-muted/20" : ""}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-medium">
                                  {expense.supplier || expense.description}
                                </p>
                                {catName && (
                                  <Badge className="bg-amber-100 text-xs text-amber-800 hover:bg-amber-100">
                                    {catName}
                                  </Badge>
                                )}
                                {expense.billable_to_client && !expense.rebilled && (
                                  <Badge className="bg-blue-100 text-xs text-blue-700 hover:bg-blue-100">
                                    Billable
                                  </Badge>
                                )}
                                {!expense.allowable && (
                                  <Badge className="bg-red-100 text-xs text-red-700 hover:bg-red-100">
                                    Disallowable
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(expense.expense_date)}
                                {expense.supplier && expense.description !== expense.supplier
                                  ? ` · ${expense.description}`
                                  : ""}
                              </p>
                              <ReceiptRow expenseId={expense.id} />
                            </div>
                            <div className="ml-3 flex items-center gap-2">
                              <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                                {formatPence(allowableAmount)}
                              </span>
                              <button
                                className="text-muted-foreground transition-colors hover:text-foreground"
                                title="Edit"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="text-muted-foreground transition-colors hover:text-destructive"
                                title="Remove"
                                onClick={() => archiveMutation.mutate(expense.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </MonthSection>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <UnattachedInbox expenses={expenses} />

      <ExpenseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editingExpense}
        categories={categoriesData}
        vatRegistered={vatRegistered}
      />
      <RecentlyRemoved table="expenses" />
    </div>
  );
}

// ── Mileage section ───────────────────────────────────────────────────────────

interface MileageTrip {
  id: number;
  trip_date: string;
  from_place: string;
  to_place: string;
  miles: number;
  purpose: string;
  vehicle_type: string;
  amount_pence: number;
  rate_pence: number;
  booking_id: number | null;
  earnings_entry_id: number | null;
  notes: string | null;
}

interface SavedPlace {
  id: number;
  label: string;
  address: string | null;
}

interface MileageRate {
  id: number;
  vehicle_type: string;
  rate_pence: number;
  threshold_miles: number | null;
  rate_above_pence: number | null;
}

interface TripForm {
  trip_date: string;
  from_place: string;
  to_place: string;
  miles: string;
  purpose: string;
  vehicle_type: string;
  job_id: string;
  notes: string;
}

const EMPTY_TRIP: TripForm = {
  trip_date: ukToday(),
  from_place: "",
  to_place: "",
  miles: "",
  purpose: "",
  vehicle_type: "car",
  job_id: "",
  notes: "",
};

function TripDialog({
  open,
  onClose,
  editing,
  savedPlaces,
}: {
  open: boolean;
  onClose: () => void;
  editing: MileageTrip | null;
  savedPlaces: SavedPlace[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TripForm>(EMPTY_TRIP);

  const { data: jobOptions = [] } = useQuery<JobOption[]>({
    queryKey: ["/api/earnings/jobs"],
    queryFn: () => apiRequest("/api/earnings/jobs"),
  });

  // Prime form when opening
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        trip_date: editing.trip_date,
        from_place: editing.from_place,
        to_place: editing.to_place,
        miles: String(editing.miles),
        purpose: editing.purpose,
        vehicle_type: editing.vehicle_type,
        job_id: editing.earnings_entry_id ? String(editing.earnings_entry_id) : "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm({ ...EMPTY_TRIP, trip_date: ukToday() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set =
    (k: keyof TripForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      const url = editing ? `/api/mileage/trips/${editing.id}` : "/api/mileage/trips";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          miles: parseInt(form.miles),
          earnings_entry_id: form.job_id ? parseInt(form.job_id) : null,
          booking_id: form.job_id
            ? (jobOptions.find((j) => j.id === parseInt(form.job_id))?.booking_id ?? null)
            : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mileage/trips"] });
      toast({ title: editing ? "Trip updated" : "Trip logged" });
      onClose();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const placeOptions = savedPlaces.map((p) => (
    <option key={p.id} value={p.label}>
      {p.label}
    </option>
  ));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit trip" : "Log trip"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="books-date-1670">Date</Label>
            <Input
              id="books-date-1670"
              type="date"
              value={form.trip_date}
              onChange={set("trip_date")}
            />
          </div>
          <div>
            <Label htmlFor="books-from-1674">From</Label>
            <Input
              id="books-from-1674"
              list="saved-places-from"
              placeholder="Starting point"
              value={form.from_place}
              onChange={set("from_place")}
            />
            <datalist id="saved-places-from">{placeOptions}</datalist>
          </div>
          <div>
            <Label htmlFor="books-to-1684">To</Label>
            <Input
              id="books-to-1684"
              list="saved-places-to"
              placeholder="Destination"
              value={form.to_place}
              onChange={set("to_place")}
            />
            <datalist id="saved-places-to">{placeOptions}</datalist>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="books-miles-1695">Miles</Label>
              <Input
                id="books-miles-1695"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={form.miles}
                onChange={set("miles")}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="books-vehicle-1706">Vehicle</Label>
              <select
                id="books-vehicle-1706"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.vehicle_type}
                onChange={set("vehicle_type")}
              >
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="books-purpose-1719">Purpose</Label>
            <Input
              id="books-purpose-1719"
              placeholder="Client visit, site survey…"
              value={form.purpose}
              onChange={set("purpose")}
            />
          </div>
          <JobSelect value={form.job_id} onChange={(v) => setForm((f) => ({ ...f, job_id: v }))} />
          <div>
            <Label htmlFor="books-notes-1728">Notes (optional)</Label>
            <Textarea id="books-notes-1728" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending ||
              !form.from_place ||
              !form.to_place ||
              !form.miles ||
              !form.purpose
            }
          >
            {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Log trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Time ──────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: number;
  earnings_entry_id: number;
  work_date: string;
  start_time: string;
  finish_time: string;
  break_minutes: number;
  notes: string | null;
}

interface OvertimeSummary {
  days: (TimeEntry & { worked_minutes: number; overtime_minutes: number | null })[];
  total_worked_minutes: number;
  total_overtime_minutes: number | null;
  overtime_hours_suggested: number | null;
  overtime_pence_suggested: number | null;
  standard_hours_per_day: number | null;
  overtime_rate_pence: number | null;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function TimeSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    standard_hours: "",
    overtime_rate: "",
  });
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [dayForm, setDayForm] = useState({
    work_date: ukToday(),
    start_time: "09:00",
    finish_time: "18:00",
    break_minutes: "60",
    notes: "",
  });
  const [overtimeOverride, setOvertimeOverride] = useState<string>("");
  const [overtimeConfirmed, setOvertimeConfirmed] = useState(false);

  const entryId = selectedJobId ? parseInt(selectedJobId) : null;

  const { data: summary, isLoading } = useQuery<OvertimeSummary>({
    queryKey: ["/api/earnings/entries", entryId, "time/summary"],
    queryFn: () => apiRequest(`/api/earnings/entries/${entryId}/time/summary`),
    enabled: !!entryId,
  });

  // Sync settings form when summary loads
  const prevEntryId = useRef<number | null>(null);
  if (entryId !== prevEntryId.current) {
    prevEntryId.current = entryId;
    if (summary) {
      setSettingsForm({
        standard_hours: summary.standard_hours_per_day?.toString() ?? "",
        overtime_rate: summary.overtime_rate_pence
          ? (summary.overtime_rate_pence / 100).toFixed(2)
          : "",
      });
      setOvertimeOverride(summary.overtime_hours_suggested?.toString() ?? "");
      setOvertimeConfirmed(false);
    }
  }

  const upsertMut = useMutation({
    mutationFn: (data: typeof dayForm) =>
      apiRequest(`/api/earnings/entries/${entryId}/time`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          break_minutes: parseInt(data.break_minutes) || 0,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/earnings/entries", entryId, "time/summary"],
      });
      setEditingDate(null);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/earnings/entries/${entryId}/time/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/earnings/entries", entryId, "time/summary"],
      }),
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const settingsMut = useMutation({
    mutationFn: (data: {
      standard_hours_per_day: number | null;
      overtime_rate_pence: number | null;
    }) =>
      apiRequest(`/api/earnings/entries/${entryId}/overtime`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/earnings/entries", entryId, "time/summary"],
      });
      setShowSettings(false);
      toast({ title: "Overtime settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  function openAddDay() {
    setDayForm({
      work_date: ukToday(),
      start_time: "09:00",
      finish_time: "18:00",
      break_minutes: "60",
      notes: "",
    });
    setEditingDate("new");
  }

  function openEditDay(entry: TimeEntry) {
    setDayForm({
      work_date: entry.work_date.slice(0, 10),
      start_time: entry.start_time,
      finish_time: entry.finish_time,
      break_minutes: String(entry.break_minutes),
      notes: entry.notes ?? "",
    });
    setEditingDate(entry.work_date.slice(0, 10));
  }

  function saveSettings() {
    const standardHours = settingsForm.standard_hours
      ? parseInt(settingsForm.standard_hours)
      : null;
    const overtimeRate = settingsForm.overtime_rate
      ? Math.round(parseFloat(settingsForm.overtime_rate) * 100)
      : null;
    settingsMut.mutate({
      standard_hours_per_day: standardHours,
      overtime_rate_pence: overtimeRate,
    });
  }

  const suggestedHours = summary?.overtime_hours_suggested ?? null;
  const effectiveOvertimeHours =
    overtimeOverride !== "" ? parseFloat(overtimeOverride) : suggestedHours;
  const overtimePence =
    effectiveOvertimeHours !== null && summary?.overtime_rate_pence
      ? Math.round(effectiveOvertimeHours * summary.overtime_rate_pence)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Timer className="h-4 w-4" /> Time &amp; overtime
        </h3>
      </div>

      <JobSelect
        value={selectedJobId}
        onChange={(v) => {
          setSelectedJobId(v);
          setEditingDate(null);
          setOvertimeConfirmed(false);
        }}
        label="Select a job to log time against"
      />

      {!selectedJobId && (
        <p className="text-sm text-muted-foreground">Choose a job above to log and review hours.</p>
      )}

      {selectedJobId && isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {selectedJobId && summary && (
        <div className="space-y-4">
          {/* Day rows */}
          <div className="rounded border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <span className="text-sm font-medium">Days logged</span>
              <Button size="sm" variant="outline" onClick={openAddDay}>
                <Plus className="mr-1 h-3 w-3" /> Add day
              </Button>
            </div>
            {summary.days.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">No days logged yet.</p>
            )}
            {summary.days.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-0"
              >
                <div className="space-y-0.5">
                  <span className="font-medium">{fmtDate(d.work_date)}</span>
                  <span className="ml-3 text-muted-foreground">
                    {d.start_time}–{d.finish_time}
                    {d.break_minutes > 0 ? ` (${d.break_minutes}m break)` : ""}
                  </span>
                  <span className="ml-3 text-muted-foreground">
                    = {minutesToHHMM(d.worked_minutes)} worked
                    {d.overtime_minutes !== null && d.overtime_minutes > 0
                      ? ` · ${minutesToHHMM(d.overtime_minutes)} OT`
                      : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEditDay(d)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(d.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add/edit day form */}
          {editingDate && (
            <div className="space-y-3 rounded border bg-muted/20 p-4">
              <p className="text-sm font-medium">
                {editingDate === "new" ? "Log a day" : "Edit day"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="books-date-1991" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="books-date-1991"
                    type="date"
                    value={dayForm.work_date}
                    onChange={(e) => setDayForm((f) => ({ ...f, work_date: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <Label htmlFor="books-break-2000" className="text-xs">
                    Break (minutes)
                  </Label>
                  <Input
                    id="books-break-2000"
                    type="number"
                    min={0}
                    value={dayForm.break_minutes}
                    onChange={(e) => setDayForm((f) => ({ ...f, break_minutes: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <Label htmlFor="books-start-2010" className="text-xs">
                    Start
                  </Label>
                  <Input
                    id="books-start-2010"
                    type="time"
                    value={dayForm.start_time}
                    onChange={(e) => setDayForm((f) => ({ ...f, start_time: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <Label htmlFor="books-finish-2019" className="text-xs">
                    Finish
                  </Label>
                  <Input
                    id="books-finish-2019"
                    type="time"
                    value={dayForm.finish_time}
                    onChange={(e) => setDayForm((f) => ({ ...f, finish_time: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="books-notes-2029" className="text-xs">
                  Notes (optional)
                </Label>
                <Input
                  id="books-notes-2029"
                  value={dayForm.notes}
                  onChange={(e) => setDayForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Night shoot, location day…"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => upsertMut.mutate(dayForm)}
                  disabled={
                    upsertMut.isPending ||
                    !dayForm.work_date ||
                    !dayForm.start_time ||
                    !dayForm.finish_time
                  }
                >
                  {upsertMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingDate(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Totals */}
          {summary.days.length > 0 && (
            <div className="space-y-1 rounded border px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total hours worked</span>
                <span className="font-medium">{minutesToHHMM(summary.total_worked_minutes)}</span>
              </div>
              {summary.total_overtime_minutes !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime (suggested)</span>
                  <span className="font-medium">
                    {summary.overtime_hours_suggested?.toFixed(2)}h
                    {summary.overtime_pence_suggested !== null
                      ? ` · ${formatPence(summary.overtime_pence_suggested)}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Overtime override */}
          {summary.total_overtime_minutes !== null && summary.total_overtime_minutes > 0 && (
            <div className="space-y-3 rounded border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-800 dark:bg-amber-950/20">
              <p className="text-sm font-medium">Overtime to invoice</p>
              <p className="text-xs text-muted-foreground">
                Based on the hours you logged, {summary.overtime_hours_suggested?.toFixed(2)}h of
                overtime is suggested. You can adjust this before it reaches the invoice — this is a
                prefill, not a ruling.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="books-overtime-hours-to-invoice-2089" className="text-xs">
                    Overtime hours to invoice
                  </Label>
                  <Input
                    id="books-overtime-hours-to-invoice-2089"
                    type="number"
                    min={0}
                    step={0.25}
                    value={
                      overtimeOverride !== ""
                        ? overtimeOverride
                        : (suggestedHours?.toString() ?? "")
                    }
                    onChange={(e) => {
                      setOvertimeOverride(e.target.value);
                      setOvertimeConfirmed(false);
                    }}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                {effectiveOvertimeHours !== null && summary.overtime_rate_pence && (
                  <div className="pt-5 text-right">
                    <span className="text-sm font-medium">{formatPence(overtimePence)}</span>
                  </div>
                )}
              </div>
              {!overtimeConfirmed ? (
                <Button
                  size="sm"
                  onClick={() => setOvertimeConfirmed(true)}
                  disabled={effectiveOvertimeHours === null || effectiveOvertimeHours <= 0}
                >
                  Confirm overtime figure
                </Button>
              ) : (
                <p className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  {effectiveOvertimeHours?.toFixed(2)}h confirmed — this will prefill the invoice
                  (PR 5)
                </p>
              )}
            </div>
          )}

          {/* Settings */}
          <div className="rounded border">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
              onClick={() => {
                if (!showSettings) {
                  setSettingsForm({
                    standard_hours: summary.standard_hours_per_day?.toString() ?? "",
                    overtime_rate: summary.overtime_rate_pence
                      ? (summary.overtime_rate_pence / 100).toFixed(2)
                      : "",
                  });
                }
                setShowSettings((v) => !v);
              }}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" /> Overtime settings
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${showSettings ? "rotate-180" : ""}`}
              />
            </button>
            {showSettings && (
              <div className="space-y-3 border-t px-4 pb-4">
                <p className="pt-3 text-xs text-muted-foreground">
                  Used to calculate the overtime suggestion — these are your agreed terms for this
                  job.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="books-standard-hours-per-day-2161" className="text-xs">
                      Standard hours per day
                    </Label>
                    <Input
                      id="books-standard-hours-per-day-2161"
                      type="number"
                      min={1}
                      max={24}
                      placeholder="e.g. 10"
                      value={settingsForm.standard_hours}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, standard_hours: e.target.value }))
                      }
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="books-overtime-rate-2175" className="text-xs">
                      Overtime rate (£/hr)
                    </Label>
                    <Input
                      id="books-overtime-rate-2175"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="e.g. 18.75"
                      value={settingsForm.overtime_rate}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, overtime_rate: e.target.value }))
                      }
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>
                <Button size="sm" onClick={saveSettings} disabled={settingsMut.isPending}>
                  {settingsMut.isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MileageSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<MileageTrip | null>(null);
  const [showPlaces, setShowPlaces] = useState(false);
  const [newPlaceLabel, setNewPlaceLabel] = useState("");

  const { data: tripsData, isLoading } = useQuery<{ trips: MileageTrip[]; total_pence: number }>({
    queryKey: ["/api/mileage/trips"],
    queryFn: () => {
      const token = localStorage.getItem("auth_token");
      return fetch("/api/mileage/trips", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
    },
  });

  const { data: savedPlaces = [] } = useQuery<SavedPlace[]>({
    queryKey: ["/api/mileage/places"],
    queryFn: () => {
      const token = localStorage.getItem("auth_token");
      return fetch("/api/mileage/places", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
    },
  });

  const { data: rate } = useQuery<MileageRate>({
    queryKey: ["/api/mileage/rate"],
    queryFn: () => {
      const token = localStorage.getItem("auth_token");
      return fetch("/api/mileage/rate", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => {
      const token = localStorage.getItem("auth_token");
      return fetch(`/api/mileage/trips/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/mileage/trips"] }),
    onError: () => toast({ title: "Failed to remove trip", variant: "destructive" }),
  });

  const addPlaceMutation = useMutation({
    mutationFn: (label: string) => {
      const token = localStorage.getItem("auth_token");
      return fetch("/api/mileage/places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ label }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mileage/places"] });
      setNewPlaceLabel("");
      toast({ title: "Place saved" });
    },
    onError: () => toast({ title: "Failed to save place", variant: "destructive" }),
  });

  const deletePlaceMutation = useMutation({
    mutationFn: (id: number) => {
      const token = localStorage.getItem("auth_token");
      return fetch(`/api/mileage/places/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/mileage/places"] }),
    onError: () => toast({ title: "Failed to delete place", variant: "destructive" }),
  });

  const trips = tripsData?.trips ?? [];
  const totalPence = tripsData?.total_pence ?? 0;

  const tripMonths = groupByMonth(trips, "trip_date").reverse();

  const uid = user?.id ?? "anon";
  const [tripsOpen, setTripsOpen] = useState(() => {
    try {
      return localStorage.getItem(`books-section-mileage-${uid}`) !== "0";
    } catch {
      return true;
    }
  });
  const toggleTrips = () => {
    const next = !tripsOpen;
    setTripsOpen(next);
    try {
      localStorage.setItem(`books-section-mileage-${uid}`, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary + action header */}
      <Card className="overflow-hidden">
        <div className="bg-purple-600 px-5 py-3 dark:bg-purple-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-purple-100" />
              <p className="font-semibold text-white">Mileage</p>
              {trips.length > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
                  {trips.length} trips
                </span>
              )}
            </div>
            <Button
              data-help="books.mileage.addTrip"
              size="sm"
              className="h-7 bg-white text-xs text-purple-700 hover:bg-purple-50"
              onClick={() => {
                setEditingTrip(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Log trip
            </Button>
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="flex items-center gap-6">
            <div className="rounded-lg bg-purple-50 px-5 py-3 dark:bg-purple-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-purple-500">
                Allowance this year
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-300">
                {formatPence(totalPence)}
              </p>
            </div>
            {rate && (
              <p className="text-xs text-muted-foreground">
                {rate.rate_pence}p/mile
                {rate.threshold_miles
                  ? ` · then ${rate.rate_above_pence}p after ${rate.threshold_miles.toLocaleString()} miles`
                  : ""}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trip list */}
      <Card className="overflow-hidden">
        <div
          className="cursor-pointer border-l-4 border-purple-400 bg-purple-50/40 px-5 py-3 dark:bg-purple-950/20"
          {...pressable(toggleTrips)}
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-3.5 w-3.5 text-purple-600 transition-transform ${tripsOpen ? "" : "-rotate-90"}`}
            />
            <p className="font-semibold">Trips</p>
          </div>
        </div>
        {tripsOpen && (
          <CardContent className="p-0">
            {isLoading ? (
              <div className="animate-pulse space-y-2 p-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded bg-muted" />
                ))}
              </div>
            ) : trips.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Navigation className="h-8 w-8 opacity-30" />
                <p className="text-sm">No trips logged yet.</p>
              </div>
            ) : (
              <div>
                {tripMonths.map(({ key: month, items: monthTrips }, mi) => {
                  const monthTotal = monthTrips.reduce((s, t) => s + t.amount_pence, 0);
                  return (
                    <MonthSection
                      key={month}
                      monthKey={month}
                      total={monthTotal}
                      accentClass="text-purple-700 dark:text-purple-400"
                      headerClass="bg-purple-50/60 dark:bg-purple-950/20"
                      storageKey={`books-mil-month-${month}-${user?.id}`}
                      divider={mi < tripMonths.length - 1}
                    >
                      {monthTrips.map((trip, i) => (
                        <div
                          key={trip.id}
                          className={`flex items-start justify-between px-5 py-3 ${i % 2 === 0 ? "bg-muted/20" : ""}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {trip.from_place} → {trip.to_place}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(trip.trip_date)} · {trip.miles} mi · {trip.purpose}
                            </p>
                          </div>
                          <div className="ml-3 flex items-center gap-2">
                            <span className="min-w-[72px] text-right text-sm font-semibold tabular-nums text-purple-700 dark:text-purple-300">
                              {formatPence(trip.amount_pence)}
                            </span>
                            <button
                              className="text-muted-foreground transition-colors hover:text-foreground"
                              title="Edit"
                              onClick={() => {
                                setEditingTrip(trip);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="text-muted-foreground transition-colors hover:text-destructive"
                              title="Remove"
                              onClick={() => archiveMutation.mutate(trip.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </MonthSection>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Saved places */}
      <Card className="overflow-hidden">
        <button
          className="flex w-full items-center justify-between border-l-4 border-slate-400 bg-slate-50/60 px-5 py-3 dark:bg-slate-800/40"
          onClick={() => setShowPlaces((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <p className="font-semibold">Saved places</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${showPlaces ? "rotate-180" : ""}`}
          />
        </button>
        {showPlaces && (
          <CardContent className="space-y-2 pt-3">
            {savedPlaces.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{p.label}</span>
                <button
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => deletePlaceMutation.mutate(p.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Home, Office, Client HQ"
                value={newPlaceLabel}
                onChange={(e) => setNewPlaceLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlaceLabel.trim()) {
                    addPlaceMutation.mutate(newPlaceLabel.trim());
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!newPlaceLabel.trim() || addPlaceMutation.isPending}
                onClick={() => addPlaceMutation.mutate(newPlaceLabel.trim())}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <TripDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editingTrip}
        savedPlaces={savedPlaces}
      />
    </div>
  );
}

// ── Overview section ──────────────────────────────────────────────────────────

interface BooksSummary {
  from: string;
  to: string;
  earnings_pence: number;
  expense_allowable_pence: number;
  mileage_pence: number;
  net_profit_pence: number;
  entry_count: number;
  expense_count: number;
  mileage_trip_count: number;
  overdue_count: number;
  overdue_pence: number;
  other_currency_earnings?: number;
  other_currency_expenses?: number;
  /** Which VAT treatment the figures use (see vatTreatmentNote) */
  vat_registered?: boolean;
  vat_scheme?: string | null;
  /** VAT for the same period, kept out of every figure above. Null when not VAT-registered. */
  vat?: {
    scheme: VatScheme;
    flat_rate_bp: number | null;
    output_pence: number;
    input_pence: number;
    net_pence: number;
    flat_rate_turnover_pence: number | null;
    paid_pence: number;
  } | null;
}

interface MonthlyRow {
  month: string;
  earnings_pence: number;
  expenses_pence: number;
  profit_pence: number;
}

interface TaxBand {
  label: string;
  ratePct: number;
  onPence: number;
  taxPence: number;
}

interface PaymentSchedule {
  poaApplies: boolean;
  januaryPence: number;
  julyPence: number;
  januaryDate: string;
  julyDate: string;
}

interface TaxEstimateData {
  taxYearLabel: string;
  ratesProvisionalFrom?: string | null;
  netProfitPence: number;
  adjustedPersonalAllowancePence: number;
  otherIncomePence: number;
  scotland: boolean;
  incomeTaxBands: TaxBand[];
  incomeTaxTotalPence: number;
  niBands: TaxBand[];
  niTotalPence: number;
  totalTaxPence: number;
  class2Voluntary?: { annualPence: number; weeklyPence: number; thresholdPence: number } | null;
  effectiveRatePct: number;
  paymentSchedule: PaymentSchedule;
  studentLoanRepayments: Array<{
    plan: string;
    planLabel: string;
    thresholdPence: number;
    ratePct: number;
    repaymentPence: number;
  }>;
  studentLoanTotalPence: number;
  pensionGrossPence: number;
  pensionTaxSavingPence: number;
  pensionExtraReliefPence: number;
  wfhAllowancePence: number;
  giftAidGrossPence: number;
  lossReliefPence: number;
  adjustedNetIncomePence: number;
  hicbcPence: number;
  marriageAllowancePenceDelta: number;
  totalDeductionsPence: number;
  vatRegistered: boolean;
  vatScheme: string | null;
  grossEarningsPence: number;
}

const DONUT_COLORS = [
  "#3B82F6",
  "#F59E0B",
  "#8B5CF6",
  "#10B981",
  "#EF4444",
  "#0EA5E9",
  "#F97316",
  "#6366F1",
];

function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

function PenceTick({ pence }: { pence: number }) {
  const v = pence / 100;
  if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(1)}k`;
  return `£${v.toFixed(0)}`;
}

// ── Set-aside calculator ──────────────────────────────────────────────────────

function SetAsideCard({ taxData }: { taxData: TaxEstimateData }) {
  const { januaryPence, januaryDate, julyPence, julyDate } = taxData.paymentSchedule;

  // Parse "31 Jan YYYY" → Date (noon UTC to avoid DST edge)
  const parseDeadline = (label: string): Date => {
    const [, mon, yr] = label.split(" ");
    const months: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    return new Date(Date.UTC(parseInt(yr, 10), months[mon] ?? 0, 31, 12));
  };

  const now = new Date();
  const janDeadline = parseDeadline(januaryDate);
  const julDeadline = julyPence > 0 ? parseDeadline(julyDate) : null;

  // Months remaining = whole months between today and deadline (min 1)
  const monthsTo = (deadline: Date): number =>
    Math.max(
      1,
      (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth())
    );

  const janMonths = monthsTo(janDeadline);
  const janMonthly = Math.ceil(januaryPence / janMonths);

  const isPast = janDeadline < now;

  return (
    <Card data-help="tax.paymentsOnAccount" className="overflow-hidden">
      <div className="border-l-4 border-sky-500 bg-sky-50/40 px-5 py-3 dark:bg-sky-950/20">
        <p className="font-semibold">Set aside each month</p>
        <p className="text-xs text-muted-foreground">
          How much to save now so the January bill doesn&apos;t sting
        </p>
      </div>
      <CardContent className="space-y-4 py-4">
        {isPast ? (
          <p className="text-sm text-muted-foreground">
            January deadline has passed. Update your figures for next year.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{januaryDate} payment</p>
                <p className="text-xs text-muted-foreground">
                  {janMonths} month{janMonths !== 1 ? "s" : ""} away
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
                  {formatPence(janMonthly)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  covers {formatPence(januaryPence)} bill
                </p>
              </div>
            </div>
            {julDeadline && julyPence > 0 && monthsTo(julDeadline) > 0 && (
              <div className="flex items-start justify-between gap-4 border-t pt-3">
                <div>
                  <p className="text-sm text-muted-foreground">{julyDate} payment on account</p>
                  <p className="text-xs text-muted-foreground">
                    {monthsTo(julDeadline)} month{monthsTo(julDeadline) !== 1 ? "s" : ""} away
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">
                    {formatPence(Math.ceil(julyPence / monthsTo(julDeadline)))}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground">covers {formatPence(julyPence)}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              These are monthly savings targets, not HMRC payment amounts. Figures are estimates —
              confirm the actual bill with your accountant before paying.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewSection({
  onShowOtherCurrency,
}: {
  onShowOtherCurrency?: (kind: "earnings" | "expenses") => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [otherIncomeInput, setOtherIncomeInput] = useState(() => {
    try {
      return localStorage.getItem("books_other_income") ?? "";
    } catch {
      return "";
    }
  });
  const [scotland, setScotland] = useState(() => {
    try {
      return localStorage.getItem("books_scotland") === "1";
    } catch {
      return false;
    }
  });
  const [studentLoanPlans, setStudentLoanPlans] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("books_student_loan_plans");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [wfhTier, setWfhTier] = useState<"low" | "mid" | "high" | null>(() => {
    try {
      const stored = localStorage.getItem("books_wfh_tier");
      if (stored === "low" || stored === "mid" || stored === "high") return stored;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [pensionInput, setPensionInput] = useState(() => {
    try {
      return localStorage.getItem("books_pension") ?? "";
    } catch {
      return "";
    }
  });
  const [giftAidInput, setGiftAidInput] = useState(() => {
    try {
      return localStorage.getItem("books_gift_aid") ?? "";
    } catch {
      return "";
    }
  });
  const [lossesInput, setLossesInput] = useState(() => {
    try {
      return localStorage.getItem("books_losses") ?? "";
    } catch {
      return "";
    }
  });
  const [childBenefitInput, setChildBenefitInput] = useState(() => {
    try {
      return localStorage.getItem("books_child_benefit") ?? "";
    } catch {
      return "";
    }
  });
  const [marriageAllowance, setMarriageAllowance] = useState<"giving" | "receiving" | null>(() => {
    try {
      const s = localStorage.getItem("books_marriage_allowance");
      if (s === "giving" || s === "receiving") return s;
    } catch {
      /* ignore */
    }
    return null;
  });

  const otherIncomePence = Math.max(0, Math.round(parseFloat(otherIncomeInput || "0") * 100));

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fire-and-forget on mount: promote stale invoiced entries to overdue
  useEffect(() => {
    fetch("/api/books/sync-overdue", { method: "POST", headers: authHeaders() })
      .then((r) => r.json())
      .then((d: { updated: number }) => {
        if (d.updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/books/summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
        }
      })
      .catch(() => {
        /* non-critical */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery<BooksSummary>({
    queryKey: ["/api/books/summary"],
    queryFn: () => fetch("/api/books/summary", { headers: authHeaders() }).then((r) => r.json()),
  });

  const { data: monthlyData } = useQuery<{ months: MonthlyRow[] }>({
    queryKey: ["/api/books/monthly"],
    queryFn: () => fetch("/api/books/monthly", { headers: authHeaders() }).then((r) => r.json()),
  });

  const { data: catData } = useQuery<{ name: string; pence: number }[]>({
    queryKey: ["/api/books/expense-categories"],
    queryFn: () =>
      fetch("/api/books/expense-categories", { headers: authHeaders() }).then((r) => r.json()),
  });

  type QuarterRow = {
    quarter: 1 | 2 | 3 | 4;
    label: string;
    from: string;
    to: string;
    earnings_pence: number;
    expenses_pence: number;
    profit_pence: number;
  };
  const { data: receiptCount } = useQuery<{ count: number }>({
    queryKey: ["/api/receipts/unattached/count"],
    queryFn: () =>
      fetch("/api/receipts/unattached/count", { headers: authHeaders() }).then((r) => r.json()),
  });
  const { data: quarterlyData } = useQuery<{ tax_year: string; quarters: QuarterRow[] }>({
    queryKey: ["/api/books/quarterly"],
    queryFn: () => fetch("/api/books/quarterly", { headers: authHeaders() }).then((r) => r.json()),
  });

  // Which MTD quarter is today in? (inline — no shared import needed)
  const todayIso = ukToday();
  const currentQuarter = (() => {
    const q = quarterlyData?.quarters.find((q) => todayIso >= q.from && todayIso <= q.to);
    return q?.quarter ?? null;
  })();

  const pensionGrossPence = Math.max(0, Math.round(parseFloat(pensionInput || "0") * 100));
  const taxQueryParams = new URLSearchParams();
  if (otherIncomePence > 0) taxQueryParams.set("other_income_pence", String(otherIncomePence));
  if (scotland) taxQueryParams.set("scotland", "1");
  for (const plan of studentLoanPlans) taxQueryParams.append("student_loan_plans", plan);
  if (pensionGrossPence > 0) taxQueryParams.set("pension_gross_pence", String(pensionGrossPence));
  if (wfhTier) taxQueryParams.set("wfh_tier", wfhTier);
  const giftAidNetPence = Math.max(0, Math.round(parseFloat(giftAidInput || "0") * 100));
  if (giftAidNetPence > 0) taxQueryParams.set("gift_aid_net_pence", String(giftAidNetPence));
  const lossesCarriedForwardPence = Math.max(0, Math.round(parseFloat(lossesInput || "0") * 100));
  if (lossesCarriedForwardPence > 0)
    taxQueryParams.set("losses_carried_forward_pence", String(lossesCarriedForwardPence));
  const childBenefitAnnualPence = Math.max(
    0,
    Math.round(parseFloat(childBenefitInput || "0") * 100)
  );
  if (childBenefitAnnualPence > 0)
    taxQueryParams.set("child_benefit_annual_pence", String(childBenefitAnnualPence));
  if (marriageAllowance) taxQueryParams.set("marriage_allowance", marriageAllowance);
  const taxQueryString = taxQueryParams.toString();

  const { data: taxData } = useQuery<TaxEstimateData>({
    queryKey: ["/api/books/tax-estimate", taxQueryString],
    queryFn: () =>
      fetch(`/api/books/tax-estimate${taxQueryString ? `?${taxQueryString}` : ""}`, {
        headers: authHeaders(),
      }).then((r) => r.json()),
  });

  function downloadWithAuth(url: string, setPending?: (v: boolean) => void) {
    setPending?.(true);
    fetch(url, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        const disposition = r.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="?([^";\n]+)"?/i);
        const filename = match?.[1] ?? "export";
        return r.blob().then((blob) => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(objUrl);
      })
      .catch((err: unknown) => {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Could not download the file.",
          variant: "destructive",
        });
      })
      .finally(() => setPending?.(false));
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-56 rounded-xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">Could not load summary.</p>
    );
  }

  const profitPositive = data.net_profit_pence >= 0;

  // Chart-ready monthly data
  const chartMonths = (monthlyData?.months ?? []).map((r) => ({
    name: fmtMonth(r.month),
    Earnings: r.earnings_pence / 100,
    Expenses: r.expenses_pence / 100,
    Profit: r.profit_pence / 100,
  }));

  // Top expense categories for donut (max 6 + "Other")
  const rawCats = catData ?? [];
  const topCats = rawCats.slice(0, 6);
  const otherPence = rawCats.slice(6).reduce((s, c) => s + c.pence, 0);
  const donutData =
    topCats.length === 0
      ? []
      : [
          ...topCats.map((c) => ({ name: c.name, value: c.pence / 100 })),
          ...(otherPence > 0 ? [{ name: "Other", value: otherPence / 100 }] : []),
        ];

  const totalExpenses = data.expense_allowable_pence + data.mileage_pence;

  return (
    <div className="space-y-4">
      {/* ── Period label ── */}
      <p
        data-help="tax.cashBasis"
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {fmtDate(data.from)} – {fmtDate(data.to)} · cash basis
      </p>
      {vatTreatmentNote(data) && (
        <p className="-mt-3 text-xs text-muted-foreground">{vatTreatmentNote(data)}</p>
      )}

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Earnings
          </p>
          <p className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
            {formatPence(data.earnings_pence)}
          </p>
          <p className="mt-0.5 text-xs text-blue-500">
            {data.entry_count} {data.entry_count === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Expenses
          </p>
          <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {formatPence(totalExpenses)}
          </p>
          <p className="mt-0.5 text-xs text-amber-500">
            {data.expense_count} {data.expense_count === 1 ? "expense" : "expenses"} +{" "}
            {data.mileage_trip_count} trips
          </p>
        </div>
        <div
          className={`rounded-xl p-4 ${profitPositive ? "bg-green-50 dark:bg-green-950/40" : "bg-red-50 dark:bg-red-950/40"}`}
        >
          <p
            className={`mb-1 text-xs font-semibold uppercase tracking-wide ${profitPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            Net profit
          </p>
          <p
            className={`text-xl font-bold tabular-nums ${profitPositive ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
          >
            {formatPence(data.net_profit_pence)}
          </p>
          <p className={`mt-0.5 text-xs ${profitPositive ? "text-green-500" : "text-red-400"}`}>
            after deductions
          </p>
        </div>
        {taxData && (
          <div className="rounded-xl bg-slate-800 p-4 dark:bg-slate-900">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-400">
              {taxData.studentLoanTotalPence > 0 ? "Est. tax, NI & loan" : "Est. tax & NI"}
            </p>
            <p className="text-xl font-bold tabular-nums text-red-300">
              {formatPence(taxData.totalDeductionsPence)}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Take-home ~{formatPence(taxData.netProfitPence - taxData.totalDeductionsPence)}
            </p>
            {taxData.scotland && <p className="mt-0.5 text-xs text-blue-400">Scottish IT</p>}
            {taxData.adjustedPersonalAllowancePence < 1_257_000 && (
              <p data-help="tax.personalAllowance" className="mt-0.5 text-xs text-amber-400">
                PA tapered to {formatPence(taxData.adjustedPersonalAllowancePence)}
              </p>
            )}
            {taxData.studentLoanRepayments.map((r) => (
              <p key={r.plan} className="mt-0.5 text-xs text-purple-400">
                {r.planLabel}: {formatPence(r.repaymentPence)}
              </p>
            ))}
            {taxData.wfhAllowancePence > 0 && (
              <p className="mt-0.5 text-xs text-sky-400">
                WFH −{formatPence(taxData.wfhAllowancePence)} profit
              </p>
            )}
            {taxData.pensionGrossPence > 0 && (
              <p className="mt-0.5 text-xs text-emerald-400">
                Pension saves {formatPence(taxData.pensionTaxSavingPence)} IT
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Receipts waiting to be filed ── */}
      {(receiptCount?.count ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <strong>{receiptCount!.count}</strong> receipt{receiptCount!.count === 1 ? "" : "s"}{" "}
            waiting to be filed — find them in the Receipt inbox under Expenses.
          </span>
        </div>
      )}

      {/* ── Overdue alert ── */}
      {data && data.overdue_count > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {data.overdue_count} overdue {data.overdue_count === 1 ? "entry" : "entries"} —{" "}
              {formatPence(data.overdue_pence)} outstanding
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Payment deadline passed. Chase the client or mark as written off.
            </p>
          </div>
        </div>
      )}

      {/* ── Other currencies: left out of every total, and said so ── */}
      {data &&
        (data.other_currency_earnings ?? 0) + (data.other_currency_expenses ?? 0) > 0 &&
        (() => {
          const n = (data.other_currency_earnings ?? 0) + (data.other_currency_expenses ?? 0);
          const parts = [
            data.other_currency_earnings
              ? `${data.other_currency_earnings} ${data.other_currency_earnings === 1 ? "earning" : "earnings"}`
              : null,
            data.other_currency_expenses
              ? `${data.other_currency_expenses} ${data.other_currency_expenses === 1 ? "expense" : "expenses"}`
              : null,
          ].filter(Boolean);
          return (
            <div
              data-help="books.overview.otherCurrency"
              className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {n} {n === 1 ? "record" : "records"} in other currencies {n === 1 ? "is" : "are"}{" "}
                  not included ({parts.join(", ")})
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Totals and the tax estimate are in pounds. Record the sterling amount that reached
                  or left your bank, so these count.
                </p>
                {onShowOtherCurrency && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.other_currency_earnings ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-amber-300 text-xs text-amber-900 hover:bg-amber-100"
                        onClick={() => onShowOtherCurrency("earnings")}
                      >
                        Show the earnings
                      </Button>
                    )}
                    {(data.other_currency_expenses ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-amber-300 text-xs text-amber-900 hover:bg-amber-100"
                        onClick={() => onShowOtherCurrency("expenses")}
                      >
                        Show the expenses
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* ── P&L bar chart ── */}
      {chartMonths.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-l-4 border-blue-500 bg-blue-50/30 px-5 py-3 dark:bg-blue-950/20">
            <p className="font-semibold">Profit &amp; Loss — monthly</p>
            <p className="text-xs text-muted-foreground">Income vs deductions each month</p>
          </div>
          <CardContent className="px-2 pb-4 pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartMonths} barGap={2} barCategoryGap="28%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => PenceTick({ pence: v * 100 })}
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [`£${v.toFixed(2)}`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
                />
                <Bar dataKey="Earnings" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Profit" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Expense donut + breakdown ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {donutData.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-l-4 border-amber-400 bg-amber-50/30 px-5 py-3 dark:bg-amber-950/20">
              <p className="font-semibold">Expenses by category</p>
            </div>
            <CardContent className="flex items-center justify-center pb-4 pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [`£${v.toFixed(2)}`]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* P&L summary */}
        <Card className="overflow-hidden">
          <div className="border-l-4 border-green-500 bg-green-50/30 px-5 py-3 dark:bg-green-950/20">
            <p className="font-semibold">Summary</p>
          </div>
          <CardContent className="p-0">
            <div className="flex items-baseline justify-between border-l-4 border-blue-500 px-5 py-2.5">
              <p className="text-sm">Gross earnings</p>
              <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                {formatPence(data.earnings_pence)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-l-4 border-amber-400 px-5 py-2.5">
              <p className="text-sm">Allowable expenses</p>
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                −{formatPence(data.expense_allowable_pence)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-l-4 border-purple-400 px-5 py-2.5">
              <p className="text-sm">Mileage allowance</p>
              <span className="font-semibold tabular-nums text-purple-700 dark:text-purple-300">
                −{formatPence(data.mileage_pence)}
              </span>
            </div>
            <div
              className={`flex items-baseline justify-between border-l-4 px-5 py-3 ${profitPositive ? "border-green-500 bg-green-50/60 dark:bg-green-950/30" : "border-red-500 bg-red-50/60 dark:bg-red-950/30"}`}
            >
              <p className="font-bold">Net profit</p>
              <span
                className={`text-lg font-bold tabular-nums ${profitPositive ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
              >
                {formatPence(data.net_profit_pence)}
              </span>
            </div>
            {data.vat && (
              <>
                <div className="flex items-baseline justify-between border-l-4 border-sky-500 bg-sky-50/60 px-5 py-2.5 dark:bg-sky-950/30">
                  <p data-help="books.vat.summary" className="text-sm font-semibold">
                    VAT
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {VAT_SCHEME_LABELS[data.vat.scheme]}
                    {data.vat.scheme === "flat_rate" && data.vat.flat_rate_bp
                      ? ` · ${data.vat.flat_rate_bp / 100}%`
                      : ""}{" "}
                    · not in profit
                  </span>
                </div>
                {data.vat.scheme === "flat_rate" ? (
                  <div className="flex items-baseline justify-between border-l-4 border-sky-200 py-1.5 pl-9 pr-5 dark:border-sky-900">
                    <p className="text-xs text-muted-foreground">
                      Flat-rate VAT on {formatPence(data.vat.flat_rate_turnover_pence ?? 0)}{" "}
                      turnover
                    </p>
                    <span className="text-xs tabular-nums">
                      {formatPence(data.vat.output_pence)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between border-l-4 border-sky-200 py-1.5 pl-9 pr-5 dark:border-sky-900">
                      <p className="text-xs text-muted-foreground">VAT on sales</p>
                      <span className="text-xs tabular-nums">
                        {formatPence(data.vat.output_pence)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-l-4 border-sky-200 py-1.5 pl-9 pr-5 dark:border-sky-900">
                      <p className="text-xs text-muted-foreground">VAT reclaimable on expenses</p>
                      <span className="text-xs tabular-nums">
                        −{formatPence(data.vat.input_pence)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between border-l-4 border-sky-500 px-5 py-2.5">
                  <p className="text-sm">
                    {data.vat.net_pence >= 0 ? "VAT owed to HMRC" : "VAT repayment due"}
                  </p>
                  <span className="font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                    {formatPence(Math.abs(data.vat.net_pence))}
                  </span>
                </div>
                {data.vat.paid_pence !== 0 && (
                  <div className="flex items-baseline justify-between border-l-4 border-sky-200 py-1.5 pl-9 pr-5 dark:border-sky-900">
                    <p className="text-xs text-muted-foreground">
                      {data.vat.paid_pence > 0 ? "Paid to HMRC so far" : "Repaid by HMRC so far"}
                    </p>
                    <span className="text-xs tabular-nums">
                      {formatPence(Math.abs(data.vat.paid_pence))}
                    </span>
                  </div>
                )}
              </>
            )}
            {taxData && (
              <>
                {taxData.ratesProvisionalFrom && (
                  <p className="bg-amber-50 px-5 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {taxData.taxYearLabel} rates aren&apos;t in EventLink yet, so this uses{" "}
                    {taxData.ratesProvisionalFrom} rates. Treat it as a rough guide until they are.
                  </p>
                )}
                <div className="flex items-baseline justify-between bg-slate-50 px-5 py-2.5 dark:bg-slate-900/40">
                  <p data-help="tax.estimate" className="text-sm text-muted-foreground">
                    Est. tax &amp; NI ({taxData.effectiveRatePct}%)
                  </p>
                  <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                    −{formatPence(taxData.totalTaxPence)}
                  </span>
                </div>
                {/* What the estimate is made of: Income Tax and Class 4 NI */}
                <div className="flex items-baseline justify-between bg-slate-50/60 py-1.5 pl-9 pr-5 dark:bg-slate-900/20">
                  <p className="text-xs text-muted-foreground">Income Tax</p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatPence(taxData.incomeTaxTotalPence)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between bg-slate-50/60 py-1.5 pl-9 pr-5 dark:bg-slate-900/20">
                  <p data-help="tax.class4" className="text-xs text-muted-foreground">
                    Class 4 National Insurance
                  </p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatPence(taxData.niTotalPence)}
                  </span>
                </div>
                {taxData.class2Voluntary && (
                  <div className="bg-sky-50 px-5 py-2.5 dark:bg-sky-950/30">
                    <p
                      data-help="tax.class2"
                      className="text-sm font-medium text-sky-900 dark:text-sky-200"
                    >
                      Class 2 National Insurance — optional this year
                    </p>
                    <p className="text-xs text-sky-800 dark:text-sky-300">
                      Your profit is below {formatPence(taxData.class2Voluntary.thresholdPence)}, so
                      this year won&apos;t count towards your State Pension unless you pay voluntary
                      Class 2: about {formatPence(taxData.class2Voluntary.annualPence)} for the year
                      ({formatPence(taxData.class2Voluntary.weeklyPence)} a week). It is not
                      included in the estimate above.
                    </p>
                  </div>
                )}
                {taxData.studentLoanRepayments.map((r) => (
                  <div
                    key={r.plan}
                    className="flex items-baseline justify-between bg-purple-50 px-5 py-2.5 dark:bg-purple-950/30"
                  >
                    <p className="text-sm text-muted-foreground">
                      {r.planLabel} ({r.ratePct}% above {formatPence(r.thresholdPence)})
                    </p>
                    <span className="font-semibold tabular-nums text-purple-700 dark:text-purple-400">
                      −{formatPence(r.repaymentPence)}
                    </span>
                  </div>
                ))}
                {taxData.wfhAllowancePence > 0 && (
                  <div className="flex items-baseline justify-between bg-sky-50 px-5 py-2.5 dark:bg-sky-950/30">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        WFH flat rate ({wfhTier} tier)
                      </p>
                      <p className="text-xs text-muted-foreground">Reduces IT and NI</p>
                    </div>
                    <span className="font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                      −{formatPence(taxData.wfhAllowancePence)}
                    </span>
                  </div>
                )}
                {taxData.pensionGrossPence > 0 && (
                  <div className="flex items-baseline justify-between bg-emerald-50 px-5 py-2.5 dark:bg-emerald-950/30">
                    <div>
                      <p data-help="tax.pension" className="text-sm text-muted-foreground">
                        Pension contribution (gross {formatPence(taxData.pensionGrossPence)})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPence(
                          taxData.pensionTaxSavingPence - taxData.pensionExtraReliefPence
                        )}{" "}
                        added to your pot by the provider
                        {taxData.pensionExtraReliefPence > 0
                          ? `, ${formatPence(taxData.pensionExtraReliefPence)} off this bill`
                          : ""}{" "}
                        — NI unchanged
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      saves {formatPence(taxData.pensionTaxSavingPence)}
                    </span>
                  </div>
                )}
                {taxData.giftAidGrossPence > 0 && (
                  <div className="flex items-baseline justify-between bg-emerald-50 px-5 py-2.5 dark:bg-emerald-950/30">
                    <div>
                      <p data-help="tax.giftAid" className="text-sm text-muted-foreground">
                        Gift Aid (gross {formatPence(taxData.giftAidGrossPence)})
                      </p>
                      <p className="text-xs text-muted-foreground">Extends basic rate band</p>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      band extended
                    </span>
                  </div>
                )}
                {taxData.lossReliefPence > 0 && (
                  <div className="flex items-baseline justify-between bg-amber-50 px-5 py-2.5 dark:bg-amber-950/30">
                    <div>
                      <p data-help="tax.losses" className="text-sm text-muted-foreground">
                        Losses carried forward
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reduces Income Tax, NI and student loan
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      −{formatPence(taxData.lossReliefPence)}
                    </span>
                  </div>
                )}
                {taxData.marriageAllowancePenceDelta !== 0 && (
                  <div className="flex items-baseline justify-between bg-rose-50 px-5 py-2.5 dark:bg-rose-950/30">
                    <div>
                      <p
                        data-help="tax.marriageAllowance"
                        className="text-sm text-muted-foreground"
                      >
                        Marriage Allowance (
                        {marriageAllowance === "receiving" ? "receiving" : "giving"})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {marriageAllowance === "receiving"
                          ? "£252 tax reducer applied"
                          : "PA reduced by £1,260"}
                      </p>
                    </div>
                    <span
                      className={`font-semibold tabular-nums ${taxData.marriageAllowancePenceDelta < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {taxData.marriageAllowancePenceDelta < 0 ? "saves " : "+"}
                      {formatPence(Math.abs(taxData.marriageAllowancePenceDelta))}
                    </span>
                  </div>
                )}
                {taxData.hicbcPence > 0 && (
                  <div className="flex items-baseline justify-between bg-red-50 px-5 py-2.5 dark:bg-red-950/30">
                    <div>
                      <p data-help="tax.hicbc" className="text-sm text-muted-foreground">
                        High Income Child Benefit Charge
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Adjusted net income {formatPence(taxData.adjustedNetIncomePence)} · 1% per
                        £200 above £60,000
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                      +{formatPence(taxData.hicbcPence)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between bg-green-50 px-5 py-3 dark:bg-green-950/30">
                  <p className="font-semibold">Est. take-home</p>
                  <span className="text-lg font-bold tabular-nums text-green-700 dark:text-green-300">
                    {formatPence(taxData.netProfitPence - taxData.totalDeductionsPence)}
                  </span>
                </div>
                {taxData.totalTaxPence > 0 && (
                  <>
                    <div className="border-t px-5 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        When you pay
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between px-5 py-2.5">
                      <div>
                        <p className="text-sm">{taxData.paymentSchedule.januaryDate}</p>
                        <p className="text-xs text-muted-foreground">
                          {taxData.paymentSchedule.poaApplies
                            ? "Balancing payment + 1st payment on account"
                            : "Full year"}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {formatPence(taxData.paymentSchedule.januaryPence)}
                      </span>
                    </div>
                    {taxData.paymentSchedule.poaApplies && (
                      <div className="flex items-baseline justify-between px-5 py-2.5">
                        <div>
                          <p className="text-sm">{taxData.paymentSchedule.julyDate}</p>
                          <p className="text-xs text-muted-foreground">2nd payment on account</p>
                        </div>
                        <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                          {formatPence(taxData.paymentSchedule.julyPence)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Set-aside calculator ── */}
      {taxData && taxData.paymentSchedule.januaryPence > 0 && <SetAsideCard taxData={taxData} />}

      {/* ── Your business: who you are, used on invoices and the workbook ── */}
      <BusinessDetailsCard />

      {/* ── Tax settings ── */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-slate-500 bg-slate-50/50 px-5 py-3 dark:bg-slate-900/40">
          <p className="font-semibold">Tax estimate settings</p>
          <p className="text-xs text-muted-foreground">
            Figures are estimates — always check with your accountant.
          </p>
        </div>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-3">
            <label
              htmlFor="books-label-data-3449"
              data-help="tax.estimate.otherIncome"
              className="w-48 shrink-0 text-sm text-muted-foreground"
            >
              Other income this year
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                £
              </span>
              <input
                id="books-label-data-3449"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={otherIncomeInput}
                onChange={(e) => {
                  setOtherIncomeInput(e.target.value);
                  try {
                    localStorage.setItem("books_other_income", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-32 rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground">salary, pension, rental, etc.</p>
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="books-scottish-taxpayer-3479"
              data-help="tax.scotland"
              className="w-48 shrink-0 text-sm text-muted-foreground"
            >
              Scottish taxpayer
            </label>
            <input
              id="books-scottish-taxpayer-3479"
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={scotland}
              onChange={(e) => {
                setScotland(e.target.checked);
                try {
                  localStorage.setItem("books_scotland", e.target.checked ? "1" : "0");
                } catch {
                  /* ignore */
                }
              }}
            />
            <p className="text-xs text-muted-foreground">uses Scottish Income Tax rates</p>
          </div>
          <div className="space-y-1.5">
            <p data-help="tax.studentLoan" className="text-sm text-muted-foreground">
              Student loan plan(s)
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "plan1", label: "Plan 1" },
                  { value: "plan2", label: "Plan 2" },
                  { value: "plan4", label: "Plan 4 (Scotland)" },
                  { value: "plan5", label: "Plan 5" },
                  { value: "postgrad", label: "Postgraduate" },
                ] as const
              ).map(({ value, label }) => {
                const active = studentLoanPlans.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? studentLoanPlans.filter((p) => p !== value)
                        : [...studentLoanPlans, value];
                      setStudentLoanPlans(next);
                      try {
                        localStorage.setItem("books_student_loan_plans", JSON.stringify(next));
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-purple-600 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-purple-400"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Select any plans you repay — deducted from take-home
            </p>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="books-pension-contributions-3543"
              className="text-sm text-muted-foreground"
            >
              Pension contributions (£/year gross)
            </label>
            <div className="relative w-40">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                £
              </span>
              <input
                id="books-pension-contributions-3543"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={pensionInput}
                onChange={(e) => {
                  setPensionInput(e.target.value);
                  try {
                    localStorage.setItem("books_pension", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-full rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Personal pension or SIPP: what you paid plus the 25% top-up. Leave out a workplace
              pension taken from your salary.
            </p>
          </div>
          <div className="space-y-1.5">
            <p
              id="wfh-label"
              data-help="tax.workingFromHome"
              className="text-sm text-muted-foreground"
            >
              Working from home (HMRC flat rate)
            </p>
            <div className="flex gap-2" role="group" aria-labelledby="wfh-label">
              {(
                [
                  { value: "low", label: "25–50 h/mo", detail: "£10/mo" },
                  { value: "mid", label: "51–100 h/mo", detail: "£18/mo" },
                  { value: "high", label: "101+ h/mo", detail: "£26/mo" },
                ] as const
              ).map(({ value, label, detail }) => {
                const active = wfhTier === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      const next = active ? null : value;
                      setWfhTier(next);
                      try {
                        if (next) localStorage.setItem("books_wfh_tier", next);
                        else localStorage.removeItem("books_wfh_tier");
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-sky-500 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" : "border-border text-muted-foreground hover:border-sky-400"}`}
                  >
                    {label} <span className="font-normal opacity-70">{detail}</span>
                  </button>
                );
              })}
            </div>
            <p data-help="tax.mileage" className="text-xs text-muted-foreground">
              Reduces profit for both IT and NI · simplified expenses (SA103F)
            </p>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="books-gift-aid-donations-3609"
              className="text-sm text-muted-foreground"
            >
              Gift Aid donations (£/year net)
            </label>
            <div className="relative w-40">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                £
              </span>
              <input
                id="books-gift-aid-donations-3609"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={giftAidInput}
                onChange={(e) => {
                  setGiftAidInput(e.target.value);
                  try {
                    localStorage.setItem("books_gift_aid", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-full rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Extends basic rate band and reduces adjusted net income · grossed up at 20%
            </p>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="books-losses-carried-forward-3636"
              className="text-sm text-muted-foreground"
            >
              Losses carried forward (£)
            </label>
            <div className="relative w-40">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                £
              </span>
              <input
                id="books-losses-carried-forward-3636"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={lossesInput}
                onChange={(e) => {
                  setLossesInput(e.target.value);
                  try {
                    localStorage.setItem("books_losses", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-full rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Unused trading losses from earlier years — offsets IT only, not NI
            </p>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="books-child-benefit-received-3663"
              className="text-sm text-muted-foreground"
            >
              Child Benefit received (£/year)
            </label>
            <div className="relative w-40">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                £
              </span>
              <input
                id="books-child-benefit-received-3663"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={childBenefitInput}
                onChange={(e) => {
                  setChildBenefitInput(e.target.value);
                  try {
                    localStorage.setItem("books_child_benefit", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-full rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm tabular-nums"
              />
            </div>
            <p data-help="tax.estimate.adjustedNetIncome" className="text-xs text-muted-foreground">
              High Income Child Benefit Charge applies if adjusted net income exceeds £60,000
            </p>
          </div>
          <div className="space-y-1.5">
            <p id="marriage-allowance-label" className="text-sm text-muted-foreground">
              Marriage Allowance
            </p>
            <div className="flex gap-2" role="group" aria-labelledby="marriage-allowance-label">
              {(
                [
                  {
                    value: "giving" as const,
                    label: "I'm the lower earner",
                    detail: "giving £1,260",
                  },
                  {
                    value: "receiving" as const,
                    label: "I'm the higher earner",
                    detail: "receiving £252",
                  },
                ] as const
              ).map(({ value, label, detail }) => {
                const active = marriageAllowance === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      const next = active ? null : value;
                      setMarriageAllowance(next);
                      try {
                        if (next) localStorage.setItem("books_marriage_allowance", next);
                        else localStorage.removeItem("books_marriage_allowance");
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "border-border text-muted-foreground hover:border-rose-300"}`}
                  >
                    {label} <span className="font-normal opacity-70">{detail}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Transfer £1,260 of personal allowance between spouses/civil partners
            </p>
          </div>
          {taxData?.vatRegistered && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {taxData.vatScheme === "flat_rate" ? (
                <>
                  You are on the VAT Flat Rate Scheme. Expenses count including VAT, as you
                  can&apos;t reclaim it. Earnings exclude the VAT you charge, so the difference
                  between that and the flat-rate VAT you pay (which is taxable income) isn&apos;t in
                  this estimate: ask your accountant to add it.
                </>
              ) : (
                <>
                  You are VAT registered, so this estimate excludes VAT on both sides: earnings net
                  of the VAT you charge, expenses net of the VAT you reclaim. Enter any earnings
                  logged by hand ex-VAT, and the VAT on each receipt.
                </>
              )}
            </p>
          )}
          {taxData && taxData.grossEarningsPence <= 100_000 && taxData.grossEarningsPence > 0 && (
            <p className="text-xs text-muted-foreground">
              Trading income is under £1,000 — you may be able to use the{" "}
              <span className="font-medium">Trading Allowance</span> instead of claiming actual
              expenses, making the profit from this source £0.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Quarterly breakdown ── */}
      {quarterlyData && (
        <Card className="overflow-hidden">
          <div className="border-l-4 border-indigo-500 bg-indigo-50/50 px-5 py-3 dark:bg-indigo-950/20">
            <p data-help="tax.quarters" className="font-semibold">
              MTD quarters — {quarterlyData.tax_year}
            </p>
            <p data-help="tax.mtd" className="text-xs text-muted-foreground">
              Making Tax Digital quarters · cash basis
            </p>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left">Quarter</th>
                  <th className="px-4 py-2 text-right">Earnings</th>
                  <th className="px-4 py-2 text-right">Expenses</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyData.quarters.map((q) => {
                  const isCurrent = q.quarter === currentQuarter;
                  const profitPos = q.profit_pence >= 0;
                  return (
                    <tr
                      key={q.quarter}
                      className={`border-b last:border-0 ${isCurrent ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{q.label}</span>
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                            current
                          </span>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {fmtDate(q.from)} – {fmtDate(q.to)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-300">
                        {formatPence(q.earnings_pence)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-300">
                        {formatPence(q.expenses_pence)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${profitPos ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400"}`}
                      >
                        {formatPence(q.profit_pence)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── VAT return (VAT-registered only; renders nothing otherwise) ── */}
      <VatReturnCard />

      {/* ── Year-end pack ── */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-orange-400 bg-orange-50/50 px-5 py-3 dark:bg-orange-950/20">
          <p className="font-semibold">Your records</p>
          <p className="text-xs text-muted-foreground">
            Download everything for your accountant or Self Assessment.
          </p>
        </div>
        <CardContent className="py-3">
          <Button
            data-help="books.export.workbook"
            size="sm"
            disabled={downloading}
            onClick={() => downloadWithAuth("/api/books/export.xlsx", setDownloading)}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            {downloading ? "Building…" : "Download Excel workbook"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Top-level tabs ─────────────────────────────────────────────────────────────

const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ["confirmed", "briefed", "completed"];

type UnloggedBooking = {
  id: number;
  job_id?: number;
  recruiter_id?: number;
  job_title: string;
  company_name?: string;
  event_date?: string;
  rate?: string;
  location?: string;
  status?: BookingStatus;
  earnings_entry_id?: number | null;
  entry_gross_pence?: number | null;
};

export interface HiredBookingForCalendar {
  bookingId: number;
  jobId: number;
  jobTitle: string;
  agreedRate: string | null;
  employerName: string | null;
  companyName: string | null;
}

export function BooksTab() {
  const initialSection = (() => {
    const p = new URLSearchParams(window.location.search).get("section");
    const valid = [
      "overview",
      "earnings",
      "expenses",
      "mileage",
      "time",
      "kit",
      "calendar",
      "invoices",
      "clients",
      "import",
    ];
    if (valid.includes(p ?? "")) return p as (typeof valid)[number];
    try {
      const saved = sessionStorage.getItem("booksTab.section");
      if (saved && valid.includes(saved)) return saved as (typeof valid)[number];
    } catch {
      /* sessionStorage unavailable */
    }
    return "overview" as (typeof valid)[number];
  })() as
    | "overview"
    | "earnings"
    | "expenses"
    | "mileage"
    | "time"
    | "kit"
    | "calendar"
    | "invoices"
    | "clients"
    | "import";

  const [section, setSectionRaw] = useState<
    | "overview"
    | "earnings"
    | "expenses"
    | "mileage"
    | "time"
    | "kit"
    | "calendar"
    | "invoices"
    | "clients"
    | "import"
  >(initialSection);
  const setSection = (s: typeof section) => {
    try {
      sessionStorage.setItem("booksTab.section", s);
    } catch {
      /* sessionStorage unavailable */
    }
    // Keep the section in the address so a refresh (F5) or bookmark returns here.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "books");
    url.searchParams.set("section", s);
    window.history.replaceState(window.history.state, "", url.toString());
    setSectionRaw(s);
  };
  useEffect(() => {
    manualStore.setSection(section);
  }, [section]);
  useEffect(() => () => manualStore.setSection(null), []);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EarningsEntry | null>(null);
  const [jobDetailEntryId, setJobDetailEntryId] = useState<number | null>(null);
  const [historyEntryId, setHistoryEntryId] = useState<number | null>(null);
  const [fromBooking, setFromBooking] = useState<UnloggedBooking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<UnloggedBooking | null>(null);
  const [statusEditEntry, setStatusEditEntry] = useState<EarningsEntry | null>(null);
  const [statusEditForm, setStatusEditForm] = useState({
    status: "paid",
    datePaid: "",
    amount: "",
  });
  const [expenseFromJobId, setExpenseFromJobId] = useState<number | null>(null);
  const [editExpenseId, setEditExpenseId] = useState<number | null>(null);
  const { data: editExpenseData } = useQuery<Expense>({
    queryKey: ["/api/expenses", editExpenseId],
    queryFn: () => apiRequest(`/api/expenses/${editExpenseId}`),
    enabled: editExpenseId !== null,
  });

  const { data: topLevelCategories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
    queryFn: () => apiRequest("/api/expense-categories"),
  });
  const { data: topLevelBillingProfile } = useQuery<{
    vat_registered?: boolean;
    vat_scheme?: string;
  } | null>({
    queryKey: ["/api/billing-profile"],
    queryFn: () => apiRequest("/api/billing-profile"),
  });
  const topLevelVatRegistered = Boolean(topLevelBillingProfile?.vat_registered);

  const { data: selectedBookingDocs = [] } = useQuery<
    { id: number; documentType: string; fileName: string; downloadUrl: string | null }[]
  >({
    queryKey: ["/api/job", selectedBooking?.job_id, "documents"],
    queryFn: () => apiRequest(`/api/job/${selectedBooking!.job_id}/documents`),
    enabled: !!selectedBooking?.job_id,
  });

  const initialPrefill = (() => {
    try {
      const raw = sessionStorage.getItem("invoicePrefill");
      if (raw && initialSection === "invoices") {
        sessionStorage.removeItem("invoicePrefill");
        return JSON.parse(raw) as InvoicePrefill;
      }
    } catch {
      // ignore malformed sessionStorage JSON
    }
    return undefined;
  })();

  const [invoicePrefill, setInvoicePrefill] = useState<InvoicePrefill | undefined>(initialPrefill);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ── Section collapse state (persisted per user in localStorage) ───────────────
  const uid = user?.id ?? "anon";
  const [jobsOpen, setJobsOpen] = useState(() => {
    try {
      return localStorage.getItem(`books-section-jobs-${uid}`) !== "0";
    } catch {
      return true;
    }
  });
  const [earningsOpen, setEarningsOpen] = useState(() => {
    try {
      return localStorage.getItem(`books-section-earnings-${uid}`) !== "0";
    } catch {
      return true;
    }
  });
  const toggleSection = (name: string, setter: (v: boolean) => void, cur: boolean) => {
    const next = !cur;
    setter(next);
    try {
      localStorage.setItem(`books-section-${name}-${uid}`, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // ── Earnings status filter + bulk-select state ───────────────────────────────
  const [earningsFilter, setEarningsFilter] = useState<string>("all");
  const [earningsOrigin, setEarningsOrigin] = useState<OriginFilter>("all");
  // Set by Overview's currency notice to open Expenses already filtered
  const [expensesCurrency, setExpensesCurrency] = useState("all");
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("paid");
  const [bulkDateMode, setBulkDateMode] = useState<
    "work_date" | "end_of_following_month" | "explicit"
  >("work_date");
  const [bulkExplicitDate, setBulkExplicitDate] = useState("");

  const { data, isLoading, isError } = useQuery<EarningsData>({
    queryKey: ["/api/earnings/summary"],
    queryFn: () => apiRequest("/api/earnings/summary"),
  });

  const { data: clients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/earnings/clients"],
  });

  const { data: hiredBookings = [] } = useFreelancerJobs();

  // Derive allBookings from hiredBookings — /api/bookings/freelancer now includes earnings_entry_id
  const allBookings: UnloggedBooking[] = hiredBookings
    .filter((hb) => ACTIVE_BOOKING_STATUSES.includes(hb.booking.status))
    .map((hb) => ({
      id: hb.booking.id,
      job_id: hb.booking.jobId,
      job_title: hb.job.title,
      company_name: hb.employer.companyName ?? undefined,
      // The job's own date, else the date on its earnings entry (jobs posted
      // without a date still get one there)
      event_date: hb.job.eventDate || hb.booking.entry_work_date || undefined,
      rate: hb.booking.agreedRate ?? undefined,
      status: hb.booking.status,
      earnings_entry_id: hb.booking.earnings_entry_id ?? undefined,
      entry_gross_pence: hb.booking.entry_gross_pence ?? null,
    }));

  // Lightweight invoice lookup by job/booking id
  // Fetch full job detail when a booking is selected (description, times, etc.)
  const selectedJobId = selectedBooking?.job_id ?? null;
  const { data: selectedJobDetail } = useQuery<{
    id: number;
    title: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    end_date?: string;
    created_at?: string;
  } | null>({
    queryKey: ["/api/jobs", selectedJobId],
    queryFn: () => (selectedJobId ? apiRequest(`/api/jobs/${selectedJobId}`) : null),
    enabled: !!selectedJobId,
  });

  const completeJobMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest(`/api/jobs/${jobId}/complete`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/jobs"] });
      toast({ title: "Job marked as completed" });
      setSelectedBooking(null);
      setSection("earnings");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to mark job as completed.",
        variant: "destructive",
      });
    },
  });

  const createInvoiceForJob = async (earningsEntryId: number) => {
    try {
      const [entry, otSummary, expensesData] = await Promise.all([
        apiRequest(`/api/earnings/${earningsEntryId}`),
        apiRequest(`/api/earnings/entries/${earningsEntryId}/time/summary`).catch(() => null),
        apiRequest(
          `/api/expenses?earnings_entry_id=${earningsEntryId}&billable_to_client=true&page=1`
        ).catch(() => null),
      ]);

      const lineItems: InvoicePrefillLineItem[] = [];

      // Base fee line
      lineItems.push({
        description: entry.description ?? "Services",
        rate_type: "flat",
        quantity: 1,
        unit_price_pence: entry.gross_amount_pence ?? 0,
      });

      // Overtime line (if any suggested)
      if (otSummary?.overtime_pence_suggested && otSummary.overtime_pence_suggested > 0) {
        const otHours = otSummary.overtime_hours_suggested ?? 0;
        lineItems.push({
          description: `Overtime (${otHours.toFixed(2)}h)`,
          rate_type: "flat",
          quantity: 1,
          unit_price_pence: otSummary.overtime_pence_suggested,
        });
      }

      // Billable expense lines
      const expenses: Array<{
        description: string;
        net_amount_pence: number;
        vat_amount_pence: number;
      }> = expensesData?.expenses ?? [];
      for (const exp of expenses) {
        lineItems.push({
          description: exp.description,
          rate_type: "flat",
          quantity: 1,
          // A registered freelancer rebills the net: the invoice adds VAT on
          // top, so billing the gross would charge the client VAT twice.
          unit_price_pence: expenseBase(
            { net_amount_pence: exp.net_amount_pence, vat_amount_pence: exp.vat_amount_pence ?? 0 },
            topLevelVatRegistered
          ),
        });
      }

      setInvoicePrefill({
        toName: entry.client_name ?? "",
        lineItems,
        issueDate: ukToday(),
        earningsEntryId: earningsEntryId,
      });
      setSection("invoices");
    } catch {
      toast({ title: "Could not build invoice", variant: "destructive" });
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Future work (or no date) that hasn't been marked completed — belongs in My Jobs.
  // A booking with status "completed" goes to Earnings even if its event_date is in the future
  // (e.g. the repair loop advanced the status before the event date arrived).
  const upcomingHired = allBookings.filter(
    (b) => b.status !== "completed" && (!b.event_date || new Date(b.event_date) >= today)
  );
  // Past work with no entry — edge case after backfill, but kept as a safety net
  const unloggedBookings = allBookings.filter(
    (b) => !b.earnings_entry_id && !!b.event_date && new Date(b.event_date) < today
  );
  // Past bookings with no entry yet — show "Log payment" in Earnings
  // Once an entry exists, the booking falls through to completedEntries (full display with amount)
  const awaitingPaymentHired = allBookings.filter(
    (b) => !b.earnings_entry_id && !!b.event_date && new Date(b.event_date) < today
  );

  // Auto-backfill: when past bookings have no entry, run repair once so they appear as entries
  const hasUnlogged = awaitingPaymentHired.length > 0;
  useEffect(() => {
    if (hasUnlogged && !backfillMutation.isPending) {
      backfillMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnlogged]);

  // Scheduled gigs (earnings_entries with work_status IS NOT NULL) — 3 months back, 12 ahead
  const gigsFrom = addMonths(ukToday(), -24);
  const gigsTo = addMonths(ukToday(), 12);
  const { data: scheduledJobs = [] } = useQuery<EarningsEntry[]>({
    queryKey: ["/api/earnings/gigs", gigsFrom, gigsTo],
    queryFn: () => apiRequest(`/api/earnings/gigs?from=${gigsFrom}&to=${gigsTo}`),
    enabled: !!user?.id,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/earnings/${id}/archive`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Entry removed" });
    },
    onError: () => toast({ title: "Failed to remove entry", variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: {
      ids: number[];
      status: string;
      date_mode: string;
      paid_date?: string;
    }) =>
      apiRequest("/api/earnings/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (result: {
      updated: number;
      skipped: number;
      message: string;
      before_snapshot: Array<{ id: number; status: string; paid_date: string | null }>;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      setSelectedEntryIds(new Set());
      const { before_snapshot } = result;
      toast({
        title: result.message,
        description:
          result.skipped > 0
            ? `${result.skipped} invoice-linked skipped`
            : "Undo available for 30s",
        action: (
          <button
            className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
            onClick={() => {
              Promise.all(
                before_snapshot.map((snap) =>
                  apiRequest(`/api/earnings/${snap.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: snap.status, paid_date: snap.paid_date }),
                  })
                )
              )
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
                  toast({ title: "Undone" });
                })
                .catch(() => toast({ title: "Undo failed", variant: "destructive" }));
            }}
          >
            Undo
          </button>
        ),
        duration: 30000,
      });
    },
    onError: () => toast({ title: "Bulk update failed", variant: "destructive" }),
  });

  const markReviewedMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiRequest("/api/earnings/bulk-review", { method: "PATCH", body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      setSelectedEntryIds(new Set());
      toast({ title: "Marked as reviewed" });
    },
    onError: () => toast({ title: "Failed to mark as reviewed", variant: "destructive" }),
  });

  const handleBulkApply = () => {
    const payload: { ids: number[]; status: string; date_mode: string; paid_date?: string } = {
      ids: Array.from(selectedEntryIds),
      status: bulkStatus,
      date_mode: bulkDateMode,
    };
    if (bulkStatus === "paid" && bulkDateMode === "explicit" && bulkExplicitDate) {
      payload.paid_date = bulkExplicitDate;
    }
    bulkMutation.mutate(payload);
  };

  const { data: entryHistory = [] } = useQuery<
    { id: number; action: string; summary: string; changed_at: string }[]
  >({
    queryKey: ["/api/earnings", historyEntryId, "history"],
    queryFn: () => apiRequest(`/api/earnings/${historyEntryId}/history`),
    enabled: historyEntryId !== null,
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("/api/earnings/repair-completed-jobs", { method: "POST" }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
      const parts: string[] = [];
      if (result.seeded > 0) parts.push(`${result.seeded} added`);
      if (result.advanced > 0) parts.push(`${result.advanced} advanced`);
      if (result.linked > 0) parts.push(`${result.linked} linked`);
      if (result.already_ok > 0) parts.push(`${result.already_ok} already up to date`);
      toast({
        title: "Repair complete",
        description: parts.length > 0 ? parts.join(", ") : "Nothing to repair.",
      });
    },
    onError: () => toast({ title: "Repair failed", variant: "destructive" }),
  });

  const repairFlagsMutation = useMutation({
    mutationFn: () => apiRequest("/api/earnings/repair-import-flags", { method: "POST" }),
    onSuccess: (result: { cleared: number; remaining: number; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Repair complete", description: result.message });
    },
    onError: () => toast({ title: "Repair failed", variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingEntry(null);
    setFromBooking(null);
    setJobDialogOpen(true);
  };
  const openEdit = (e: EarningsEntry) => {
    setEditingEntry(e);
    setFromBooking(null);
    setJobDialogOpen(true);
  };
  // A booking with an earnings entry opens on its job detail, like every other job.
  const openBooking = (b: UnloggedBooking) => {
    if (b.earnings_entry_id) setJobDetailEntryId(b.earnings_entry_id);
    else setSelectedBooking(b);
  };
  const openFromBooking = (b: UnloggedBooking) => {
    setEditingEntry(null);
    setFromBooking(b);
    setJobDialogOpen(true);
  };
  const statusEditMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiRequest(`/api/earnings/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusEditForm.status,
          ...(statusEditForm.status === "paid"
            ? {
                paid_date: statusEditForm.datePaid,
                paid_amount_pence: Math.round(parseFloat(statusEditForm.amount) * 100),
              }
            : statusEditForm.status === "expected"
              ? { paid_date: null, paid_amount_pence: null }
              : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Status updated" });
      setStatusEditEntry(null);
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const openStatusEdit = (entry: EarningsEntry) => {
    const derivedStatus =
      entry.status === "paid"
        ? "paid"
        : entry.status === "overdue"
          ? "overdue"
          : entry.invoice_id || entry.status === "invoiced"
            ? "invoiced"
            : "expected";
    setStatusEditForm({
      status: derivedStatus,
      datePaid: entry.paid_date ?? ukToday(),
      amount:
        entry.paid_amount_pence != null
          ? (entry.paid_amount_pence / 100).toFixed(2)
          : entry.gross_amount_pence != null
            ? (entry.gross_amount_pence / 100).toFixed(2)
            : "",
    });
    setStatusEditEntry(entry);
  };

  const bookingDetailDialog = selectedBooking && (
    <Dialog
      open={!!selectedBooking}
      onOpenChange={(o) => {
        if (!o) setSelectedBooking(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl font-bold leading-snug">
            {selectedBooking.job_title}
          </DialogTitle>
        </DialogHeader>

        {/* 2-col grid matching employer job popup */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {selectedBooking.company_name && (
            <div>
              <p className="text-muted-foreground">Company</p>
              <p className="font-medium">{selectedBooking.company_name}</p>
            </div>
          )}
          {selectedBooking.location && (
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{selectedBooking.location}</p>
            </div>
          )}
          {(() => {
            const raw =
              hiredBookings.find((hb) => hb.booking.jobId === selectedBooking.job_id)?.booking
                .agreedRate ?? selectedBooking.rate;
            if (!raw) return null;
            const rate = /^\d/.test(raw.trim()) ? `£${raw.trim()}` : raw.trim();
            return (
              <div>
                <p className="text-muted-foreground">Rate</p>
                <p className="font-medium tabular-nums">{rate}</p>
              </div>
            );
          })()}
          <div>
            <p className="text-muted-foreground">Status</p>
            {(() => {
              const s = (selectedBooking.status ?? "confirmed").toLowerCase();
              const color =
                s === "confirmed" || s === "briefed"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : s === "completed"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : s === "enquired"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-muted text-muted-foreground";
              return (
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${color}`}
                >
                  {s}
                </span>
              );
            })()}
          </div>
          {selectedBooking.event_date && (
            <div>
              <p className="text-muted-foreground">Event Date</p>
              <p className="font-medium">
                {fmtDate(selectedBooking.event_date)}
                {selectedJobDetail?.end_date ? ` – ${fmtDate(selectedJobDetail.end_date)}` : ""}
              </p>
            </div>
          )}
          {selectedJobDetail?.start_time && (
            <div>
              <p className="text-muted-foreground">Time</p>
              <p className="font-medium">
                {selectedJobDetail.start_time}
                {selectedJobDetail.end_time ? ` – ${selectedJobDetail.end_time}` : ""}
              </p>
            </div>
          )}
          {selectedJobDetail?.created_at && (
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {new Date(selectedJobDetail.created_at).toLocaleDateString("en-GB")}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        {selectedJobDetail?.description && (
          <div className="text-sm">
            <p className="mb-1 text-muted-foreground">Description</p>
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">
              {selectedJobDetail.description}
            </p>
          </div>
        )}

        {/* Documents */}
        {selectedBookingDocs.length > 0 && (
          <div className="text-sm">
            <p className="mb-1.5 font-medium text-muted-foreground">Documents</p>
            <div className="divide-y rounded-md border">
              {selectedBookingDocs.map((d) => (
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
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {selectedBooking.job_id && selectedBooking.status !== "completed" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  Mark as complete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark job as completed</AlertDialogTitle>
                  <AlertDialogDescription>
                    This marks &quot;{selectedBooking.job_title}&quot; as completed. The employer
                    will be notified. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => completeJobMutation.mutate(selectedBooking.job_id!)}
                  >
                    Mark complete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const statusEditDialog = statusEditEntry && (
    <Dialog open onOpenChange={() => setStatusEditEntry(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invoice status</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {statusEditEntry.description}
            {statusEditEntry.work_date ? ` · ${fmtDate(statusEditEntry.work_date)}` : ""}
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="books-status-4553">Status</Label>
            <Select
              value={statusEditForm.status}
              onValueChange={(v) => setStatusEditForm((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger id="books-status-4553">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expected">Not invoiced</SelectItem>
                <SelectItem value="invoiced">Invoice sent</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {statusEditForm.status === "paid" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="books-amount-received-4572">Amount received (£) *</Label>
                <Input
                  id="books-amount-received-4572"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={statusEditForm.amount}
                  onChange={(e) => setStatusEditForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="books-date-paid-4583">Date paid *</Label>
                <Input
                  id="books-date-paid-4583"
                  type="date"
                  value={statusEditForm.datePaid}
                  onChange={(e) => setStatusEditForm((f) => ({ ...f, datePaid: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setStatusEditEntry(null)}>
            Cancel
          </Button>
          <Button
            disabled={
              statusEditMutation.isPending ||
              (statusEditForm.status === "paid" &&
                (!statusEditForm.datePaid || !(parseFloat(statusEditForm.amount) > 0)))
            }
            onClick={() => statusEditMutation.mutate(statusEditEntry.id)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const sectionSwitcher = (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-md border p-1 [&::-webkit-scrollbar]:hidden">
        <button
          data-help="books.section.overview"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("overview")}
        >
          Overview
        </button>
        <button
          data-help="books.section.earnings"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "earnings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("earnings")}
        >
          Earnings
        </button>
        <button
          data-help="books.section.expenses"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "expenses" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("expenses")}
        >
          Expenses
        </button>
        <button
          data-help="books.section.mileage"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "mileage" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("mileage")}
        >
          Mileage
        </button>
        <button
          data-help="books.section.time"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "time" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("time")}
        >
          Time
        </button>
        <button
          data-help="books.section.kit"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "kit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("kit")}
        >
          Kit register
        </button>
        <button
          data-help="books.section.calendar"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("calendar")}
        >
          Calendar
        </button>
        <button
          data-help="books.section.invoices"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "invoices" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("invoices")}
        >
          Invoices
        </button>
        <button
          data-help="books.section.clients"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "clients" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("clients")}
        >
          Clients
        </button>
        <button
          data-help="books.section.import"
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "import" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setSection("import")}
        >
          Import
        </button>
      </div>
      <ManualToggle />
    </div>
  );

  if (section === "overview") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <OverviewSection
          onShowOtherCurrency={(kind) => {
            if (kind === "earnings") {
              setEarningsFilter("other_currency");
              setSection("earnings");
            } else {
              setExpensesCurrency("other");
              setSection("expenses");
            }
          }}
        />
      </div>
    );
  }

  if (section === "expenses") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <ExpensesSection key={expensesCurrency} initialCurrency={expensesCurrency} />
      </div>
    );
  }

  if (section === "mileage") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <MileageSection />
      </div>
    );
  }

  if (section === "time") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <TimeSection />
      </div>
    );
  }

  if (section === "kit") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <KitTab />
      </div>
    );
  }

  // Job detail and the dialogs it opens — rendered by every section that lists jobs.
  const jobDialogs = (
    <>
      <JobDialog
        open={jobDialogOpen}
        onClose={() => {
          setJobDialogOpen(false);
          setFromBooking(null);
        }}
        editing={editingEntry}
        clients={clients}
        prefill={
          fromBooking
            ? {
                description: fromBooking.job_title ?? "",
                client_name: fromBooking.company_name ?? "",
                work_date: fromBooking.event_date?.slice(0, 10) ?? "",
                status: "paid",
                paid_date: ukToday(),
              }
            : undefined
        }
        jobApplicationId={fromBooking?.id}
      />

      {jobDetailEntryId !== null && (
        <JobDetailDialog
          earningsEntryId={jobDetailEntryId}
          onClose={() => setJobDetailEntryId(null)}
          onInvoice={() => {
            setJobDetailEntryId(null);
            createInvoiceForJob(jobDetailEntryId!);
          }}
          onOpenInvoice={(invoiceId) => {
            setJobDetailEntryId(null);
            setInvoicePrefill({ openInvoiceId: invoiceId });
            setSection("invoices");
          }}
          onEdit={(entryId) => {
            // `entries` is destructured below the section early-returns, so it is
            // uninitialised in the calendar view; read the query result instead.
            const entry = data?.entries.find((e) => e.id === entryId);
            if (entry) return openEdit(entry);
            // Calendar jobs can sit outside the loaded earnings range.
            apiRequest(`/api/earnings/${entryId}`)
              .then((e: EarningsEntry) => openEdit(e))
              .catch(() => toast({ title: "Could not open this job", variant: "destructive" }));
          }}
          onAddExpense={(entryId) => setExpenseFromJobId(entryId)}
          onEditExpense={(expenseId) => setEditExpenseId(expenseId)}
        />
      )}

      {expenseFromJobId !== null && (
        <ExpenseDialog
          open={true}
          onClose={() => setExpenseFromJobId(null)}
          editing={null}
          categories={topLevelCategories}
          vatRegistered={topLevelVatRegistered}
          prefill={{ job_id: String(expenseFromJobId) }}
        />
      )}

      {editExpenseId !== null && editExpenseData && (
        <ExpenseDialog
          open={true}
          onClose={() => setEditExpenseId(null)}
          editing={editExpenseData}
          categories={topLevelCategories}
          vatRegistered={topLevelVatRegistered}
        />
      )}
    </>
  );

  if (section === "calendar") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <CalendarTab onJobDetail={(entryId) => setJobDetailEntryId(entryId)} />
        {jobDialogs}
      </div>
    );
  }

  if (section === "clients") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <ClientsTab />
      </div>
    );
  }

  if (section === "import") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <ImportWizard />
        <StartAgainCard />
      </div>
    );
  }

  if (section === "invoices") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <InvoicesTab
          prefillBooking={invoicePrefill}
          key={
            invoicePrefill
              ? `prefill-${invoicePrefill.bookingId}-${invoicePrefill.issueDate}`
              : "invoices"
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border p-4">
            <div className="mb-2 h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Could not load earnings data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tax_year, summary, entries } = data;
  const netPence = summary.total_pence - summary.deductions_pence;

  return (
    <div className="space-y-6">
      {sectionSwitcher}

      {/* ── Section 1: This tax year ── */}
      <Card className="overflow-hidden">
        <div className="bg-blue-600 px-5 py-3 dark:bg-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-100" />
              <p className="font-semibold text-white">Tax year {tax_year.label}</p>
            </div>
            <span className="text-xs text-blue-200">
              {fmtDate(tax_year.from)} – {fmtDate(tax_year.to)} · cash basis
            </span>
          </div>
          {vatTreatmentNote(topLevelBillingProfile) && (
            <p className="mt-1 text-right text-xs text-blue-200">
              {vatTreatmentNote(topLevelBillingProfile)}
            </p>
          )}
        </div>
        <CardContent className="pt-4">
          {summary.entry_count === 0 ? (
            <div className="py-6 text-center">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No paid income recorded for this tax year yet.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/40">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                    Gross income
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {formatPence(summary.total_pence)}
                  </p>
                </div>
                {summary.deductions_pence > 0 && (
                  <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-950/40">
                    <p className="text-xs font-medium uppercase tracking-wide text-purple-500">
                      After deductions
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-purple-700 dark:text-purple-300">
                      {formatPence(netPence)}
                    </p>
                  </div>
                )}
                <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Jobs</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{summary.entry_count}</p>
                </div>
              </div>

              {/* Monthly breakdown */}
              {summary.groups.length > 0 && (
                <div className="overflow-hidden rounded-lg border">
                  {summary.groups
                    .slice()
                    .sort((a, b) => a.key.localeCompare(b.key))
                    .map((g, i) => (
                      <div
                        key={g.key}
                        className={`flex items-center justify-between px-3 py-2.5 text-sm ${i % 2 === 0 ? "bg-muted/40" : ""}`}
                      >
                        <span className="font-medium">{g.label}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">
                            {g.entry_count} job{g.entry_count !== 1 ? "s" : ""}
                          </span>
                          <span className="min-w-[80px] text-right font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                            {formatPence(g.total_pence)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          {summary.excluded.needs_review > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="flex-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                onClick={() => setEarningsFilter("needs_review")}
              >
                {summary.excluded.needs_review} entr
                {summary.excluded.needs_review === 1 ? "y" : "ies"} excluded from totals — amount
                needs review. Click to view.
              </button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 border-amber-300 text-xs text-amber-700 hover:bg-amber-50"
                disabled={repairFlagsMutation.isPending}
                onClick={() => repairFlagsMutation.mutate()}
              >
                <RefreshCw
                  className={`mr-1 h-3 w-3 ${repairFlagsMutation.isPending ? "animate-spin" : ""}`}
                />
                Backfill
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: My Jobs ── */}
      <Card className="overflow-hidden">
        {/* Whole header is a mouse target; it holds controls, so the title block below is the keyboard control */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className="cursor-pointer border-l-4 border-indigo-500 bg-indigo-50/40 px-5 py-3 dark:bg-indigo-950/20"
          onClick={() => toggleSection("jobs", setJobsOpen, jobsOpen)}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2"
              {...keyActivate(() => toggleSection("jobs", setJobsOpen, jobsOpen), {
                expanded: jobsOpen,
              })}
            >
              <ChevronDown
                className={`h-4 w-4 text-indigo-500 transition-transform ${jobsOpen ? "" : "-rotate-90"}`}
              />
              <Briefcase className="h-4 w-4 text-indigo-600" />
              <p className="font-semibold">My jobs</p>
              {(() => {
                const todayStr = ukToday();
                const count =
                  upcomingHired.length + scheduledJobs.filter((g) => g.work_date > todayStr).length;
                return count > 0 ? (
                  <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">
                    {count}
                  </span>
                ) : null;
              })()}
            </div>
            {/* Only stops the click reaching the row behind it; not itself a control */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {unloggedBookings.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">From booking:</span>
                  {unloggedBookings.map((b) => (
                    <Button
                      key={b.id}
                      variant="outline"
                      size="sm"
                      className="h-6 border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50"
                      onClick={() => openFromBooking(b)}
                    >
                      {b.job_title}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                data-help="books.earnings.addJob"
                size="sm"
                className="h-7 text-xs"
                onClick={openAdd}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add job
              </Button>
              <Button
                data-help="books.earnings.sync"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => backfillMutation.mutate()}
                disabled={backfillMutation.isPending}
              >
                <RefreshCw
                  className={`mr-1 h-3 w-3 ${backfillMutation.isPending ? "animate-spin" : ""}`}
                />
                Sync
              </Button>
            </div>
          </div>
        </div>
        {jobsOpen && (
          <CardContent className="p-0">
            {(() => {
              // Normalise all job sources into a single list sorted by date
              type JobItem =
                | { kind: "booking"; date: string; data: (typeof upcomingHired)[0] }
                | { kind: "entry"; date: string; data: (typeof scheduledJobs)[0] };

              const todayStr = ukToday();
              const items: JobItem[] = [
                ...upcomingHired.map((b) => ({
                  kind: "booking" as const,
                  date: b.event_date ?? "9999-12-31",
                  data: b,
                })),
                ...scheduledJobs
                  .filter((g) => g.work_date > todayStr && !g.booking_id)
                  .map((g) => ({
                    kind: "entry" as const,
                    date: g.work_date,
                    data: g,
                  })),
              ].sort((a, b) => a.date.localeCompare(b.date));

              if (items.length === 0) {
                return (
                  <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    No active jobs yet — add one above or browse the job board.
                  </div>
                );
              }

              // Separate TBC (no real date) from datable items
              const tbcItems = items.filter((i) => i.date === "9999-12-31");
              const datableItems = items.filter((i) => i.date !== "9999-12-31");

              // Group by month (ascending — soonest first within each month)
              const jobMonthMap: Record<string, typeof datableItems> = {};
              for (const item of datableItems) {
                const mk = item.date.slice(0, 7);
                (jobMonthMap[mk] ??= []).push(item);
              }
              const jobMonths = Object.keys(jobMonthMap)
                .sort()
                .map((k) => ({ key: k, items: jobMonthMap[k] }));

              return (
                <>
                  {jobMonths.map(({ key: mk, items: monthItems }, mi) => (
                    <MonthSection
                      key={mk}
                      monthKey={mk}
                      total={null}
                      accentClass="text-indigo-700 dark:text-indigo-400"
                      headerClass="bg-indigo-50/60 dark:bg-indigo-950/20"
                      storageKey={`books-jobs-month-${mk}-${user?.id}`}
                      divider={mi < jobMonths.length - 1}
                    >
                      {monthItems.map((item) => {
                        if (item.kind === "booking") {
                          const b = item.data as any;
                          const isPast = b.event_date && new Date(b.event_date) < today;
                          return (
                            <div
                              key={`booking-${b.id}`}
                              className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                              {...pressable(() => openBooking(b))}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{b.job_title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {b.company_name ? `${b.company_name} · ` : ""}
                                  {b.event_date ? fmtDate(b.event_date) : "Date TBC"}
                                </p>
                              </div>
                              <div className="ml-3 flex shrink-0 items-center gap-2">
                                {b.entry_gross_pence > 0 ? (
                                  <span className="text-sm font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                                    {formatPence(b.entry_gross_pence, "GBP")}
                                  </span>
                                ) : b.rate ? (
                                  <span className="text-sm font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                                    {formatPence(
                                      Math.round(
                                        parseFloat(b.rate.replace(/[^0-9.]/g, "")) * 100
                                      ) || 0,
                                      "GBP"
                                    )}
                                  </span>
                                ) : null}
                                {isPast ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Clock className="h-3 w-3" />
                                    Awaiting payment
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    Confirmed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        const g = item.data;
                        const isExternal = !g.booking_id;
                        const statusColor =
                          g.work_status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : g.work_status === "pencilled"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : g.work_status === "completed"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-muted text-muted-foreground";
                        return (
                          <div
                            key={`entry-${g.id}`}
                            className={`flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40 ${isExternal ? "bg-sky-50/40 dark:bg-sky-950/10" : ""}`}
                            {...pressable(() => setJobDetailEntryId(g.id))}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {g.description ?? "Booked job"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(g.work_date)}
                                {g.client_name ? ` · ${g.client_name}` : ""}
                                {g.call_time ? ` · ${g.call_time}` : ""}
                                {g.venue_address ? ` · ${g.venue_address}` : ""}
                              </p>
                            </div>
                            <div className="ml-3 flex items-center gap-2">
                              {g.gross_amount_pence > 0 && (
                                <span className="text-sm font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                                  {formatPence(g.gross_amount_pence, g.currency)}
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor}`}
                              >
                                {g.work_status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </MonthSection>
                  ))}
                  {tbcItems.length > 0 && (
                    <div>
                      {datableItems.length > 0 && <div className="border-b" />}
                      <div className="flex items-center justify-between border-b bg-indigo-50/60 px-5 py-2 dark:bg-indigo-950/20">
                        <span className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
                          Date TBC
                        </span>
                      </div>
                      {tbcItems.map((item) => {
                        if (item.kind !== "booking") return null;
                        const b = item.data as any;
                        return (
                          <div
                            key={`booking-tbc-${b.id}`}
                            className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                            {...pressable(() => openBooking(b))}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{b.job_title}</p>
                              <p className="text-xs text-muted-foreground">
                                {b.company_name ? `${b.company_name} · ` : ""}Date TBC
                              </p>
                            </div>
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Confirmed
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        )}
      </Card>

      {/* ── Section 3: Earnings ── */}
      {(() => {
        const today = ukToday();
        const completedEntries = entries.filter((e) => e.work_date <= today);
        const filteredEntries = (
          earningsFilter === "all"
            ? completedEntries
            : earningsFilter === "needs_review"
              ? entries.filter((e) => e.needs_review)
              : earningsFilter === "other_currency"
                ? entries.filter((e) => !isBooksCurrency(e.currency))
                : completedEntries.filter((e) => e.status === earningsFilter)
        ).filter((e) => matchesOrigin(e, earningsOrigin));
        const earningsTotal = filteredEntries.reduce((s, e) => s + (e.gross_amount_pence ?? 0), 0);
        const earningsMonths = groupByMonth(filteredEntries, "work_date").reverse();
        return (
          <Card className="overflow-hidden">
            <div
              className="cursor-pointer border-l-4 border-blue-500 bg-blue-50/40 px-5 py-3 dark:bg-blue-950/20"
              {...pressable(() => toggleSection("earnings", setEarningsOpen, earningsOpen))}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 text-blue-500 transition-transform ${earningsOpen ? "" : "-rotate-90"}`}
                  />
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <p className="font-semibold">Earnings</p>
                  {completedEntries.length > 0 && (
                    <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                      {completedEntries.length}
                    </span>
                  )}
                </div>
                {/* Only stops the click reaching the row behind it; not itself a control */}
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {!earningsOpen && earningsTotal > 0 && (
                    <span className="text-xs font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                      {formatPence(earningsTotal)}
                    </span>
                  )}
                  {(earningsFilter !== "all" || earningsOrigin !== "all") && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                      Filtered
                    </span>
                  )}
                </div>
              </div>
            </div>
            {earningsOpen && (
              <CardContent className="p-0">
                <ListFilters
                  active={earningsFilter !== "all" || earningsOrigin !== "all"}
                  onClear={() => {
                    setEarningsFilter("all");
                    setEarningsOrigin("all");
                  }}
                >
                  <FilterSelect
                    label="Status"
                    value={earningsFilter}
                    onChange={setEarningsFilter}
                    options={EARNINGS_STATUS_OPTIONS}
                  />
                  <FilterSelect
                    label="Source"
                    helpKey="books.earnings.filterOrigin"
                    value={earningsOrigin}
                    onChange={(v) => setEarningsOrigin(v as OriginFilter)}
                    options={ORIGIN_OPTIONS}
                  />
                </ListFilters>
                {filteredEntries.length === 0 && awaitingPaymentHired.length === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    Completed jobs will appear here.
                  </div>
                ) : (
                  <div>
                    {awaitingPaymentHired.map((b) => (
                      <div
                        data-help="books.earnings.logPayment"
                        key={`unlogged-${b.id}`}
                        className="flex cursor-pointer items-center justify-between border-l-4 border-amber-400 bg-amber-50/60 px-5 py-3 dark:bg-amber-950/20"
                        {...pressable(() => openBooking(b))}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{b.job_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.company_name ? `${b.company_name} · ` : ""}
                            {b.event_date ? fmtDate(b.event_date) : "Date TBC"}
                          </p>
                        </div>
                        <span className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          Awaiting payment
                        </span>
                      </div>
                    ))}
                    {selectedEntryIds.size > 0 && (
                      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-blue-50 px-5 py-2 dark:bg-blue-950/30">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          {selectedEntryIds.size} selected
                        </span>
                        <Select value={bulkStatus} onValueChange={setBulkStatus}>
                          <SelectTrigger className="h-6 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expected">Expected</SelectItem>
                            <SelectItem value="invoiced">Invoiced</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkStatus === "paid" && (
                          <Select
                            value={bulkDateMode}
                            onValueChange={(v) =>
                              setBulkDateMode(
                                v as "work_date" | "end_of_following_month" | "explicit"
                              )
                            }
                          >
                            <SelectTrigger className="h-6 w-44 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="work_date">Work date</SelectItem>
                              <SelectItem value="end_of_following_month">
                                End of following month
                              </SelectItem>
                              <SelectItem value="explicit">Specific date</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {bulkStatus === "paid" && bulkDateMode === "explicit" && (
                          <input
                            type="date"
                            className="h-6 rounded border px-1 text-xs"
                            value={bulkExplicitDate}
                            onChange={(e) => setBulkExplicitDate(e.target.value)}
                          />
                        )}
                        <Button
                          size="sm"
                          className="h-6 text-xs"
                          disabled={bulkMutation.isPending}
                          onClick={handleBulkApply}
                        >
                          Apply
                        </Button>
                        {(() => {
                          const selectedFlagged = filteredEntries.filter(
                            (e) => selectedEntryIds.has(e.id) && e.needs_review
                          );
                          return selectedFlagged.length > 0 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 border-amber-300 text-xs text-amber-700 hover:bg-amber-50"
                              disabled={markReviewedMutation.isPending}
                              onClick={() =>
                                markReviewedMutation.mutate(selectedFlagged.map((e) => e.id))
                              }
                            >
                              Mark as reviewed ({selectedFlagged.length})
                            </Button>
                          ) : null;
                        })()}
                        <button
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedEntryIds(new Set())}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {earningsMonths.map(({ key, items: monthEntries }, mi) => {
                      const monthTotal = monthEntries.reduce(
                        (s, e) => s + (e.gross_amount_pence ?? 0),
                        0
                      );
                      const monthIds = monthEntries.map((e) => e.id);
                      const allSelected = monthIds.every((id) => selectedEntryIds.has(id));
                      const someSelected =
                        !allSelected && monthIds.some((id) => selectedEntryIds.has(id));
                      const selectAll = (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                          onChange={(e) => {
                            setSelectedEntryIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) {
                                monthIds.forEach((id) => next.add(id));
                              } else {
                                monthIds.forEach((id) => next.delete(id));
                              }
                              return next;
                            });
                          }}
                        />
                      );
                      return (
                        <MonthSection
                          key={key}
                          monthKey={key}
                          total={monthTotal}
                          accentClass="text-blue-700 dark:text-blue-400"
                          headerClass="bg-blue-50/60 dark:bg-blue-950/20"
                          storageKey={`books-earn-month-${key}-${user?.id}`}
                          divider={mi < earningsMonths.length - 1}
                          selectAll={selectAll}
                        >
                          {monthEntries.map((entry, i) => (
                            // Whole row is a mouse target; it holds a checkbox, so the text block below is the keyboard control
                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                            <div
                              key={entry.id}
                              className={`flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-muted/50 ${
                                selectedEntryIds.has(entry.id)
                                  ? "bg-blue-50/60 dark:bg-blue-950/20"
                                  : i % 2 === 0
                                    ? "bg-muted/30"
                                    : ""
                              }`}
                              onClick={() => setJobDetailEntryId(entry.id)}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Select ${entry.description ?? "entry"}`}
                                checked={selectedEntryIds.has(entry.id)}
                                className="mr-3 h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-600"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  setSelectedEntryIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(entry.id);
                                    else next.delete(entry.id);
                                    return next;
                                  });
                                }}
                              />
                              <div
                                className="min-w-0 flex-1"
                                {...keyActivate(() => setJobDetailEntryId(entry.id))}
                              >
                                <p className="truncate text-sm font-medium">
                                  {entry.description ?? "Freelance work"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(entry as any).job_ref ? (
                                    <span className="mr-1 font-medium text-blue-600 dark:text-blue-400">
                                      {(entry as any).job_ref}
                                    </span>
                                  ) : null}
                                  {fmtDate(entry.work_date)}
                                  {entry.client_name ? ` · ${entry.client_name}` : ""}
                                </p>
                              </div>
                              <div className="ml-4 flex items-center gap-3">
                                {entry.needs_review && (
                                  <span
                                    data-help="books.earnings.needsReview"
                                    title={
                                      entry.review_reason === "unparsed_amount"
                                        ? "Amount could not be read from the source"
                                        : entry.review_reason === "ambiguous_amount"
                                          ? "Source contained a range value — check the amount"
                                          : entry.review_reason === "assumed_date"
                                            ? "Date was assumed; check it matches the original"
                                            : entry.review_reason === "zero_amount"
                                              ? "Amount parsed as zero from a non-empty source"
                                              : "Needs review"
                                    }
                                    className="inline-block h-2 w-2 rounded-full bg-amber-400"
                                  />
                                )}
                                <button
                                  data-help="books.earnings.status"
                                  className="cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  title="Change payment status"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStatusEdit(entry);
                                  }}
                                >
                                  <StatusBadge entry={entry} />
                                </button>
                                <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                                  {entry.gross_amount_pence > 0
                                    ? formatPence(entry.gross_amount_pence, entry.currency)
                                    : "—"}
                                </span>
                                <button
                                  className="text-muted-foreground transition-colors hover:text-foreground"
                                  title="Edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(entry);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="text-muted-foreground transition-colors hover:text-foreground"
                                  title="History"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHistoryEntryId(entry.id);
                                  }}
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                </button>
                                {(entry.source === "manual" || entry.source === "imported") && (
                                  <button
                                    className="text-muted-foreground transition-colors hover:text-destructive"
                                    title="Remove"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      archiveMutation.mutate(entry.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </MonthSection>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })()}

      {jobDialogs}
      {bookingDetailDialog}
      {statusEditDialog}

      <Dialog open={historyEntryId !== null} onOpenChange={(o) => !o && setHistoryEntryId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entry history</DialogTitle>
          </DialogHeader>
          {entryHistory.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ol className="space-y-3 py-2">
              {entryHistory.map((row) => (
                <li key={row.id} className="flex gap-3 text-sm">
                  <div className="mt-0.5 shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{row.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.changed_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
      <RecentlyRemoved table="earnings" />
    </div>
  );
}
