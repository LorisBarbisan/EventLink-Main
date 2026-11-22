import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ArrowRight, Building2 } from "lucide-react";

/**
 * Who you are as a business: trading name, address, UTR, VAT. The same
 * record the invoice setup uses (freelancer_billing_profiles); this card
 * edits only these fields, and leaves bank details and invoice numbering to
 * the invoice setup. Saving sends only these fields, so neither screen can
 * blank the other's.
 */

interface BillingProfile {
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
  vat_rate_pct: number;
}

const TEXT_FIELDS = [
  "trading_name",
  "address_line1",
  "address_line2",
  "city",
  "postcode",
  "country",
  "phone",
  "email",
  "utr",
  "company_number",
] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Form = Record<TextField, string> & {
  vat_registered: boolean;
  vat_number: string;
  vat_rate_pct: string;
};

const EMPTY: Form = {
  trading_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
  phone: "",
  email: "",
  utr: "",
  company_number: "",
  vat_registered: false,
  vat_number: "",
  vat_rate_pct: "20",
};

function toForm(p: BillingProfile | null | undefined): Form {
  if (!p) return EMPTY;
  const f = { ...EMPTY };
  for (const k of TEXT_FIELDS) f[k] = p[k] ?? (k === "country" ? EMPTY.country : "");
  f.vat_registered = !!p.vat_registered;
  f.vat_number = p.vat_number ?? "";
  f.vat_rate_pct = String(p.vat_rate_pct ?? 20);
  return f;
}

/** Enough to raise an invoice: a name to put on it and an address. */
export function businessDetailsComplete(p: BillingProfile | null | undefined): boolean {
  return !!(p?.trading_name?.trim() && p.address_line1?.trim() && p.postcode?.trim());
}

const FIELDS: Array<{ key: TextField; label: string; help?: string; wide?: boolean }> = [
  { key: "trading_name", label: "Business or trading name", wide: true },
  { key: "address_line1", label: "Address line 1", wide: true },
  { key: "address_line2", label: "Address line 2", wide: true },
  { key: "city", label: "Town or city" },
  { key: "postcode", label: "Postcode" },
  { key: "country", label: "Country" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email for invoices" },
  { key: "utr", label: "UTR", help: "books.business.utr" },
  { key: "company_number", label: "Company number (if a limited company)" },
];

export function BusinessDetailsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery<BillingProfile | null>({
    queryKey: ["/api/billing-profile"],
    queryFn: () => apiRequest("/api/billing-profile"),
  });
  const [form, setForm] = useState<Form>(EMPTY);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) setForm(toForm(profile));
  }, [profile, isLoading]);

  const complete = businessDetailsComplete(profile);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const k of TEXT_FIELDS) body[k] = form[k].trim() || null;
      body.vat_registered = form.vat_registered;
      body.vat_number = form.vat_registered ? form.vat_number.trim() || null : null;
      body.vat_rate_pct = parseInt(form.vat_rate_pct, 10);
      return apiRequest("/api/billing-profile", { method: "PUT", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/billing-profile"] });
      // VAT registration changes the tax estimate's figures
      qc.invalidateQueries({ queryKey: ["/api/books/tax-estimate"] });
      toast({ title: "Business details saved" });
      setOpen(false);
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't save your details",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const set = (k: keyof Form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card
      className={cn(
        "overflow-hidden",
        // Until the details are in, this is the one thing to do on the page:
        // invoices can't be raised without them.
        !complete && !isLoading && "border-orange-300 shadow-md dark:border-orange-800"
      )}
    >
      {complete || isLoading ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-slate-500 bg-slate-50/50 px-5 py-3 dark:bg-slate-900/40">
          <div>
            <p data-help="books.business.details" className="font-semibold">
              Your business
            </p>
            <p className="text-xs text-muted-foreground">
              {complete
                ? [profile?.trading_name, profile?.postcode].filter(Boolean).join(" · ")
                : "Add your business details so invoices can be raised."}
            </p>
          </div>
          {!open && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={isLoading}>
              {complete ? "Edit" : "Add details"}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 border-l-4 border-orange-500 bg-orange-50 px-5 py-4 dark:bg-orange-950/30">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p data-help="books.business.details" className="text-base font-semibold">
              Add your business details
            </p>
            <p className="text-sm text-muted-foreground">
              Your trading name and address go on every invoice, so you can&rsquo;t raise one until
              they&rsquo;re here. It takes about two minutes.
            </p>
          </div>
          {!open && (
            <Button
              onClick={() => setOpen(true)}
              className="shrink-0 bg-orange-600 text-white hover:bg-orange-700"
            >
              Add details
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
      {open && (
        <CardContent className="space-y-4 py-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className={`space-y-1.5 ${f.wide ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={`business-${f.key}`} data-help={f.help}>
                    {f.label}
                  </Label>
                  <Input
                    id={`business-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    autoComplete={
                      f.key === "trading_name"
                        ? "organization"
                        : f.key === "postcode"
                          ? "postal-code"
                          : f.key === "email"
                            ? "email"
                            : f.key === "phone"
                              ? "tel"
                              : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" data-help="books.business.snapshot">
              Changes apply to new invoices. Invoices already issued keep the details they were sent
              with.
            </p>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="business-vat" data-help="books.business.vat">
                  VAT registered
                </Label>
                <Switch
                  id="business-vat"
                  checked={form.vat_registered}
                  onCheckedChange={(v) => set("vat_registered", v)}
                />
              </div>
              {form.vat_registered && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="business-vat-number">VAT number</Label>
                    <Input
                      id="business-vat-number"
                      value={form.vat_number}
                      onChange={(e) => set("vat_number", e.target.value)}
                      placeholder="GB123456789"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="business-vat-rate">Rate you charge</Label>
                    <Select value={form.vat_rate_pct} onValueChange={(v) => set("vat_rate_pct", v)}>
                      <SelectTrigger id="business-vat-rate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20% (standard)</SelectItem>
                        <SelectItem value="5">5% (reduced)</SelectItem>
                        <SelectItem value="0">0% (zero-rated)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                When on, VAT is added to every invoice at the rate you choose. Your earnings record
                the amount before VAT, because VAT is collected for HMRC rather than earned.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm(toForm(profile));
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save details"}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
