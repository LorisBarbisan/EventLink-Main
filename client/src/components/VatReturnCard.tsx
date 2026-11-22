import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { fmtDate as fmtSharedDate } from "@shared/dates";
import {
  VAT_SCHEMES,
  VAT_SCHEME_LABELS,
  VAT_STAGGERS,
  VAT_STAGGER_LABELS,
  type VatScheme,
  type VatStagger,
} from "@shared/vat-return";
import { apiRequest } from "@/lib/queryClient";
import { invalidateBooks } from "@/lib/invalidate-books";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface VatPaymentRow {
  id: number;
  amount_pence: number;
  paid_date: string;
  notes: string | null;
}

interface VatQuarterRow {
  from: string;
  to: string;
  label: string;
  due: string;
  in_progress: boolean;
  output_pence: number;
  input_pence: number;
  net_pence: number;
  flat_rate_turnover_pence: number | null;
  invoice_count: number;
  expense_count: number;
  capital_candidates: number;
  other_currency: number;
  payment: VatPaymentRow | null;
}

type VatReturnResponse =
  | { vat_registered: false }
  | {
      vat_registered: true;
      vat_scheme: VatScheme;
      vat_stagger: VatStagger;
      vat_flat_rate_bp: number | null;
      quarters: VatQuarterRow[];
    };

const fmtDate = (d: string | null | undefined) => fmtSharedDate(d, "—");

