import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Plus, Trash2, Send, Receipt, Pencil, Save, CheckCircle, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  eventName: string | null;
  eventDate: string | null;
  invoiceNumber_: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number | null;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  paidAt: string | null;
  quoteId: number | null;
  bookingId: number | null;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (pence: number | null | undefined) =>
  `£${((pence ?? 0) / 100).toFixed(2)}`;

const parsePounds = (v: string) => Math.round(parseFloat(v || "0") * 100);

const STATUS_STYLES: Record<Invoice["status"], string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-400",
};

const DEFAULT_TERMS = `Payment due within 30 days.
Bank transfer preferred. BACS details available on request.
Late payment interest may apply under the Late Payment of Commercial Debts Act 1998.`;

const today = () => new Date().toISOString().split("T")[0];
const in30days = () =>
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

// ── Line Editor ────────────────────────────────────────────────────────────

function LineEditor({ lines, onChange }: { lines: LineItem[]; onChange: (l: LineItem[]) => void }) {
  const add = () =>
    onChange([...lines, { description: "", quantity: 1, unitPrice: 0, total: 0, sortOrder: lines.length }]);

  const update = (i: number, field: keyof LineItem, raw: string) => {
    const updated = lines.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l };
      if (field === "description") next.description = raw;
      else if (field === "quantity") next.quantity = parseInt(raw || "1");
      else if (field === "unitPrice") next.unitPrice = parsePounds(raw);
      next.total = next.quantity * next.unitPrice;
      return next;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-12 gap-1 items-center">
          <input
            className="col-span-6 border rounded px-2 py-1 text-sm"
            placeholder="Description"
            value={line.description}
            onChange={(e) => update(i, "description", e.target.value)}
          />
          <input
            className="col-span-2 border rounded px-2 py-1 text-sm text-right"
            type="number" min={1} placeholder="Qty"
            value={line.quantity}
            onChange={(e) => update(i, "quantity", e.target.value)}
          />
          <input
            className="col-span-2 border rounded px-2 py-1 text-sm text-right"
            placeholder="£/unit"
            value={line.unitPrice > 0 ? (line.unitPrice / 100).toFixed(2) : ""}
            onChange={(e) => update(i, "unitPrice", e.target.value)}
          />
          <div className="col-span-1 text-right text-sm font-medium text-gray-700">{fmt(line.total)}</div>
          <button onClick={() => onChange(lines.filter((_, x) => x !== i))}
            className="col-span-1 flex justify-center text-red-400 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
        <Plus className="h-4 w-4" /> Add line
      </button>
    </div>
  );
}

// ── Invoice Form ───────────────────────────────────────────────────────────

interface InvoiceFormData {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientAddress: string;
  eventName: string;
  eventDate: string;
  issueDate: string;
  dueDate: string;
  vatRate: number;
  notes: string;
  terms: string;
  lines: LineItem[];
}

const emptyForm = (): InvoiceFormData => ({
  clientName: "",
  clientEmail: "",
  clientCompany: "",
  clientAddress: "",
  eventName: "",
  eventDate: "",
  issueDate: today(),
  dueDate: in30days(),
  vatRate: 20,
  notes: "",
  terms: DEFAULT_TERMS,
  lines: [{ description: "", quantity: 1, unitPrice: 0, total: 0, sortOrder: 0 }],
});

function invoiceToForm(inv: Invoice, lines: LineItem[]): InvoiceFormData {
  return {
    clientName: inv.clientName,
    clientEmail: inv.clientEmail ?? "",
    clientCompany: inv.clientCompany ?? "",
    clientAddress: inv.clientAddress ?? "",
    eventName: inv.eventName ?? "",
    eventDate: inv.eventDate ?? "",
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    vatRate: inv.vatRate,
    notes: inv.notes ?? "",
    terms: inv.terms ?? DEFAULT_TERMS,
    lines,
  };
}

