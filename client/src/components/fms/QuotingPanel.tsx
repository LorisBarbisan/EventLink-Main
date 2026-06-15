import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Plus, Trash2, Send, FileText, ChevronDown, ChevronUp,
  Check, X, Copy, ArrowRight, Pencil, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number; // pence
  total: number;
  sortOrder: number;
}

interface Quote {
  id: number;
  quoteNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  eventName: string;
  eventDate: string | null;
  venueAddress: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  validUntil: string | null;
  currency: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  discount: number | null;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  bookingId: number | null;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (pence: number | null | undefined) =>
  `£${((pence ?? 0) / 100).toFixed(2)}`;

const parsePounds = (v: string) => Math.round(parseFloat(v || "0") * 100);

const STATUS_STYLES: Record<Quote["status"], string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-600",
  expired: "bg-amber-100 text-amber-700",
};

const DEFAULT_TERMS = `Payment is due within 30 days of invoice date.
This quote is valid for 30 days from the date issued.
All prices are exclusive of VAT unless stated otherwise.`;

// ── Line Item Editor ───────────────────────────────────────────────────────

function LineEditor({
  lines,
  onChange,
}: {
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
}) {
  const addLine = () =>
    onChange([
      ...lines,
      { description: "", quantity: 1, unitPrice: 0, total: 0, sortOrder: lines.length },
    ]);

  const updateLine = (i: number, field: keyof LineItem, raw: string) => {
    const updated = lines.map((l, idx) => {
      if (idx !== i) return l;
      const val = field === "description" ? raw : parsePounds(raw);
      const next = { ...l, [field]: field === "quantity" ? parseInt(raw || "1") : val };
      if (field === "quantity" || field === "unitPrice") {
        next.total = next.quantity * next.unitPrice;
      }
      return next;
    });
    onChange(updated);
  };

  const removeLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-12 gap-1 items-center">
          <input
            className="col-span-6 border rounded px-2 py-1 text-sm"
            placeholder="Description"
            value={line.description}
            onChange={(e) => updateLine(i, "description", e.target.value)}
          />
          <input
            className="col-span-2 border rounded px-2 py-1 text-sm text-right"
            placeholder="Qty"
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => updateLine(i, "quantity", e.target.value)}
          />
          <input
            className="col-span-2 border rounded px-2 py-1 text-sm text-right"
            placeholder="£/unit"
            value={line.unitPrice > 0 ? (line.unitPrice / 100).toFixed(2) : ""}
            onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
          />
          <div className="col-span-1 text-right text-sm text-gray-600 font-medium">
            {fmt(line.total)}
          </div>
          <button
            onClick={() => removeLine(i)}
            className="col-span-1 flex justify-center text-red-400 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addLine}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <Plus className="h-4 w-4" /> Add line
      </button>
    </div>
  );
}

// ── Quote Form ─────────────────────────────────────────────────────────────

interface QuoteFormData {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientAddress: string;
  eventName: string;
  eventDate: string;
  venueAddress: string;
  validUntil: string;
  vatRate: number;
  discount: string; // pounds string
  notes: string;
  terms: string;
  lines: LineItem[];
}

const emptyForm = (): QuoteFormData => ({
  clientName: "",
  clientEmail: "",
  clientCompany: "",
  clientAddress: "",
  eventName: "",
  eventDate: "",
  venueAddress: "",
  validUntil: "",
  vatRate: 20,
  discount: "",
  notes: "",
  terms: DEFAULT_TERMS,
  lines: [{ description: "", quantity: 1, unitPrice: 0, total: 0, sortOrder: 0 }],
});

function quoteToForm(q: Quote, lines: LineItem[]): QuoteFormData {
  return {
    clientName: q.clientName,
    clientEmail: q.clientEmail ?? "",
    clientCompany: q.clientCompany ?? "",
    clientAddress: q.clientAddress ?? "",
    eventName: q.eventName,
    eventDate: q.eventDate ?? "",
    venueAddress: q.venueAddress ?? "",
    validUntil: q.validUntil ?? "",
    vatRate: q.vatRate,
    discount: q.discount ? (q.discount / 100).toFixed(2) : "",
    notes: q.notes ?? "",
    terms: q.terms ?? DEFAULT_TERMS,
    lines,
  };
}