function fmtPence(p: number): string {
  return (p / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

/** Changing the scheme changes which expenses count net, so every Books figure refreshes. */
function refreshAfterSettings(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateBooks(queryClient);
  queryClient.invalidateQueries({ queryKey: ["/api/billing-profile"] });
}

/**
 * Per VAT quarter: VAT on sales, VAT reclaimable, the difference, and what was
 * actually paid. For a VAT-registered freelancer only; renders nothing
 * otherwise. The figures are for the person's own MTD software: nothing is
 * submitted to HMRC from here.
 */
export function VatReturnCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paying, setPaying] = useState<VatQuarterRow | null>(null);

  const { data } = useQuery<VatReturnResponse>({
    queryKey: ["/api/books/vat-return"],
    queryFn: () => apiRequest("/api/books/vat-return"),
  });

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/books/vat-payments/${id}`, { method: "DELETE" }),
    // The Books summary shows what was paid to HMRC, so refresh it too
    onSuccess: () => invalidateBooks(queryClient),
    onError: (e: Error) =>
      toast({ title: "Couldn't remove payment", description: e.message, variant: "destructive" }),
  });

  if (!data?.vat_registered) return null;

  const isFlat = data.vat_scheme === "flat_rate";
  const flatRateMissing = isFlat && !data.vat_flat_rate_bp;
  const capital = data.quarters.reduce((s, q) => s + q.capital_candidates, 0);
  const otherCurrency = data.quarters.reduce((s, q) => s + q.other_currency, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-l-4 border-emerald-500 bg-emerald-50/50 px-5 py-3 dark:bg-emerald-950/20">
        <div className="min-w-0">
          <p className="font-semibold">VAT return</p>
          <p className="text-xs text-muted-foreground">
            {VAT_SCHEME_LABELS[data.vat_scheme]}
            {isFlat && data.vat_flat_rate_bp ? ` at ${data.vat_flat_rate_bp / 100}%` : ""} ·
            quarters end {VAT_STAGGER_LABELS[data.vat_stagger]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => setSettingsOpen(true)}
          aria-label="VAT return settings"
        >
          <Settings2 className="mr-1 h-3.5 w-3.5" />
          Settings
        </Button>
      </div>

      <CardContent className="space-y-3 p-0">
        {flatRateMissing && (
          <p className="mx-4 mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Set your flat rate percentage in Settings to see what you owe.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left">Quarter</th>
                <th className="px-4 py-2 text-right" title="Box 1">
                  {isFlat ? "Flat-rate VAT" : "VAT on sales"}
                </th>
                <th className="px-4 py-2 text-right" title="Box 4">
                  VAT reclaimed
                </th>
                <th className="px-4 py-2 text-right" title="Box 5">
                  Owed
                </th>
                <th className="px-4 py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {data.quarters.map((q) => (
                <tr
                  key={q.to}
                  className={`border-b last:border-0 ${q.in_progress ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""}`}
                >
                  <td className="px-4 py-2.5 align-top">
                    <span className="font-medium">{q.label}</span>
                    {q.in_progress && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                        so far
                      </span>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">Due {fmtDate(q.due)}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right align-top tabular-nums">
                    {fmtPence(q.output_pence)}
                    {isFlat && q.flat_rate_turnover_pence !== null && (
                      <p className="text-xs text-muted-foreground">
                        on {fmtPence(q.flat_rate_turnover_pence)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right align-top tabular-nums">
                    {fmtPence(q.input_pence)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right align-top font-semibold tabular-nums ${q.net_pence < 0 ? "text-green-700 dark:text-green-300" : ""}`}
                  >
                    {fmtPence(Math.abs(q.net_pence))}
                    {q.net_pence < 0 && (
                      <p className="text-xs font-normal text-muted-foreground">repayment</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right align-top">
                    {q.payment ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <button
                          type="button"
                          className="tabular-nums underline-offset-2 hover:underline"
                          onClick={() => setPaying(q)}
                        >
                          {q.payment.amount_pence < 0
                            ? `${fmtPence(-q.payment.amount_pence)} back`
                            : fmtPence(q.payment.amount_pence)}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(q.payment.paid_date)}
                        </span>
                      </div>
                    ) : q.in_progress ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setPaying(q)}>
                        Record
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 px-4 pb-4 text-xs text-muted-foreground">
          {isFlat && capital > 0 && (
            <p>
              {capital} purchase{capital === 1 ? "" : "s"} of £2,000 or more (incl. VAT) in these
              quarters. On the Flat Rate Scheme, VAT on a single capital item at that size can be
              reclaimed — check whether {capital === 1 ? "it qualifies" : "they qualify"}.
            </p>
          )}
          {otherCurrency > 0 && (
            <p>
              {otherCurrency} non-sterling record{otherCurrency === 1 ? " is" : "s are"} left out:
              the books hold no exchange rate.
            </p>
          )}
          <p>
            Estimates from your invoices and expenses, to copy into your Making Tax Digital software
            (Box 1, Box 4 and Box 5). EventLink doesn&apos;t submit VAT returns. Record what you
            paid so you can see which quarters are settled.
          </p>
        </div>
      </CardContent>

      <VatSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        scheme={data.vat_scheme}
        stagger={data.vat_stagger}
        flatRateBp={data.vat_flat_rate_bp}
        onSaved={() => refreshAfterSettings(queryClient)}
      />
      <VatPaymentDialog
        quarter={paying}
        onClose={() => setPaying(null)}
        onDelete={(id) => deletePayment.mutate(id)}
      />
    </Card>
  );
}

