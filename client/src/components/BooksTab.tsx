import { useEffect, useRef, useState } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ImageIcon,
  MapPin,
  Navigation,
  PoundSterling,
  TrendingUp,
  RefreshCw,
  Download,
  Plus,
  Pencil,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { KitTab } from "./KitTab";
import { InvoicesTab } from "./InvoicesTab";

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

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ entry }: { entry: EarningsEntry }) {
  if (entry.needs_review)
    return (
      <Badge variant="outline" className="border-amber-400 text-xs text-amber-600">
        Review needed
      </Badge>
    );
  if (entry.status === "paid")
    return (
      <Badge variant="secondary" className="bg-green-100 text-xs text-green-700">
        Paid
      </Badge>
    );
  if (entry.status === "expected")
    return (
      <Badge variant="outline" className="text-xs">
        Expected
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {entry.status}
    </Badge>
  );
}

// ── Export card ───────────────────────────────────────────────────────────────

function ExportCard() {
  const ty = (() => {
    const now = new Date();
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: `${y}-04-06`, to: `${y + 1}-04-05` };
  })();

  const dl = (path: string) => {
    const token = localStorage.getItem("auth_token");
    const sep = path.includes("?") ? "&" : "?";
    window.location.href = token ? `${path}${sep}token=${encodeURIComponent(token)}` : path;
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Download className="h-4 w-4" />
          Export
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dl(`/api/exports/earnings.csv?from=${ty.from}&to=${ty.to}&basis=cash`)}
        >
          Earnings CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dl(`/api/exports/invoices.csv?from=${ty.from}&to=${ty.to}`)}
        >
          Invoices CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => dl("/api/exports/kit.csv")}>
          Kit register CSV
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Gig dialog (add / edit manual entries) ───────────────────────────────────

interface GigForm {
  description: string;
  client_name: string;
  work_date: string;
  work_end_date: string;
  unit: "day" | "hour" | "job";
  quantity: string;
  gross_amount: string;
  currency: string;
  status: "expected" | "paid";
  paid_date: string;
  notes: string;
}

const EMPTY_FORM: GigForm = {
  description: "",
  client_name: "",
  work_date: "",
  work_end_date: "",
  unit: "day",
  quantity: "1",
  gross_amount: "",
  currency: "GBP",
  status: "expected",
  paid_date: "",
  notes: "",
};

