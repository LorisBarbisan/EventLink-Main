import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ukToday } from "@shared/job-dates";
import { Camera, Monitor } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { gbp, monthlySetAside, savedTaxQuery } from "@/lib/books-mobile";

type Invoice = {
  id: number;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  total_pence: number;
  currency: string | null;
  due_date: string | null;
  to_details?: { company?: string; name?: string } | null;
  archived?: boolean;
};

/**
 * Books on a phone: the three things worth having away from a desk — what to
 * put aside, what you're owed (with Mark paid), and receipt capture. The rest
 * of Books stays on the computer, and this says so.
 */
export function BooksMobile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = savedTaxQuery();

  const { data: tax } = useQuery<{
    paymentSchedule: { januaryPence: number; januaryDate: string };
  }>({
    queryKey: ["/api/books/tax-estimate", q],
    queryFn: () => apiRequest(`/api/books/tax-estimate${q ? `?${q}` : ""}`),
  });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: count } = useQuery<{ count: number }>({
    queryKey: ["/api/receipts/unattached/count"],
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/invoices/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/books/tax-estimate"] });
      toast({ title: "Marked paid" });
    },
    onError: () => toast({ title: "Couldn't mark it paid", variant: "destructive" }),
  });

  const today = ukToday();
  const owed = invoices
    .filter((i) => !i.archived && (i.status === "sent" || i.status === "overdue"))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const owedTotal = owed
    .filter((i) => (i.currency ?? "GBP") === "GBP")
    .reduce((s, i) => s + i.total_pence, 0);
  const set = tax?.paymentSchedule
    ? monthlySetAside(tax.paymentSchedule.januaryPence, tax.paymentSchedule.januaryDate)
    : null;
  const waiting = count?.count ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-1 py-4">
          <p className="text-sm text-muted-foreground">Put aside</p>
          {!set ? (
            <p className="text-sm text-muted-foreground">Working it out…</p>
          ) : set.past || tax!.paymentSchedule.januaryPence === 0 ? (
            <p className="text-sm">Nothing to put aside right now.</p>
          ) : (
            <>
              <p className="text-3xl font-bold tabular-nums">
                {gbp(set.monthly)}
                <span className="text-base font-normal text-muted-foreground"> a month</span>
              </p>
              <p className="text-sm text-muted-foreground">
                for {gbp(tax!.paymentSchedule.januaryPence)} due {tax!.paymentSchedule.januaryDate}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">Owed to you</p>
            <p className="text-lg font-semibold tabular-nums">{gbp(owedTotal)}</p>
          </div>
          {owed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
          ) : (
            <ul className="divide-y">
              {owed.map((i) => {
                const late = i.due_date && i.due_date < today;
                const days = late
                  ? Math.floor((Date.parse(today) - Date.parse(i.due_date!)) / 86_400_000)
                  : 0;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {i.to_details?.company || i.to_details?.name || i.invoice_number}
                      </p>
                      <p
                        className={`text-xs ${late ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                      >
                        {(i.currency ?? "GBP") === "GBP"
                          ? gbp(i.total_pence)
                          : `${(i.total_pence / 100).toFixed(2)} ${i.currency}`}
                        {late
                          ? ` · ${days} day${days === 1 ? "" : "s"} overdue`
                          : i.due_date
                            ? ` · due ${i.due_date}`
                            : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 shrink-0"
                      onClick={() => markPaid.mutate(i.id)}
                      disabled={markPaid.isPending}
                    >
                      Mark paid
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link href="/capture">
        <Button className="h-14 w-full text-base">
          <Camera className="mr-2 h-5 w-5" /> Capture a receipt
        </Button>
      </Link>
      {waiting > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {waiting} receipt{waiting === 1 ? "" : "s"} waiting to be filed
        </p>
      )}

      <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
        <Monitor className="mt-0.5 h-4 w-4 shrink-0" />
        Capture receipts here, file them later. Open EventLink on a computer for your full books.
      </p>
    </div>
  );
}
