import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, BookOpen, CheckCircle, Clock, TrendingUp, RefreshCw } from "lucide-react";

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
  gross_amount_pence: number;
  currency: string;
  status: string;
  needs_review: boolean;
  client_id: number | null;
  invoice_id: number | null;
  paid_date: string | null;
  paid_amount_pence: number | null;
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

// ── Main component ─────────────────────────────────────────────────────────────

export function BooksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<EarningsData>({
    queryKey: ["/api/earnings/summary"],
    queryFn: () => apiRequest("/api/earnings/summary").then((r) => r.json()),
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

  if (isLoading) {
    return (
      <div className="space-y-4">
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
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Could not load earnings data.</p>
        </CardContent>
      </Card>
    );
  }

  const { tax_year, summary, owed, entries } = data;
  const netPence = summary.total_pence - summary.deductions_pence;

  return (
    <div className="space-y-6">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 h-3 w-3 ${backfillMutation.isPending ? "animate-spin" : ""}`}
            />
            Sync past bookings
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 font-medium text-muted-foreground">No entries yet</p>
              <p className="text-sm text-muted-foreground">
                Entries are created automatically when bookings complete. Use &ldquo;Sync past
                bookings&rdquo; to import your history.
              </p>
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
                      <p className="text-xs text-muted-foreground">{fmtDate(entry.work_date)}</p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <StatusBadge entry={entry} />
                      <span className="text-sm font-medium tabular-nums">
                        {entry.needs_review
                          ? "—"
                          : formatPence(entry.gross_amount_pence, entry.currency)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
