import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
import {
  FileText,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  Archive,
  Send,
  Settings,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

// ── Downloads (auth-aware) ────────────────────────────────────────────────────

async function downloadBlankTemplate(format: "pdf" | "doc", prefix: string) {
  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(
      `/api/billing-profile/blank-template?format=${format}&token=${token ?? ""}`,
      {
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-template-${prefix}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert("Could not download template. Please try again.");
  }
}

async function downloadInvoicePDF(invoiceId: number, invoiceNumber: string) {
  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`PDF download failed (${res.status}): ${body}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Could not download PDF. Please try again.");
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: number;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  total_pence: number;
  issue_date: string;
  due_date: string;
  to_details: {
    name?: string;
    company?: string;
    email?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    postcode?: string;
    country?: string;
  } | null;
  from_details: { name?: string } | null;
  line_items: LineItem[] | null;
  notes: string | null;
  booking_id: number | null;
  archived: boolean;
}

type RateType = "hour" | "day" | "ot" | "special" | "flat";

interface LineItem {
  description: string;
  rate_type: RateType;
  quantity: number;
  unit_price_pence: number;
}

interface BillingProfile {
  id: number;
  trading_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  utr: string | null;
  company_number: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  logo_url: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  payment_terms_days: number;
  invoice_prefix: string;
  invoice_footer_note: string | null;
}

interface HiredBooking {
  booking: {
    id: number;
    jobId: number;
    employerId: number;
    status: string;
    agreedRate: string | null;
  };
  job: {
    id: number;
    title: string;
    eventDate: string | null;
  };
  employer: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
  };
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

const RATE_TYPE_LABELS: Record<RateType, string> = {
  hour: "Hour",
  day: "Day",
  ot: "OT",
  special: "Special",
  flat: "Flat",
};

function emptyLine(): LineItem {
  return { description: "", rate_type: "day", quantity: 1, unit_price_pence: 0 };
}

// ── Billing Profile Modal ─────────────────────────────────────────────────────

const EMPTY_BILLING_FORM = {
  trading_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  email: "",
  utr: "",
  company_number: "",
  vat_registered: "false",
  vat_number: "",
  logo_url: "",
  bank_account_name: "",
  bank_sort_code: "",
  bank_account_number: "",
  bank_iban: "",
  payment_terms_days: "30",
  invoice_prefix: "INV",
  invoice_footer_note: "",
};

function BillingProfileModal({
  open,
  onClose,
  onSaved,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: BillingProfile | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_BILLING_FORM);

  // Pre-populate from existing profile when modal opens
  useState(() => {
    if (existing) {
      setForm({
        trading_name: existing.trading_name ?? "",
        address_line1: existing.address_line1 ?? "",
        address_line2: existing.address_line2 ?? "",
        city: existing.city ?? "",
        postcode: existing.postcode ?? "",
        country: existing.country ?? "",
        phone: existing.phone ?? "",
        email: existing.email ?? "",
        utr: existing.utr ?? "",
        company_number: existing.company_number ?? "",
        vat_registered: existing.vat_registered ? "true" : "false",
        vat_number: existing.vat_number ?? "",
        logo_url: existing.logo_url ?? "",
        bank_account_name: existing.bank_account_name ?? "",
        bank_sort_code: existing.bank_sort_code ?? "",
        bank_account_number: existing.bank_account_number ?? "",
        bank_iban: existing.bank_iban ?? "",
        payment_terms_days: String(existing.payment_terms_days ?? 30),
        invoice_prefix: existing.invoice_prefix ?? "INV",
        invoice_footer_note: existing.invoice_footer_note ?? "",
      });
    }
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/billing-profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          payment_terms_days: parseInt(form.payment_terms_days) || 30,
          vat_registered: form.vat_registered === "true",
          vat_number: form.vat_number || null,
          logo_url: form.logo_url || null,
          invoice_footer_note: form.invoice_footer_note || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-profile"] });
      toast({ title: "Invoice settings saved" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isVat = form.vat_registered === "true";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice settings</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Your legal details — shown on every invoice you generate. Set these once and they
          auto-fill.
        </p>

        {/* ── Trading identity ── */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trading identity
          </p>
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
              <Label>Company number</Label>
              <Input
                value={form.company_number}
                onChange={(e) => set("company_number", e.target.value)}
                placeholder="12345678"
              />
            </div>
            <div>
              <Label>UTR (sole trader)</Label>
              <Input
                value={form.utr}
                onChange={(e) => set("utr", e.target.value)}
                placeholder="1234567890"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>VAT registered?</Label>
              <Select value={form.vat_registered} onValueChange={(v) => set("vat_registered", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isVat && (
              <div>
                <Label>VAT number</Label>
                <Input
                  value={form.vat_number}
                  onChange={(e) => set("vat_number", e.target.value)}
                  placeholder="GB123456789"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Address ── */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Address
          </p>
          <div>
            <Label>Address line 1</Label>
            <Input
              value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)}
              placeholder="123 High Street"
            />
          </div>
          <div>
            <Label>Address line 2</Label>
            <Input
              value={form.address_line2}
              onChange={(e) => set("address_line2", e.target.value)}
              placeholder="Suite 4"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="London"
              />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input
                value={form.postcode}
                onChange={(e) => set("postcode", e.target.value)}
                placeholder="SW1A 1AA"
              />
            </div>
          </div>
          <div>
            <Label>Country</Label>
            <Input
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="United Kingdom"
            />
          </div>
        </div>

        {/* ── Contact ── */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email on invoice</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+44 7700 900000"
              />
            </div>
          </div>
        </div>

        {/* ── Banking ── */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bank details
          </p>
          <div>
            <Label>Account name</Label>
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
          <div>
            <Label>IBAN (international)</Label>
            <Input
              value={form.bank_iban}
              onChange={(e) => set("bank_iban", e.target.value)}
              placeholder="GB29 NWBK 6016 1331 9268 19"
            />
          </div>
        </div>

        {/* ── Invoice settings ── */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invoice settings
          </p>
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
                max={365}
              />
            </div>
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://example.com/logo.png"
              type="url"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Paste a direct link to your logo image — it will appear at the top of your
              invoices and templates.
            </p>
            {form.logo_url && (
              <img
                src={form.logo_url}
                alt="Logo preview"
                className="mt-2 max-h-12 rounded border border-border object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>
          <div>
            <Label>Footer note</Label>
            <Textarea
              value={form.invoice_footer_note}
              onChange={(e) => set("invoice_footer_note", e.target.value)}
              placeholder="e.g. Please quote invoice number on your bank transfer."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save settings
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

  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(
    invoice.booking_id ?? null
  );

  const { data: hiredBookings = [] } = useQuery<HiredBooking[]>({
    queryKey: ["/api/bookings/freelancer"],
  });

  const [toDetails, setToDetails] = useState({
    name: invoice.to_details?.name ?? "",
    company: invoice.to_details?.company ?? "",
    email: invoice.to_details?.email ?? "",
    address_line1: invoice.to_details?.address_line1 ?? "",
    address_line2: invoice.to_details?.address_line2 ?? "",
    city: invoice.to_details?.city ?? "",
    postcode: invoice.to_details?.postcode ?? "",
    country: invoice.to_details?.country ?? "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>(
    invoice.line_items?.length ? invoice.line_items : [emptyLine()]
  );
  // Raw strings for unit price inputs — lets users type freely; committed to pence on blur
  const [priceInputs, setPriceInputs] = useState<string[]>(
    (invoice.line_items?.length ? invoice.line_items : [emptyLine()]).map((li) =>
      penceToPounds(li.unit_price_pence)
    )
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
          booking_id: selectedBookingId,
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

  const updateLine = (i: number, field: "description" | "quantity" | "rate_type", raw: string) => {
    setLineItems((prev) =>
      prev.map((li, idx) => {
        if (idx !== i) return li;
        if (field === "description") return { ...li, description: raw };
        if (field === "quantity") return { ...li, quantity: parseFloat(raw) || 0 };
        if (field === "rate_type") return { ...li, rate_type: raw as RateType };
        return li;
      })
    );
  };

  const updatePriceInput = (i: number, raw: string) => {
    setPriceInputs((prev) => prev.map((v, idx) => (idx === i ? raw : v)));
  };

  const commitPrice = (i: number) => {
    const pence = poundsToPence(priceInputs[i]);
    setLineItems((prev) =>
      prev.map((li, idx) => (idx === i ? { ...li, unit_price_pence: pence } : li))
    );
    // Normalise display to 2 decimal places on blur
    setPriceInputs((prev) => prev.map((v, idx) => (idx === i ? penceToPounds(pence) : v)));
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, emptyLine()]);
    setPriceInputs((prev) => [...prev, "0.00"]);
  };

  const removeLine = (i: number) => {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
    setPriceInputs((prev) => prev.filter((_, idx) => idx !== i));
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
          {/* Link to booking */}
          {invoice.status === "draft" && hiredBookings.length > 0 && (
            <div>
              <p data-help="books.invoices.linkJob" className="mb-2 text-sm font-medium">
                Linked job
              </p>
              <Select
                value={selectedBookingId?.toString() ?? "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setSelectedBookingId(null);
                    return;
                  }
                  const id = parseInt(val);
                  setSelectedBookingId(id);
                  const hit = hiredBookings.find((b) => b.booking.id === id);
                  if (hit) {
                    const name =
                      `${hit.employer.firstName ?? ""} ${hit.employer.lastName ?? ""}`.trim();
                    setToDetails((d) => ({
                      ...d,
                      name,
                      company: hit.employer.companyName ?? "",
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job to link…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No job linked —</SelectItem>
                  {hiredBookings.map((b) => (
                    <SelectItem key={b.booking.id} value={b.booking.id.toString()}>
                      {b.job.title}
                      {b.employer.companyName ? ` · ${b.employer.companyName}` : ""}
                      {b.job.eventDate ? ` (${b.job.eventDate.slice(0, 10)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Linking a job lets you send this invoice directly to the employer via EventLink
                messages.
              </p>
            </div>
          )}

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
              <div className="col-span-2">
                <Label>Address line 1</Label>
                <Input
                  value={toDetails.address_line1}
                  onChange={(e) => setToDetails((d) => ({ ...d, address_line1: e.target.value }))}
                  placeholder="123 High Street"
                  disabled={invoice.status !== "draft"}
                />
              </div>
              <div className="col-span-2">
                <Label>Address line 2</Label>
                <Input
                  value={toDetails.address_line2}
                  onChange={(e) => setToDetails((d) => ({ ...d, address_line2: e.target.value }))}
                  placeholder="Suite 4"
                  disabled={invoice.status !== "draft"}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={toDetails.city}
                  onChange={(e) => setToDetails((d) => ({ ...d, city: e.target.value }))}
                  placeholder="London"
                  disabled={invoice.status !== "draft"}
                />
              </div>
              <div>
                <Label>Postcode</Label>
                <Input
                  value={toDetails.postcode}
                  onChange={(e) => setToDetails((d) => ({ ...d, postcode: e.target.value }))}
                  placeholder="EC1A 1BB"
                  disabled={invoice.status !== "draft"}
                />
              </div>
              <div className="col-span-2">
                <Label>Country</Label>
                <Input
                  value={toDetails.country}
                  onChange={(e) => setToDetails((d) => ({ ...d, country: e.target.value }))}
                  placeholder="United Kingdom"
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
                  <div className="col-span-5">
                    {i === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">
                        Description
                      </Label>
                    )}
                    <Input
                      value={li.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="e.g. Photography shoot"
                      disabled={invoice.status !== "draft"}
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">Rate</Label>
                    )}
                    <Select
                      value={li.rate_type ?? "day"}
                      onValueChange={(v) => updateLine(i, "rate_type", v)}
                      disabled={invoice.status !== "draft"}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RATE_TYPE_LABELS) as RateType[]).map((k) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            {RATE_TYPE_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="col-span-2">
                    {i === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">
                        Unit price (£)
                      </Label>
                    )}
                    <Input
                      value={priceInputs[i] ?? ""}
                      onChange={(e) => updatePriceInput(i, e.target.value)}
                      onBlur={() => commitPrice(i)}
                      placeholder="0.00"
                      disabled={invoice.status !== "draft"}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {i === 0 && <div className="mb-1 h-4" />}
                    {invoice.status === "draft" && (
                      <button
                        onClick={() => removeLine(i)}
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
              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={addLine}>
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
          <Button
            variant="outline"
            size="sm"
            className="mr-auto gap-2"
            onClick={() => downloadInvoicePDF(invoice.id, invoice.invoice_number)}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
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
  onDelete,
  onArchive,
  onSend,
}: {
  invoice: Invoice;
  onMarkPaid: (id: number) => void;
  onOpen: (inv: Invoice) => void;
  onDelete: (id: number) => void;
  onArchive: (id: number) => void;
  onSend: (inv: Invoice) => void;
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
      <td className="hidden px-4 py-3 text-sm sm:table-cell">{invoice.due_date}</td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[invoice.status]}`}
        >
          {invoice.status === "overdue" && <AlertTriangle className="h-3 w-3" />}
          {invoice.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            data-help="books.invoices.download"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Download PDF"
            onClick={() => downloadInvoicePDF(invoice.id, invoice.invoice_number)}
          >
            <Download className="h-4 w-4" />
          </button>
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button
              data-help="books.invoices.markPaid"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onMarkPaid(invoice.id)}
            >
              Mark paid
            </Button>
          )}
          {(invoice.status === "sent" ||
            invoice.status === "overdue" ||
            invoice.status === "paid") && (
            <button
              onClick={() => onArchive(invoice.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          {invoice.status === "draft" && (
            <Button
              data-help="books.invoices.send"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onSend(invoice)}
            >
              <Send className="mr-1 h-3 w-3" />
              Send
            </Button>
          )}
          {invoice.status === "draft" && (
            <button
              onClick={() => onDelete(invoice.id)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              title="Delete draft"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export interface InvoicePrefill {
  bookingId: number | null;
  toName: string;
  toCompany: string;
  lineDescription: string;
  ratePence: number | null;
  issueDate: string;
}

export function InvoicesTab({ prefillBooking }: { prefillBooking?: InvoicePrefill }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showBillingSetup, setShowBillingSetup] = useState(false);
  const [showBillingEdit, setShowBillingEdit] = useState(false);
  const prefillHandled = useRef(false);
  const [sendingInvoice, setSendingInvoice] = useState<Invoice | null>(null);
  const [sendMessage, setSendMessage] = useState("");
  const [sendRecipientEmployerId, setSendRecipientEmployerId] = useState<number | null>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: hiredBookings = [] } = useQuery<HiredBooking[]>({
    queryKey: ["/api/bookings/freelancer"],
    enabled: !!user,
  });

  type LegacyBooking = {
    id: number;
    job_id?: number;
    recruiter_id?: number;
    job_title: string;
    company_name?: string;
    event_date?: string;
  };
  const { data: legacyBookings = [] } = useQuery<LegacyBooking[]>({
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

  // Unified list of jobs the user can send an invoice to
  const sendOptions = (() => {
    const opts: Array<{
      key: string;
      jobTitle: string;
      companyName: string | null;
      employerUserId: number;
    }> = [];
    for (const b of hiredBookings) {
      opts.push({
        key: `new-${b.booking.id}`,
        jobTitle: b.job.title,
        companyName: b.employer.companyName,
        employerUserId: b.booking.employerId,
      });
    }
    // Add legacy bookings whose recruiter isn't already covered
    const coveredEmployerIds = new Set(hiredBookings.map((b) => b.booking.employerId));
    for (const b of legacyBookings) {
      if (b.recruiter_id && !coveredEmployerIds.has(b.recruiter_id)) {
        opts.push({
          key: `legacy-${b.id}`,
          jobTitle: b.job_title,
          companyName: b.company_name ?? null,
          employerUserId: b.recruiter_id,
        });
        coveredEmployerIds.add(b.recruiter_id);
      }
    }
    return opts;
  })();

  const { data: billingProfile } = useQuery<BillingProfile | null>({
    queryKey: ["/api/billing-profile"],
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/invoices/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked as paid" });
    },
    onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Draft deleted" });
    },
    onError: () => toast({ title: "Failed to delete invoice", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/invoices/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice archived" });
    },
    onError: () => toast({ title: "Failed to archive invoice", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: ({
      id,
      message,
      recipientUserId,
    }: {
      id: number;
      message: string;
      recipientUserId?: number;
    }) =>
      apiRequest(`/api/invoices/${id}/send-message`, {
        method: "POST",
        body: JSON.stringify({
          message,
          ...(recipientUserId ? { recipient_user_id: recipientUserId } : {}),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice sent via message" });
      setSendingInvoice(null);
      setSendMessage("");
      setSendRecipientEmployerId(null);
    },
    onError: () => toast({ title: "Failed to send invoice", variant: "destructive" }),
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

  // Auto-create and open a pre-filled invoice when navigated here from a booking
  useEffect(() => {
    if (!prefillBooking || prefillHandled.current || !billingProfile) return;
    prefillHandled.current = true;
    (async () => {
      try {
        const inv: Invoice = await apiRequest("/api/invoices", { method: "POST" });
        const patch: Record<string, unknown> = {
          to_details: { name: prefillBooking.toName, company: prefillBooking.toCompany },
          issue_date: prefillBooking.issueDate || new Date().toISOString().slice(0, 10),
        };
        if (prefillBooking.bookingId) patch.booking_id = prefillBooking.bookingId;
        if (prefillBooking.lineDescription || prefillBooking.ratePence) {
          patch.line_items = [
            {
              description: prefillBooking.lineDescription || "Services",
              rate_type: "flat",
              quantity: 1,
              unit_price_pence: prefillBooking.ratePence ?? 0,
            },
          ];
          patch.subtotal_pence = prefillBooking.ratePence ?? 0;
          patch.total_pence = prefillBooking.ratePence ?? 0;
        }
        const patched: Invoice = await apiRequest(`/api/invoices/${inv.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        setEditingInvoice(patched);
      } catch {
        toast({ title: "Could not create invoice", variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillBooking, billingProfile]);

  const handleNewInvoice = () => {
    if (!billingProfile) {
      setShowBillingSetup(true);
    } else {
      createMutation.mutate();
    }
  };

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

  const activeInvoices = invoices.filter((i) => !i.archived);
  const archivedInvoices = invoices.filter((i) => i.archived);

  const filtered =
    statusFilter === "all"
      ? activeInvoices
      : activeInvoices.filter((i) => i.status === statusFilter);

  // Group archived invoices by client name; no client name + no booking → "External"
  const archivedGroups: Record<string, Invoice[]> = {};
  for (const inv of archivedInvoices) {
    const key =
      inv.to_details?.company ||
      inv.to_details?.name ||
      (inv.booking_id ? "Unknown client" : "External");
    if (!archivedGroups[key]) archivedGroups[key] = [];
    archivedGroups[key].push(inv);
  }

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
      <div className="flex flex-wrap items-center gap-2">
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
            data-help="books.invoices.settings"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowBillingEdit(true)}
          >
            <Settings className="h-4 w-4" />
            Invoice settings
          </Button>
          {billingProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  Template
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    downloadBlankTemplate("pdf", billingProfile.invoice_prefix ?? "INV")
                  }
                >
                  Download as PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    downloadBlankTemplate("doc", billingProfile.invoice_prefix ?? "INV")
                  }
                >
                  Download as Word (.doc)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const token = localStorage.getItem("auth_token");
              window.open(`/api/invoices/export?token=${token ?? ""}`, "_blank");
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            data-help="books.invoices.new"
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
                <th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
                  Due
                </th>
                <th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
                  Status
                </th>
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
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onArchive={(id) => archiveMutation.mutate(id)}
                  onSend={(inv) => {
                    setSendingInvoice(inv);
                    setSendMessage("");
                    setSendRecipientEmployerId(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archive */}
      {archivedInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              Archive ({archivedInvoices.length})
            </p>
          </div>
          {Object.entries(archivedGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([client, invs]) => (
              <div key={client} className="rounded-md border">
                <div className="border-b bg-muted/30 px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {client}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {invs.map((inv) => {
                      const clientLabel = inv.to_details?.company || inv.to_details?.name || "—";
                      return (
                        <tr
                          key={inv.id}
                          className="border-b transition-colors last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-2 font-mono text-xs">
                            <button
                              className="text-primary hover:underline"
                              onClick={() => setEditingInvoice(inv)}
                            >
                              {inv.invoice_number}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{clientLabel}</td>
                          <td className="px-4 py-2 text-right text-xs tabular-nums">
                            {penceToGBP(inv.total_pence)}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {inv.issue_date}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[inv.status]}`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              className="text-muted-foreground transition-colors hover:text-foreground"
                              title="Download PDF"
                              onClick={() => downloadInvoicePDF(inv.id, inv.invoice_number)}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
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
        existing={billingProfile}
      />
      <BillingProfileModal
        open={showBillingEdit}
        onClose={() => setShowBillingEdit(false)}
        onSaved={() => setShowBillingEdit(false)}
        existing={billingProfile}
      />

      {editingInvoice && (
        <InvoiceEditModal invoice={editingInvoice} onClose={() => setEditingInvoice(null)} />
      )}

      {/* Send via message dialog */}
      <Dialog
        open={!!sendingInvoice}
        onOpenChange={(o) => {
          if (!o) {
            setSendingInvoice(null);
            setSendRecipientEmployerId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send invoice via message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Invoice{" "}
              <span className="font-mono font-medium">{sendingInvoice?.invoice_number}</span> will
              be attached as a PDF in your conversation with the client.
            </p>
            {!sendingInvoice?.booking_id && (
              <div className="space-y-1">
                <Label>Send to</Label>
                <Select
                  value={sendRecipientEmployerId?.toString() ?? ""}
                  onValueChange={(val) => setSendRecipientEmployerId(parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a job / employer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sendOptions.map((opt) => (
                      <SelectItem key={opt.key} value={opt.employerUserId.toString()}>
                        {opt.jobTitle}
                        {opt.companyName ? ` · ${opt.companyName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="send-msg">Covering note</Label>
              <Textarea
                id="send-msg"
                rows={4}
                placeholder="Hi, please find your invoice attached…"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSendingInvoice(null);
                setSendRecipientEmployerId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !sendMessage.trim() ||
                sendMutation.isPending ||
                (!sendingInvoice?.booking_id && !sendRecipientEmployerId)
              }
              onClick={() => {
                if (!sendingInvoice) return;
                const recipientUserId = sendingInvoice.booking_id
                  ? undefined
                  : (sendRecipientEmployerId ?? undefined);
                sendMutation.mutate({
                  id: sendingInvoice.id,
                  message: sendMessage,
                  recipientUserId,
                });
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
