import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Zap, AlertTriangle, Download, Plus, Trash2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: number;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  total_pence: number;
  issue_date: string;
  due_date: string;
  to_details: { name?: string; company?: string; email?: string } | null;
  from_details: { name?: string } | null;
  line_items: LineItem[] | null;
  notes: string | null;
  booking_id: number | null;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price_pence: number;
}

interface BillingProfile {
  id: number;
  trading_name: string | null;
  invoice_prefix: string;
  payment_terms_days: number;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
}

interface InvoicesSummary {
  outstanding_pence: number;
  overdue_pence: number;
  paid_last_90_pence: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Invoice["status"], string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function penceToGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function poundsToPence(pounds: string): number {
  const n = parseFloat(pounds.replace(/[£,]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

function emptyLine(): LineItem {
  return { description: "", quantity: 1, unit_price_pence: 0 };
}

// ── Billing Profile Setup Modal ───────────────────────────────────────────────

function BillingProfileModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    trading_name: "",
    invoice_prefix: "INV",
    payment_terms_days: "30",
    bank_account_name: "",
    bank_sort_code: "",
    bank_account_number: "",
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/billing-profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          payment_terms_days: parseInt(form.payment_terms_days) || 30,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-profile"] });
      toast({ title: "Billing profile saved" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to save billing profile", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set up your billing profile</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This information appears on your invoices. You only need to do this once.
        </p>
        <div className="space-y-3 py-2">
          <div>
            <Label>Trading name / your name</Label>
            <Input
              value={form.trading_name}
              onChange={(e) => set("trading_name", e.target.value)}
              placeholder="Jane Smith Consulting"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice prefix</Label>
              <Input
                value={form.invoice_prefix}
                onChange={(e) => set("invoice_prefix", e.target.value)}
                placeholder="INV"
                maxLength={8}
              />
            </div>
            <div>
              <Label>Payment terms (days)</Label>
              <Input
                type="number"
                value={form.payment_terms_days}
                onChange={(e) => set("payment_terms_days", e.target.value)}
                min={0}
                max={90}
              />
            </div>
          </div>
          <div>
            <Label>Bank account name</Label>
            <Input
              value={form.bank_account_name}
              onChange={(e) => set("bank_account_name", e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sort code</Label>
              <Input
                value={form.bank_sort_code}
                onChange={(e) => set("bank_sort_code", e.target.value)}
                placeholder="12-34-56"
              />
            </div>
            <div>
              <Label>Account number</Label>
              <Input
                value={form.bank_account_number}
                onChange={(e) => set("bank_account_number", e.target.value)}
                placeholder="12345678"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save &amp; continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice Edit Modal ────────────────────────────────────────────────────────

function InvoiceEditModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [toDetails, setToDetails] = useState({
    name: invoice.to_details?.name ?? "",
    company: invoice.to_details?.company ?? "",
    email: invoice.to_details?.email ?? "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>(
    invoice.line_items?.length ? invoice.line_items : [emptyLine()]
  );
  const [issueDate, setIssueDate] = useState(invoice.issue_date ?? "");
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");

  const subtotalPence = lineItems.reduce(
    (s, li) => s + Math.round(li.quantity * li.unit_price_pence),
    0
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          to_details: toDetails,
          line_items: lineItems,
          subtotal_pence: subtotalPence,
          total_pence: subtotalPence,
          issue_date: issueDate || undefined,
          due_date: dueDate || undefined,
          notes: notes || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice saved" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save invoice", variant: "destructive" }),
  });

  const updateLine = (i: number, field: keyof LineItem, raw: string) => {
    setLineItems((prev) =>
      prev.map((li, idx) => {
        if (idx !== i) return li;
        if (field === "description") return { ...li, description: raw };
        if (field === "quantity") return { ...li, quantity: parseFloat(raw) || 0 };
        if (field === "unit_price_pence") return { ...li, unit_price_pence: poundsToPence(raw) };
        return li;
      })
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Invoice {invoice.invoice_number}
            {invoice.status !== "draft" && (
              <span className="ml-2 text-sm font-normal capitalize text-muted-foreground">
                ({invoice.status})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Client details */}
          <div>
            <p className="mb-2 text-sm font-medium">Bill to</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={toDetails.name}
                  onChange={(e) => setToDetails((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Jane Smith"
                  disabled={invoice.status !== "draft"}
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  value={toDetails.company}
                  onChange={(e) => setToDetails((d) => ({ ...d, company: e.target.value }))}
                  placeholder="Acme Ltd"
                  disabled={invoice.status !== "draft"}
                />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={toDetails.email}
                  onChange={(e) => setToDetails((d) => ({ ...d, email: e.target.value }))}
                  placeholder="client@example.com"
                  disabled={invoice.status !== "draft"}
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                disabled={invoice.status !== "draft"}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={invoice.status !== "draft"}
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <p className="mb-2 text-sm font-medium">Line items</p>
            <div className="space-y-2">
              {lineItems.map((li, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6">
                    {i === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">
                        Description
                      </Label>
                    )}
                    <Input
                      value={li.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="e.g. Photography — 2-day shoot"
                      disabled={invoice.status !== "draft"}
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">Qty</Label>
                    )}
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={li.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      disabled={invoice.status !== "draft"}
                    />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">
                        Unit price (£)
                      </Label>
                    )}
                    <Input
                      value={penceToPounds(li.unit_price_pence)}
                      onChange={(e) => updateLine(i, "unit_price_pence", e.target.value)}
                      placeholder="0.00"
                      disabled={invoice.status !== "draft"}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {i === 0 && <div className="mb-1 h-4" />}
                    {invoice.status === "draft" && (
                      <button
                        onClick={() => setLineItems((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {invoice.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1"
                onClick={() => setLineItems((prev) => [...prev, emptyLine()])}
              >
                <Plus className="h-3 w-3" />
                Add line
              </Button>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <p className="text-lg font-semibold">Total: {penceToGBP(subtotalPence)}</p>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment reference, project notes…"
              disabled={invoice.status !== "draft"}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="mr-auto"
          >
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </a>
          <Button variant="outline" onClick={onClose}>
            {invoice.status === "draft" ? "Discard changes" : "Close"}
          </Button>
          {invoice.status === "draft" && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Save invoice
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onMarkPaid,
  onOpen,
}: {
  invoice: Invoice;
  onMarkPaid: (id: number) => void;
  onOpen: (inv: Invoice) => void;
}) {
  const clientName = invoice.to_details?.company || invoice.to_details?.name || "—";

  return (
    <tr className="border-b transition-colors last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-mono text-sm">
        <button className="text-primary hover:underline" onClick={() => onOpen(invoice)}>
          {invoice.invoice_number}
        </button>
      </td>
      <td className="px-4 py-3 text-sm">{clientName}</td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">
        {penceToGBP(invoice.total_pence)}
      </td>
      <td className="px-4 py-3 text-sm">{invoice.issue_date}</td>
      <td className="px-4 py-3 text-sm">{invoice.due_date}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[invoice.status]}`}
        >
          {invoice.status === "overdue" && <AlertTriangle className="h-3 w-3" />}
          {invoice.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </a>
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onMarkPaid(invoice.id)}
            >
              Mark paid
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function InvoicesTab({ isPro }: { isPro: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showBillingSetup, setShowBillingSetup] = useState(false);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    enabled: isPro,
  });

  const { data: billingProfile } = useQuery<BillingProfile | null>({
    queryKey: ["/api/billing-profile"],
    enabled: isPro,
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/invoices/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked as paid" });
    },
    onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("/api/invoices", { method: "POST" }),
    onSuccess: (inv: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setEditingInvoice(inv);
    },
    onError: (err: any) => {
      const msg: string = err?.message ?? "";
      if (msg.includes("billing profile") || msg.includes("NO_BILLING_PROFILE")) {
        setShowBillingSetup(true);
      } else {
        toast({ title: "Could not create invoice", variant: "destructive" });
      }
    },
  });

  const handleNewInvoice = () => {
    if (!billingProfile) {
      setShowBillingSetup(true);
    } else {
      createMutation.mutate();
    }
  };

  if (!isPro) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Invoices — Pro feature</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Generate invoices for any job — on or off the platform — chase late payments, and
              export records.
            </p>
          </div>
          <Button className="gap-2" onClick={() => (window.location.href = "/upgrade")}>
            <Zap className="h-4 w-4" />
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Compute summary
  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);

  const summary: InvoicesSummary = invoices.reduce(
    (acc, inv) => {
      if (inv.status === "sent") acc.outstanding_pence += inv.total_pence;
      if (inv.status === "overdue") {
        acc.outstanding_pence += inv.total_pence;
        acc.overdue_pence += inv.total_pence;
      }
      if (inv.status === "paid" && new Date(inv.issue_date) >= ninetyDaysAgo) {
        acc.paid_last_90_pence += inv.total_pence;
      }
      return acc;
    },
    { outstanding_pence: 0, overdue_pence: 0, paid_last_90_pence: 0 }
  );

  const filtered =
    statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {penceToGBP(summary.outstanding_pence)}
            </p>
          </CardContent>
        </Card>
        <Card className={summary.overdue_pence > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${summary.overdue_pence > 0 ? "text-red-600" : ""}`}
            >
              {penceToGBP(summary.overdue_pence)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Paid (last 90 days)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-green-600">
              {penceToGBP(summary.paid_last_90_pence)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open("/api/invoices/export", "_blank")}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleNewInvoice}
            disabled={createMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            New invoice
          </Button>
        </div>
      </div>

      {/* Invoice table */}
      {isLoading ? (
        <div className="flex justify-center py-8 text-muted-foreground">Loading invoices…</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "all" ? "No invoices yet." : `No ${statusFilter} invoices.`}
            </p>
            <p className="text-xs text-muted-foreground">
              Create a new invoice above, or use the Create invoice button on any completed booking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Number</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Issued</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Due</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onMarkPaid={(id) => markPaidMutation.mutate(id)}
                  onOpen={setEditingInvoice}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <BillingProfileModal
        open={showBillingSetup}
        onClose={() => setShowBillingSetup(false)}
        onSaved={() => {
          setShowBillingSetup(false);
          createMutation.mutate();
        }}
      />

      {editingInvoice && (
        <InvoiceEditModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} />
      )}
    </div>
  );
}