function totalsFromForm(form: InvoiceFormData) {
  const subtotal = form.lines.reduce((s, l) => s + l.total, 0);
  const vatAmount = Math.round((subtotal * form.vatRate) / 100);
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

// ── Invoice Row ────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onEdit,
  onSend,
  onMarkPaid,
  onDelete,
}: {
  invoice: Invoice;
  onEdit: () => void;
  onSend: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  const isOverdue =
    invoice.status === "sent" &&
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
      <Receipt className="h-5 w-5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{invoice.invoiceNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOverdue ? "bg-red-100 text-red-600" : STATUS_STYLES[invoice.status]}`}>
            {isOverdue ? "Overdue" : invoice.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate">
          {invoice.clientName}
          {invoice.clientCompany && ` · ${invoice.clientCompany}`}
          {invoice.eventName && ` · ${invoice.eventName}`}
        </p>
        <p className="text-xs text-gray-400">
          {fmt(invoice.total)} · Due: {invoice.dueDate && format(new Date(invoice.dueDate), "d MMM yyyy")}
          {invoice.quoteId && <span className="ml-1 text-blue-400">(from quote)</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {invoice.status === "draft" && (
          <>
            <button onClick={onEdit} title="Edit" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onSend} title="Mark as sent" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
              <Send className="h-4 w-4" />
            </button>
          </>
        )}
        {(invoice.status === "sent" || isOverdue) && (
          <button
            onClick={onMarkPaid}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <CheckCircle className="h-3 w-3" /> Paid
          </button>
        )}
        <button onClick={onDelete} title="Delete" className="p-1.5 text-gray-400 hover:text-red-500 rounded">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export function InvoicePanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InvoiceFormData>(emptyForm());

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/fms/invoices"],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/fms/invoices"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/fms/invoices", data),
    onSuccess: () => { invalidate(); resetForm(); toast({ title: "Invoice created" }); },
    onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/fms/invoices/${id}`, data),
    onSuccess: () => { invalidate(); resetForm(); toast({ title: "Invoice updated" }); },
    onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/fms/invoices/${id}/send`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Invoice marked as sent" }); },
  });

  const paidMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/fms/invoices/${id}/paid`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Invoice marked as paid" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/fms/invoices/${id}`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Invoice deleted" }); },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = async (invoice: Invoice) => {
    const res = await apiRequest("GET", `/api/fms/invoices/${invoice.id}`, undefined);
    const data = await res.json();
    setForm(invoiceToForm(data.invoice, data.lines));
    setEditingId(invoice.id);
    setShowForm(true);
  };

  const submit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const totals = totalsFromForm(form);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Aggregate stats
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.total, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-500">Track payments and manage your invoices</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        )}
      </div>

      {/* Summary cards */}
      {invoices.length > 0 && !showForm && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-600 font-medium mb-0.5">Outstanding</p>
            <p className="text-xl font-bold text-amber-800">{fmt(outstanding)}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-600 font-medium mb-0.5">Received</p>
            <p className="text-xl font-bold text-green-800">{fmt(paid)}</p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editingId ? "Edit Invoice" : "New Invoice"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Email</label>
              <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Company</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.clientCompany}
                onChange={(e) => setForm({ ...form, clientCompany: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Address</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.clientAddress}
                onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event / Project</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.eventName}
                onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date *</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date *</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Line Items</h4>
            <div className="grid grid-cols-12 gap-1 mb-1 text-xs text-gray-400 font-medium">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit price</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>
            <LineEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} />
          </div>

          {/* VAT */}
          <div className="flex gap-3">
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">VAT Rate (%)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: parseInt(e.target.value || "20") })} />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1 text-right">
            <div className="text-gray-500">Subtotal: <span className="font-medium text-gray-900">{fmt(totals.subtotal)}</span></div>
            <div className="text-gray-500">VAT ({form.vatRate}%): <span className="font-medium text-gray-900">{fmt(totals.vatAmount)}</span></div>
            <div className="text-gray-800 font-bold text-base">Total: {fmt(totals.total)}</div>
          </div>

          {/* Notes / Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms</label>
              <textarea rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={isSaving || !form.clientName || !form.issueDate || !form.dueDate}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving…" : editingId ? "Update Invoice" : "Save Invoice"}
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No invoices yet. Create one above or convert an accepted quote.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              onEdit={() => startEdit(inv)}
              onSend={() => sendMutation.mutate(inv.id)}
              onMarkPaid={() => paidMutation.mutate(inv.id)}
              onDelete={() => deleteMutation.mutate(inv.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
