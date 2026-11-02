import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Download,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { KitTab } from "./KitTab";

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
}: {
  open: boolean;
  onClose: () => void;
  editing: EarningsEntry | null;
  clients: Array<{ id: number; name: string }>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GigForm>(EMPTY_FORM);

  // Reset form when dialog opens
  useState(() => {
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
        setForm(EMPTY_FORM);
      }
    }
  });

  const set = (k: keyof GigForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing
        ? apiRequest(`/api/earnings/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest("/api/earnings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
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

// ── Top-level tabs ─────────────────────────────────────────────────────────────

export function BooksTab() {
  const [section, setSection] = useState<"earnings" | "kit">("earnings");
  const [gigDialogOpen, setGigDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EarningsEntry | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<EarningsData>({
    queryKey: ["/api/earnings/summary"],
    queryFn: () => apiRequest("/api/earnings/summary").then((r) => r.json()),
  });

  const { data: clients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/earnings/clients"],
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
    mutationFn: () =>
      apiRequest("/api/earnings/backfill", { method: "POST" }).then((r) => r.json()),
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
    setGigDialogOpen(true);
  };
  const openEdit = (e: EarningsEntry) => {
    setEditingEntry(e);
    setGigDialogOpen(true);
  };

  const sectionSwitcher = (
    <div className="flex w-fit gap-1 rounded-md border p-1">
      <button
        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "earnings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setSection("earnings")}
      >
        Earnings
      </button>
      <button
        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${section === "kit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setSection("kit")}
      >
        Kit register
      </button>
    </div>
  );

  if (section === "kit") {
    return (
      <div className="space-y-4">
        {sectionSwitcher}
        <ExportCard />
        <KitTab />
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Tax year {tax_year.label}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {fmtDate(tax_year.from)} – {fmtDate(tax_year.to)} · cash basis
          </span>
        </CardHeader>
        <CardContent>
          {summary.entry_count === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No paid income recorded for this tax year yet.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Gross income</p>
                  <p className="text-2xl font-bold">{formatPence(summary.total_pence)}</p>
                </div>
                {summary.deductions_pence > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">After deductions</p>
                    <p className="text-2xl font-bold">{formatPence(netPence)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Gigs</p>
                  <p className="text-2xl font-bold">{summary.entry_count}</p>
                </div>
              </div>

              {/* Monthly breakdown */}
              {summary.groups.length > 0 && (
                <div className="space-y-1">
                  {summary.groups
                    .sort((a, b) => a.key.localeCompare(b.key))
                    .map((g) => (
                      <div key={g.key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{g.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {g.entry_count} gig{g.entry_count !== 1 ? "s" : ""}
                          </span>
                          <span className="font-medium tabular-nums">
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
            <p className="mt-3 text-xs text-amber-600">
              {summary.excluded.needs_review} entr
              {summary.excluded.needs_review === 1 ? "y" : "ies"} excluded — amount needs review.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Owed to me ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Owed to me
            {owed.length > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">
                {owed.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {owed.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              All invoices settled.
            </div>
          ) : (
            <div className="space-y-3">
              {owed.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{entry.description ?? "Freelance work"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(entry.work_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
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

      {/* ── Section 3: Full log ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Full gig log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1 h-3 w-3" />
              Add gig
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 h-3 w-3 ${backfillMutation.isPending ? "animate-spin" : ""}`}
              />
              Sync bookings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 font-medium text-muted-foreground">No entries yet</p>
              <p className="text-sm text-muted-foreground">
                Add a gig manually, or use &ldquo;Sync bookings&rdquo; to import completed EventLink
                bookings.
              </p>
              <Button className="mt-4" size="sm" onClick={openAdd}>
                <Plus className="mr-1 h-3 w-3" />
                Add your first gig
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {entries
                .slice()
                .sort((a, b) => b.work_date.localeCompare(a.work_date))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${entry.needs_review ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20" : ""}`}
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
                    <div className="ml-4 flex items-center gap-2">
                      <StatusBadge entry={entry} />
                      <span className="min-w-[72px] text-right text-sm font-medium tabular-nums">
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
        onClose={() => setGigDialogOpen(false)}
        editing={editingEntry}
        clients={clients}
      />
    </div>
  );
}