function VatSettingsDialog({
  open,
  onClose,
  scheme,
  stagger,
  flatRateBp,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  scheme: VatScheme;
  stagger: VatStagger;
  flatRateBp: number | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ scheme, stagger: String(stagger), rate: "" });
  const [lastOpen, setLastOpen] = useState(false);
  // Reset to the saved values each time the dialog opens
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open)
      setForm({
        scheme,
        stagger: String(stagger),
        rate: flatRateBp ? String(flatRateBp / 100) : "",
      });
  }

  const rateBp = Math.round(parseFloat(form.rate) * 100);
  const rateValid = Number.isInteger(rateBp) && rateBp > 0 && rateBp <= 1650;

  const save = useMutation({
    mutationFn: () =>
      apiRequest("/api/billing-profile", {
        method: "PUT",
        body: JSON.stringify({
          vat_scheme: form.scheme,
          vat_stagger: parseInt(form.stagger, 10),
          vat_flat_rate_bp: form.scheme === "flat_rate" ? rateBp : null,
        }),
      }),
    onSuccess: () => {
      onSaved();
      toast({ title: "VAT settings saved" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>VAT return settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="vat-scheme">VAT scheme</Label>
            <Select
              value={form.scheme}
              onValueChange={(v) => setForm((f) => ({ ...f, scheme: v as VatScheme }))}
            >
              <SelectTrigger id="vat-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_SCHEMES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {VAT_SCHEME_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.scheme === "standard" &&
                "VAT is due when you invoice. HMRC's default unless you've chosen another scheme."}
              {form.scheme === "cash" && "VAT is due when your client pays, not when you invoice."}
              {form.scheme === "flat_rate" &&
                "You pay a fixed percentage of your VAT-inclusive turnover and can't reclaim VAT on costs, so your expenses count including VAT."}
            </p>
          </div>

          {form.scheme === "flat_rate" && (
            <div className="space-y-1">
              <Label htmlFor="vat-flat-rate">Flat rate (%)</Label>
              <Input
                id="vat-flat-rate"
                type="number"
                min="0"
                max="16.5"
                step="0.5"
                placeholder="e.g. 12.5"
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                style={{ fontSize: "16px" }}
              />
              <p className="text-xs text-muted-foreground">
                The rate HMRC gave you for your trade, including any first-year discount.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="vat-stagger">Your VAT quarters end in</Label>
            <Select
              value={form.stagger}
              onValueChange={(v) => setForm((f) => ({ ...f, stagger: v }))}
            >
              <SelectTrigger id="vat-stagger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_STAGGERS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {VAT_STAGGER_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              On your VAT registration certificate, or in your HMRC online account.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || (form.scheme === "flat_rate" && !rateValid)}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VatPaymentDialog({
  quarter,
  onClose,
  onDelete,
}: {
  quarter: VatQuarterRow | null;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ amount: "", date: "", notes: "", repayment: false });
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = quarter?.to ?? null;
  // Prefill from the saved payment, or from the computed figure
  if (key !== lastKey) {
    setLastKey(key);
    if (quarter) {
      const p = quarter.payment;
      const pence = p ? p.amount_pence : quarter.net_pence;
      setForm({
        amount: (Math.abs(pence) / 100).toFixed(2),
        date: p?.paid_date ?? "",
        notes: p?.notes ?? "",
        repayment: pence < 0,
      });
    }
  }

  const amountPence = Math.round(parseFloat(form.amount) * 100);
  const valid =
    Number.isFinite(amountPence) && amountPence >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("/api/books/vat-payments", {
        method: "PUT",
        body: JSON.stringify({
          period_start: quarter!.from,
          period_end: quarter!.to,
          amount_pence: form.repayment ? -amountPence : amountPence,
          paid_date: form.date,
          notes: form.notes,
        }),
      }),
    onSuccess: () => {
      invalidateBooks(queryClient);
      toast({ title: "VAT payment recorded" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!quarter} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>VAT for {quarter?.label}</DialogTitle>
        </DialogHeader>
        {quarter && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Calculated: {fmtPence(Math.abs(quarter.net_pence))}{" "}
              {quarter.net_pence < 0 ? "repayment due to you" : "owed"}. Record what actually
              happened.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.repayment ? "outline" : "default"}
                onClick={() => setForm((f) => ({ ...f, repayment: false }))}
              >
                I paid HMRC
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.repayment ? "default" : "outline"}
                onClick={() => setForm((f) => ({ ...f, repayment: true }))}
              >
                HMRC repaid me
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="vat-pay-amount">Amount (£)</Label>
                <Input
                  id="vat-pay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vat-pay-date">Date</Label>
                <Input
                  id="vat-pay-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ fontSize: "16px" }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vat-pay-notes">Notes</Label>
              <Input
                id="vat-pay-notes"
                value={form.notes}
                maxLength={500}
                placeholder="Optional, e.g. payment reference"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ fontSize: "16px" }}
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {quarter?.payment ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                onDelete(quarter.payment!.id);
                onClose();
              }}
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
