import { useEffect, useRef, useState } from "react";
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
import { type GigForm, EMPTY_GIG_FORM, GigFormBody } from "./GigFormFields";

// ── Money helpers ──────────────────────────────────────────────────────────────

function formatPence(pence: number | null | undefined, currency = "GBP"): string {
  if (pence == null) return "—";
  const amount = pence / 100;
  const symbol =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
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
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
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
  excluded: { needs_review: number; other_currency: number };
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
  notes: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
        notes: editing.notes ?? "",
      });
      setMoreOpen(
        editing.vat_amount_pence > 0 ||
          editing.business_use_percent < 100 ||
          !!editing.payment_method ||
          editing.billable_to_client
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
          {/* Amount — focused first */}
          <div className="space-y-1">
            <Label htmlFor="exp-amount">Amount (£) *</Label>
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
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                <SelectTrigger style={{ fontSize: "16px" }}>
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              {vatRegistered && (
                <div className="space-y-1">
                  <Label htmlFor="exp-vat">VAT amount (£)</Label>
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
                <Label>Payment method</Label>
                <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                  <SelectTrigger style={{ fontSize: "16px" }}>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
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
                    <select
                      className="rounded border bg-background px-2 py-1 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        const expId = parseInt(e.target.value);
                        if (expId) attachMutation.mutate({ receiptId: r.id, expenseId: expId });
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        Attach to…
                      </option>
                      {expenses.slice(0, 20).map((exp) => (
                        <option key={exp.id} value={exp.id}>
                          {fmtDate(exp.expense_date)} · {exp.supplier || exp.description}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
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

function ExpensesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data: categoriesData = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const { data: billingProfile } = useQuery<{ vat_registered?: boolean } | null>({
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
  const expenses = expensesData?.expenses ?? [];

  // Group expenses by YYYY-MM month
  const byMonth = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const key = e.expense_date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  const categoryMap = Object.fromEntries(categoriesData.map((c) => [c.id, c.name]));

  function monthLabel(key: string) {
    const [y, m] = key.split("-");
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
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  const openAdd = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-amber-500 px-5 py-3 dark:bg-amber-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-100" />
              <p className="font-semibold text-white">Expenses</p>
              {expenses.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                  {expenses.length}
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="h-7 bg-white text-xs text-amber-700 hover:bg-amber-50"
              onClick={openAdd}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add expense
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border p-3">
                  <div className="mb-1 h-3 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
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
              {monthKeys.map((key, mi) => {
                const monthExpenses = byMonth[key];
                const monthTotal = monthExpenses.reduce(
                  (sum, e) =>
                    sum +
                    Math.round(
                      ((e.net_amount_pence + e.vat_amount_pence) * e.business_use_percent) / 100
                    ),
                  0
                );
                return (
                  <div key={key}>
                    {/* Month header */}
                    <div className="flex items-center justify-between border-b bg-amber-50/60 px-5 py-2 dark:bg-amber-950/20">
                      <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        {monthLabel(key)}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                        {formatPence(monthTotal)}
                      </span>
                    </div>
                    {monthExpenses.map((expense, i) => {
                      const total = expense.net_amount_pence + expense.vat_amount_pence;
                      const allowable = Math.round((total * expense.business_use_percent) / 100);
                      const catName = expense.category_id ? categoryMap[expense.category_id] : null;
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
                              {formatPence(allowable)}
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
                    {mi < monthKeys.length - 1 && <div className="border-b" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <UnattachedInbox expenses={expenses} />

      <ExpenseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editingExpense}
        categories={categoriesData}
        vatRegistered={vatRegistered}
      />
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
  trip_date: new Date().toISOString().slice(0, 10),
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
      setForm({ ...EMPTY_TRIP, trip_date: new Date().toISOString().slice(0, 10) });
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
            <Label>Date</Label>
            <Input type="date" value={form.trip_date} onChange={set("trip_date")} />
          </div>
          <div>
            <Label>From</Label>
            <Input
              list="saved-places-from"
              placeholder="Starting point"
              value={form.from_place}
              onChange={set("from_place")}
            />
            <datalist id="saved-places-from">{placeOptions}</datalist>
          </div>
          <div>
            <Label>To</Label>
            <Input
              list="saved-places-to"
              placeholder="Destination"
              value={form.to_place}
              onChange={set("to_place")}
            />
            <datalist id="saved-places-to">{placeOptions}</datalist>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Miles</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={form.miles}
                onChange={set("miles")}
              />
            </div>
            <div className="flex-1">
              <Label>Vehicle</Label>
              <select
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
            <Label>Purpose</Label>
            <Input
              placeholder="Client visit, site survey…"
              value={form.purpose}
              onChange={set("purpose")}
            />
          </div>
          <JobSelect value={form.job_id} onChange={(v) => setForm((f) => ({ ...f, job_id: v }))} />
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={form.notes} onChange={set("notes")} />
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
    work_date: new Date().toISOString().slice(0, 10),
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
      work_date: new Date().toISOString().slice(0, 10),
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
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={dayForm.work_date}
                    onChange={(e) => setDayForm((f) => ({ ...f, work_date: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Break (minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={dayForm.break_minutes}
                    onChange={(e) => setDayForm((f) => ({ ...f, break_minutes: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={dayForm.start_time}
                    onChange={(e) => setDayForm((f) => ({ ...f, start_time: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Finish</Label>
                  <Input
                    type="time"
                    value={dayForm.finish_time}
                    onChange={(e) => setDayForm((f) => ({ ...f, finish_time: e.target.value }))}
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
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
                  <Label className="text-xs">Overtime hours to invoice</Label>
                  <Input
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
                    <Label className="text-xs">Standard hours per day</Label>
                    <Input
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
                    <Label className="text-xs">Overtime rate (£/hr)</Label>
                    <Input
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

  // Group by month
  const byMonth = trips.reduce<Record<string, MileageTrip[]>>((acc, t) => {
    const key = t.trip_date.slice(0, 7);
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

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
        <div className="border-l-4 border-purple-400 bg-purple-50/40 px-5 py-3 dark:bg-purple-950/20">
          <p className="font-semibold">Trips</p>
        </div>
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
              {Object.entries(byMonth)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([month, monthTrips], mi) => {
                  const monthTotal = monthTrips.reduce((s, t) => s + t.amount_pence, 0);
                  const [y, m] = month.split("-");
                  const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-GB", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <div key={month}>
                      <div className="flex items-center justify-between border-b bg-purple-50/60 px-5 py-2 dark:bg-purple-950/20">
                        <span className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">
                          {label}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-purple-700 dark:text-purple-400">
                          {formatPence(monthTotal)}
                        </span>
                      </div>
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
                      {mi < Object.keys(byMonth).length - 1 && <div className="border-b" />}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
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

interface TaxEstimateData {
  taxYearLabel: string;
  netProfitPence: number;
  incomeTaxBands: TaxBand[];
  incomeTaxTotalPence: number;
  niBands: TaxBand[];
  niTotalPence: number;
  totalTaxPence: number;
  effectiveRatePct: number;
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

function OverviewSection() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

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

  const { data: taxData } = useQuery<TaxEstimateData>({
    queryKey: ["/api/books/tax-estimate"],
    queryFn: () =>
      fetch("/api/books/tax-estimate", { headers: authHeaders() }).then((r) => r.json()),
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {fmtDate(data.from)} – {fmtDate(data.to)} · cash basis
      </p>

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
              Est. tax &amp; NI
            </p>
            <p className="text-xl font-bold tabular-nums text-red-300">
              {formatPence(taxData.totalTaxPence)}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Take-home ~{formatPence(taxData.netProfitPence - taxData.totalTaxPence)}
            </p>
          </div>
        )}
      </div>

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
            {taxData && (
              <>
                <div className="flex items-baseline justify-between bg-slate-50 px-5 py-2.5 dark:bg-slate-900/40">
                  <p className="text-sm text-muted-foreground">
                    Est. tax &amp; NI ({taxData.effectiveRatePct}%)
                  </p>
                  <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                    −{formatPence(taxData.totalTaxPence)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between bg-green-50 px-5 py-3 dark:bg-green-950/30">
                  <p className="font-semibold">Est. take-home</p>
                  <span className="text-lg font-bold tabular-nums text-green-700 dark:text-green-300">
                    {formatPence(taxData.netProfitPence - taxData.totalTaxPence)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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

type UnloggedBooking = {
  id: number;
  job_id?: number;
  recruiter_id?: number;
  job_title: string;
  company_name?: string;
  event_date?: string;
  rate?: string;
  location?: string;
  status?: string;
  earnings_entry_id?: number | null;
  entry_gross_pence?: number | null;
};

interface HiredBooking {
  booking: {
    id: number;
    jobId: number;
    employerId: number;
    status: string;
    agreedRate: string | null;
    earnings_entry_id: number | null;
  };
  job: { id: number; title: string; eventDate: string | null; endDate?: string | null };
  employer: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    profilePicture?: string | null;
  };
}

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
    setSectionRaw(s);
  };
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EarningsEntry | null>(null);
  const [jobDetailEntryId, setJobDetailEntryId] = useState<number | null>(null);
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
  const { data: topLevelBillingProfile } = useQuery<{ vat_registered?: boolean } | null>({
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

  const { data, isLoading, isError } = useQuery<EarningsData>({
    queryKey: ["/api/earnings/summary"],
    queryFn: () => apiRequest("/api/earnings/summary"),
  });

  const { data: clients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/earnings/clients"],
  });

  const { data: hiredBookings = [] } = useFreelancerJobs();

  // Derive allBookings from hiredBookings — /api/bookings/freelancer now includes earnings_entry_id
  const allBookings: UnloggedBooking[] = (hiredBookings as unknown as HiredBooking[])
    .filter((hb) => ["confirmed", "briefed", "completed"].includes(hb.booking.status))
    .map((hb) => ({
      id: hb.booking.id,
      job_id: hb.booking.jobId,
      job_title: hb.job.title,
      company_name: hb.employer.companyName ?? undefined,
      event_date: hb.job.eventDate ?? undefined,
      rate: hb.booking.agreedRate ?? undefined,
      status: hb.booking.status,
      earnings_entry_id: hb.booking.earnings_entry_id ?? undefined,
      entry_gross_pence: (hb.booking as any).entry_gross_pence ?? null,
    }));

  // Lightweight invoice lookup by job/booking id
  const { data: allInvoices = [] } = useQuery<
    { id: number; job_id: number | null; booking_id: number | null }[]
  >({
    queryKey: ["/api/invoices", "ids"],
    queryFn: () => apiRequest("/api/invoices"),
    enabled: !!user?.id,
    select: (data: any[]) =>
      data.map((inv) => ({ id: inv.id, job_id: inv.job_id, booking_id: inv.booking_id })),
  });

  const findInvoiceForBooking = (b: { job_id?: number | null; id?: number | null }) => {
    if (!b) return undefined;
    return allInvoices.find(
      (inv) => (b.job_id && inv.job_id === b.job_id) || (b.id && inv.booking_id === b.id)
    );
  };

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

  const createInvoiceForBooking = (b: UnloggedBooking) => {
    const existing = findInvoiceForBooking(b);
    if (existing) {
      setSelectedBooking(null);
      setInvoicePrefill({ openInvoiceId: existing.id });
      setSection("invoices");
      return;
    }
    const match = hiredBookings.find((hb) => hb.booking.jobId === b.job_id);
    // Parse rate string to pence best-effort (e.g. "£400", "400", "400.00")
    const rateStr = match?.booking.agreedRate ?? b.rate ?? "";
    const rateNum = parseFloat(rateStr.replace(/[^0-9.]/g, ""));
    const ratePence = isNaN(rateNum) ? null : Math.round(rateNum * 100);
    const toName = match
      ? `${match.employer.firstName ?? ""} ${match.employer.lastName ?? ""}`.trim()
      : "";
    const toCompany = match?.employer.companyName ?? b.company_name ?? "";
    setInvoicePrefill({
      bookingId: match?.booking.id ?? null,
      jobId: b.job_id ?? match?.booking.jobId ?? null,
      toName,
      toCompany,
      lineDescription: b.job_title,
      ratePence,
      issueDate: new Date().toISOString().slice(0, 10),
    });
    setSelectedBooking(null);
    setSection("invoices");
  };

  const createInvoiceForHiredBooking = (b: HiredBookingForCalendar) => {
    const existing = allInvoices.find(
      (inv) =>
        (b.jobId && inv.job_id === b.jobId) || (b.bookingId && inv.booking_id === b.bookingId)
    );
    if (existing) {
      setInvoicePrefill({ openInvoiceId: existing.id });
      setSection("invoices");
      return;
    }
    const rateStr = b.agreedRate ?? "";
    const rateNum = parseFloat(rateStr.replace(/[^0-9.]/g, ""));
    const ratePence = isNaN(rateNum) ? null : Math.round(rateNum * 100);
    setInvoicePrefill({
      bookingId: b.bookingId ?? null,
      jobId: b.jobId ?? null,
      toName: b.employerName ?? "",
      toCompany: b.companyName ?? "",
      lineDescription: b.jobTitle,
      ratePence,
      issueDate: new Date().toISOString().slice(0, 10),
    });
    setSection("invoices");
  };

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
          unit_price_pence: exp.net_amount_pence + (exp.vat_amount_pence ?? 0),
        });
      }

      setInvoicePrefill({
        toName: entry.client_name ?? "",
        lineItems,
        issueDate: new Date().toISOString().slice(0, 10),
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
    (b: any) => b.status !== "completed" && (!b.event_date || new Date(b.event_date) >= today)
  );
  // Past work with no entry — edge case after backfill, but kept as a safety net
  const unloggedBookings = allBookings.filter(
    (b: any) => !b.earnings_entry_id && b.event_date && new Date(b.event_date) < today
  );
  // Past bookings with no entry yet — show "Log payment" in Earnings
  // Once an entry exists, the booking falls through to completedEntries (full display with amount)
  const awaitingPaymentHired = allBookings.filter(
    (b: any) => !b.earnings_entry_id && b.event_date && new Date(b.event_date) < today
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
  const gigsFrom = (() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  })();
  const gigsTo = (() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();
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
      datePaid: entry.paid_date ?? new Date().toISOString().slice(0, 10),
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
          <Button size="sm" onClick={() => createInvoiceForBooking(selectedBooking)}>
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            {findInvoiceForBooking(selectedBooking) ? "View / Edit invoice" : "Create invoice"}
          </Button>
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
            <Label>Status</Label>
            <Select
              value={statusEditForm.status}
              onValueChange={(v) => setStatusEditForm((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger>
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
                <Label>Amount received (£) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={statusEditForm.amount}
                  onChange={(e) => setStatusEditForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Date paid *</Label>
                <Input
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
    <div className="flex w-full gap-1 overflow-x-auto rounded-md border p-1 [&::-webkit-scrollbar]:hidden">
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
  );

  if (section === "overview") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <OverviewSection />
      </div>
    );
  }

  if (section === "expenses") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <ExpensesSection />
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

  if (section === "calendar") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <CalendarTab
          onInvoice={(b) => createInvoiceForHiredBooking(b)}
          onJobDetail={(entryId) => setJobDetailEntryId(entryId)}
        />
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
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              {summary.excluded.needs_review} entr
              {summary.excluded.needs_review === 1 ? "y" : "ies"} excluded — amount needs review.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: My Jobs ── */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-indigo-500 bg-indigo-50/40 px-5 py-3 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-indigo-600" />
              <p className="font-semibold">My jobs</p>
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const count =
                  upcomingHired.length + scheduledJobs.filter((g) => g.work_date > todayStr).length;
                return count > 0 ? (
                  <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">
                    {count}
                  </span>
                ) : null;
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
        <CardContent className="p-0">
          {(() => {
            // Normalise all job sources into a single list sorted by date
            type JobItem =
              | { kind: "booking"; date: string; data: (typeof upcomingHired)[0] }
              | { kind: "entry"; date: string; data: (typeof scheduledJobs)[0] };

            const todayStr = new Date().toISOString().slice(0, 10);
            const items: JobItem[] = [
              ...upcomingHired.map((b: any) => ({
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

            return items.map((item) => {
              if (item.kind === "booking") {
                const b = item.data as any;
                const isPast = b.event_date && new Date(b.event_date) < today;
                return (
                  <div
                    key={`booking-${b.id}`}
                    className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                    onClick={() => setSelectedBooking(b)}
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
                            Math.round(parseFloat(b.rate.replace(/[^0-9.]/g, "")) * 100) || 0,
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

              // entry (manual / external job) — slight blue tint
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
                  onClick={() => setJobDetailEntryId(g.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.description ?? "Booked job"}</p>
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
            });
          })()}
        </CardContent>
      </Card>

      {/* ── Section 3: Earnings ── */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const completedEntries = entries
          .filter((e) => e.work_date <= today)
          .sort((a, b) => b.work_date.localeCompare(a.work_date));
        return (
          <Card className="overflow-hidden">
            <div className="border-l-4 border-blue-500 bg-blue-50/40 px-5 py-3 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <p className="font-semibold">Earnings</p>
                {completedEntries.length > 0 && (
                  <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                    {completedEntries.length}
                  </span>
                )}
              </div>
            </div>
            <CardContent className="p-0">
              {completedEntries.length === 0 && awaitingPaymentHired.length === 0 ? (
                <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  Completed jobs will appear here.
                </div>
              ) : (
                <div>
                  {awaitingPaymentHired.map((b: any) => (
                    <div
                      key={`unlogged-${b.id}`}
                      className="flex cursor-pointer items-center justify-between border-l-4 border-amber-400 bg-amber-50/60 px-5 py-3 dark:bg-amber-950/20"
                      onClick={() => setSelectedBooking(b)}
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
                  {completedEntries.map((entry, i) => (
                    <div
                      key={entry.id}
                      className={`flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-muted/50 ${
                        i % 2 === 0 ? "bg-muted/30" : ""
                      }`}
                      onClick={() => setJobDetailEntryId(entry.id)}
                    >
                      <span className="mr-3 shrink-0 text-xs font-medium tabular-nums text-muted-foreground/60">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
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
                        <button
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
                        {entry.source === "manual" && (
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
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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
                paid_date: new Date().toISOString().slice(0, 10),
              }
            : undefined
        }
        jobApplicationId={fromBooking?.id}
      />
      {bookingDetailDialog}
      {statusEditDialog}

      {jobDetailEntryId !== null && (
        <JobDetailDialog
          earningsEntryId={jobDetailEntryId}
          onClose={() => setJobDetailEntryId(null)}
          onInvoice={() => {
            setJobDetailEntryId(null);
            createInvoiceForJob(jobDetailEntryId!);
          }}
          onEdit={(entryId) => {
            const entry = entries.find((e) => e.id === entryId);
            if (entry) openEdit(entry);
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
    </div>
  );
}