function GigDialog({
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
  const [form, setForm] = useState<GigForm>(EMPTY_FORM);

  // Reset form when dialog opens
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
        });
      } else {
        setForm({ ...EMPTY_FORM, ...prefill });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof GigForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing
        ? apiRequest(`/api/earnings/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest("/api/earnings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/freelancer"] });
      toast({ title: editing ? "Gig updated" : "Gig added" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.description.trim() || !form.work_date || !form.gross_amount) return;
    saveMutation.mutate({
      description: form.description.trim(),
      client_name: form.client_name.trim() || null,
      work_date: form.work_date,
      work_end_date: form.work_end_date || null,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 1,
      gross_amount: parseFloat(form.gross_amount),
      currency: form.currency,
      status: form.status,
      paid_date: form.status === "paid" ? form.paid_date || form.work_date : null,
      notes: form.notes || null,
      ...(jobApplicationId ? { job_application_id: jobApplicationId } : {}),
    });
  };

  const clientNames = clients.map((c) => c.name);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit gig" : "Add gig"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="gig-desc">Job / gig description *</Label>
            <Input
              id="gig-desc"
              placeholder="e.g. Wedding photography, Corporate AV"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="gig-client">Client name</Label>
            <Input
              id="gig-client"
              list="gig-clients-list"
              placeholder="Type or pick an existing client"
              value={form.client_name}
              onChange={(e) => set("client_name", e.target.value)}
            />
            <datalist id="gig-clients-list">
              {clientNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="gig-date">Work date *</Label>
              <Input
                id="gig-date"
                type="date"
                value={form.work_date}
                onChange={(e) => set("work_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gig-end">End date (optional)</Label>
              <Input
                id="gig-end"
                type="date"
                value={form.work_end_date}
                onChange={(e) => set("work_end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Per day</SelectItem>
                  <SelectItem value="hour">Per hour</SelectItem>
                  <SelectItem value="job">Per job</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="gig-qty">Qty</Label>
              <Input
                id="gig-qty"
                type="number"
                min="0.5"
                step="0.5"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP £</SelectItem>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="gig-amount">Total amount *</Label>
            <Input
              id="gig-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.gross_amount}
              onChange={(e) => set("gross_amount", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the full amount you&apos;re owed or were paid (not the day rate).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expected">Expected / owed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "paid" && (
              <div className="space-y-1">
                <Label htmlFor="gig-paid-date">Date paid</Label>
                <Input
                  id="gig-paid-date"
                  type="date"
                  value={form.paid_date}
                  onChange={(e) => set("paid_date", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="gig-notes">Notes (optional)</Label>
            <Textarea
              id="gig-notes"
              rows={2}
              placeholder="Any extra details…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
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
              !form.work_date ||
              !form.gross_amount
            }
          >
            {editing ? "Save changes" : "Add gig"}
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

  // Reset when dialog opens
  useState(() => {
    if (open) {
      if (editing) {
        setForm({
          description: editing.description,
          supplier: editing.supplier ?? "",
          expense_date: editing.expense_date.slice(0, 10),
          net_amount: (editing.net_amount_pence / 100).toFixed(2),
          category_id: editing.category_id ? String(editing.category_id) : "",
          vat_amount:
            editing.vat_amount_pence > 0 ? (editing.vat_amount_pence / 100).toFixed(2) : "",
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
        // Focus amount field after render
        setTimeout(() => amountRef.current?.focus(), 50);
      }
    }
  });

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
    saveMutation.mutate({
      description: form.description.trim(),
      supplier: form.supplier.trim() || null,
      expense_date: form.expense_date,
      net_amount_pence: Math.round(parseFloat(form.net_amount) * 100),
      vat_amount_pence: form.vat_amount ? Math.round(parseFloat(form.vat_amount) * 100) : 0,
      category_id: form.category_id ? parseInt(form.category_id) : null,
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
                    <img src={r.url} alt={r.file_name} className="h-12 w-12 rounded object-cover" />
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
  notes: string;
}

const EMPTY_TRIP: TripForm = {
  trip_date: new Date().toISOString().slice(0, 10),
  from_place: "",
  to_place: "",
  miles: "",
  purpose: "",
  vehicle_type: "car",
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

  // Prime form when opening
  useState(() => {
    if (open) {
      if (editing) {
        setForm({
          trip_date: editing.trip_date,
          from_place: editing.from_place,
          to_place: editing.to_place,
          miles: String(editing.miles),
          purpose: editing.purpose,
          vehicle_type: editing.vehicle_type,
          notes: editing.notes ?? "",
        });
      } else {
        setForm({ ...EMPTY_TRIP, trip_date: new Date().toISOString().slice(0, 10) });
      }
    }
  });

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

  function downloadWithAuth(url: string, filename: string) {
    fetch(url, { headers: authHeaders() })
      .then((r) => r.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(objUrl);
      });
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
      {/* ── Period label + export ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {fmtDate(data.from)} – {fmtDate(data.to)} · cash basis
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadWithAuth("/api/books/export", "books-export.xlsx")}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          Export
        </Button>
      </div>

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

      {/* ── Year-end downloads ── */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-orange-400 bg-orange-50/50 px-5 py-3 dark:bg-orange-950/20">
          <p className="font-semibold">Year-end pack</p>
          <p className="text-xs text-muted-foreground">
            Download all records for your accountant or self-assessment.
          </p>
        </div>
        <CardContent className="flex flex-wrap gap-2 py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadWithAuth("/api/books/export", "books-export.xlsx")}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Expenses &amp; mileage
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadWithAuth("/api/expenses/export", "expenses.xlsx")}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Expenses only
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Top-level tabs ─────────────────────────────────────────────────────────────

type UnloggedBooking = {
  id: number;
  job_title: string;
  company_name?: string;
  event_date?: string;
  rate?: string;
};

export function BooksTab() {
  const [section, setSection] = useState<
    "overview" | "earnings" | "expenses" | "mileage" | "kit" | "invoices"
  >("overview");
  const [gigDialogOpen, setGigDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EarningsEntry | null>(null);
  const [fromBooking, setFromBooking] = useState<UnloggedBooking | null>(null);
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

  // Bookings that have passed their event date but haven't been logged as earnings yet
  const { data: allBookings = [] } = useQuery<UnloggedBooking[]>({
    queryKey: ["/api/freelancer", user?.id, "bookings"],
    enabled: !!user?.id,
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/freelancer/${user!.id}/bookings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const unloggedBookings = allBookings.filter(
    (b: any) => !b.earnings_entry_id && b.event_date && new Date(b.event_date) < new Date()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // All hired bookings not yet logged — split into upcoming (future) and awaiting payment (past)
  const upcomingHired = allBookings.filter(
    (b: any) => !b.earnings_entry_id && (!b.event_date || new Date(b.event_date) >= today)
  );
  const awaitingPaymentHired = allBookings.filter(
    (b: any) => !b.earnings_entry_id && b.event_date && new Date(b.event_date) < today
  );

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/earnings/${id}/archive`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Entry removed" });
    },
    onError: () => toast({ title: "Failed to remove entry", variant: "destructive" }),
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("/api/earnings/backfill", { method: "POST" }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({
        title: "Backfill complete",
        description: `${result.seeded} entries added, ${result.skipped} already existed.`,
      });
    },
    onError: () => toast({ title: "Backfill failed", variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingEntry(null);
    setFromBooking(null);
    setGigDialogOpen(true);
  };
  const openEdit = (e: EarningsEntry) => {
    setEditingEntry(e);
    setFromBooking(null);
    setGigDialogOpen(true);
  };
  const openFromBooking = (b: UnloggedBooking) => {
    setEditingEntry(null);
    setFromBooking(b);
    setGigDialogOpen(true);
  };

  const sectionSwitcher = (
    <div className="flex w-fit gap-1 rounded-md border p-1">
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
        data-help="books.section.kit"
        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "kit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setSection("kit")}
      >
        Kit register
      </button>
      <button
        data-help="books.section.invoices"
        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "invoices" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setSection("invoices")}
      >
        Invoices
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

  if (section === "kit") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <ExportCard />
        <KitTab />
      </div>
    );
  }

  if (section === "invoices") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <InvoicesTab />
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

  const { tax_year, summary, owed, entries } = data;
  const netPence = summary.total_pence - summary.deductions_pence;

  return (
    <div className="space-y-6">
      {sectionSwitcher}
      <ExportCard />

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
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gigs</p>
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
                            {g.entry_count} gig{g.entry_count !== 1 ? "s" : ""}
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

      {/* ── Section 2: Booked jobs ── */}
      {(upcomingHired.length > 0 || awaitingPaymentHired.length > 0) && (
        <Card className="overflow-hidden">
          <div className="border-l-4 border-indigo-500 bg-indigo-50/40 px-5 py-3 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-indigo-600" />
              <p className="font-semibold">Booked jobs</p>
              <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">
                {upcomingHired.length + awaitingPaymentHired.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Jobs you&apos;re hired for — log payment when money arrives
            </p>
          </div>
          <CardContent className="p-0">
            {awaitingPaymentHired.length > 0 && (
              <div>
                <div className="bg-amber-50/60 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                  Awaiting payment
                </div>
                {awaitingPaymentHired.map((b: any, i: number) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? "bg-amber-50/20 dark:bg-amber-950/10" : ""}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{b.job_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.company_name ? `${b.company_name} · ` : ""}
                        {b.event_date ? fmtDate(b.event_date) : ""}
                        {b.rate ? ` · ${b.rate}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-xs text-amber-700 hover:bg-amber-50"
                      data-help="books.earnings.logPayment"
                      onClick={() => openFromBooking(b)}
                    >
                      <PoundSterling className="mr-1 h-3 w-3" />
                      Log payment
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {upcomingHired.length > 0 && (
              <div>
                <div className="bg-green-50/60 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-green-700 dark:bg-green-950/20 dark:text-green-400">
                  Upcoming
                </div>
                {upcomingHired.map((b: any, i: number) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? "bg-green-50/20 dark:bg-green-950/10" : ""}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{b.job_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.company_name ? `${b.company_name} · ` : ""}
                        {b.event_date ? fmtDate(b.event_date) : "Date TBC"}
                        {b.rate ? ` · ${b.rate}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Confirmed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Owed to me ── */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-orange-400 bg-orange-50/60 px-5 py-3 dark:bg-orange-950/20">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <p className="font-semibold">Owed to me</p>
            {owed.length > 0 && (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                {owed.length}
              </span>
            )}
          </div>
        </div>
        <CardContent className="p-0">
          {owed.length === 0 ? (
            <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              All invoices settled.
            </div>
          ) : (
            <div>
              {owed.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? "bg-orange-50/30 dark:bg-orange-950/10" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium">{entry.description ?? "Freelance work"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(entry.work_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-orange-700 dark:text-orange-300">
                      {formatPence(entry.gross_amount_pence, entry.currency)}
                    </p>
                    <StatusBadge entry={entry} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: Full log ── */}
      <Card className="overflow-hidden">
        <div className="border-l-4 border-blue-500 bg-blue-50/40 px-5 py-3 dark:bg-blue-950/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <p className="font-semibold">Full gig log</p>
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
                      className="h-6 border-blue-300 text-xs text-blue-700 hover:bg-blue-50"
                      onClick={() => openFromBooking(b)}
                    >
                      {b.job_title}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                data-help="books.earnings.addGig"
                size="sm"
                className="h-7 text-xs"
                onClick={openAdd}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add gig
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
          {entries.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-1 font-medium text-muted-foreground">No entries yet</p>
              <p className="text-sm text-muted-foreground">
                Add a gig manually, or use &ldquo;Sync&rdquo; to import completed EventLink
                bookings.
              </p>
              <Button className="mt-4" size="sm" onClick={openAdd}>
                <Plus className="mr-1 h-3 w-3" />
                Add your first gig
              </Button>
            </div>
          ) : (
            <div>
              {entries
                .slice()
                .sort((a, b) => b.work_date.localeCompare(a.work_date))
                .map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-5 py-3 ${
                      entry.needs_review
                        ? "border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                        : i % 2 === 0
                          ? "bg-muted/30"
                          : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {entry.description ?? "Freelance work"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(entry.work_date)}
                        {entry.client_name ? ` · ${entry.client_name}` : ""}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <StatusBadge entry={entry} />
                      <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                        {entry.needs_review
                          ? "—"
                          : formatPence(entry.gross_amount_pence, entry.currency)}
                      </span>
                      <button
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        title="Edit"
                        onClick={() => openEdit(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {entry.source === "manual" && (
                        <button
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          title="Remove"
                          onClick={() => archiveMutation.mutate(entry.id)}
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

      <GigDialog
        open={gigDialogOpen}
        onClose={() => {
          setGigDialogOpen(false);
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
    </div>
  );
}