function totalsFromForm(form: QuoteFormData) {
  const subtotal =
    form.lines.reduce((s, l) => s + l.total, 0) - parsePounds(form.discount);
  const vatAmount = Math.round((subtotal * form.vatRate) / 100);
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

// ── Quote Row ──────────────────────────────────────────────────────────────

function QuoteRow({
  quote,
  onEdit,
  onSend,
  onConvert,
  onDelete,
}: {
  quote: Quote;
  onEdit: () => void;
  onSend: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
      <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{quote.quoteNumber}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[quote.status]}`}
          >
            {quote.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate">
          {quote.clientName}
          {quote.clientCompany && ` · ${quote.clientCompany}`}
          {" · "}
          {quote.eventName}
        </p>
        <p className="text-xs text-gray-400">
          {fmt(quote.total)} · {quote.createdAt && format(new Date(quote.createdAt), "d MMM yyyy")}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {quote.status === "draft" && (
          <>
            <button
              onClick={onEdit}
              title="Edit"
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onSend}
              title="Mark as sent"
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
            >
              <Send className="h-4 w-4" />
            </button>
          </>
        )}
        {quote.status === "accepted" && (
          <button
            onClick={onConvert}
            title="Convert to invoice"
            className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <ArrowRight className="h-3 w-3" /> Invoice
          </button>
        )}
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1.5 text-gray-400 hover:text-red-500 rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export function QuotingPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<QuoteFormData>(emptyForm());

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/fms/quotes"],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/fms/quotes"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/fms/quotes`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); resetForm(); toast({ title: "Quote created" }); },
    onError: () => toast({ title: "Failed to create quote", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/fms/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); resetForm(); toast({ title: "Quote updated" }); },
    onError: () => toast({ title: "Failed to update quote", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/fms/quotes/${id}/send`, { method: "POST" }),
    onSuccess: () => { invalidate(); toast({ title: "Quote marked as sent" }); },
  });

  const convertMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/fms/quotes/${id}/to-invoice`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["/api/fms/invoices"] });
      toast({ title: "Invoice created from quote" });
    },
    onError: () => toast({ title: "Failed to convert quote", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/fms/quotes/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Quote deleted" }); },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = async (quote: Quote) => {
    const data = await apiRequest(`/api/fms/quotes/${quote.id}`);
    setForm(quoteToForm(data.quote, data.lines));
    setEditingId(quote.id);
    setShowForm(true);
  };

  const submit = () => {
    const payload = {
      ...form,
      discount: parsePounds(form.discount),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totals = totalsFromForm(form);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Quotes</h2>
          <p className="text-sm text-gray-500">Create and send professional quotes to clients</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Quote
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editingId ? "Edit Quote" : "New Quote"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Email</label>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Company</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.clientCompany}
                onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Address</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.clientAddress}
                onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event / Project Name *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.eventName}
                onChange={(e) => setForm({ ...form, eventName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Date</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Venue / Location</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.venueAddress}
                onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
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
            <LineEditor
              lines={form.lines}
              onChange={(lines) => setForm({ ...form, lines })}
            />
          </div>

          {/* Financials */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">VAT Rate (%)</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: parseInt(e.target.value || "20") })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount (£)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
              />
            </div>
          </div>

          {/* Totals preview */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1 text-right">
            <div className="text-gray-500">Subtotal: <span className="font-medium text-gray-900">{fmt(totals.subtotal)}</span></div>
            <div className="text-gray-500">VAT ({form.vatRate}%): <span className="font-medium text-gray-900">{fmt(totals.vatAmount)}</span></div>
            <div className="text-gray-800 font-bold text-base">Total: {fmt(totals.total)}</div>
          </div>

          {/* Notes / Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Terms & Conditions</label>
              <textarea
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={isSaving || !form.clientName || !form.eventName}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving…" : editingId ? "Update Quote" : "Save Quote"}
            </button>
          </div>
        </div>
      )}

      {/* Quote list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No quotes yet. Create your first quote above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <QuoteRow
              key={q.id}
              quote={q}
              onEdit={() => startEdit(q)}
              onSend={() => sendMutation.mutate(q.id)}
              onConvert={() => convertMutation.mutate(q.id)}
              onDelete={() => deleteMutation.mutate(q.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
