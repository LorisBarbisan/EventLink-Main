/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  SkipForward,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ImportBatch } from "./ImportWizard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportRow {
  id: number;
  row_number: number;
  raw: Record<string, string>;
  parsed: Record<string, any>;
  target: "expense" | "earnings" | "invoice" | "mileage" | "kit" | "skip" | null;
  confidence: number;
  issues: string[];
  decision: "pending" | "approved" | "skipped" | "duplicate";
}

interface RowsPage {
  rows: ImportRow[];
  total: number;
  counts: {
    pending: number;
    approved: number;
    skipped: number;
    duplicate: number;
  };
}

interface Props {
  batch: ImportBatch;
  onBatchChange: (b: ImportBatch) => void;
  onDone: (b: ImportBatch) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPence(p: number | undefined): string {
  if (p === undefined || p === null) return "—";
  return `£${(Math.abs(p) / 100).toFixed(2)}`;
}

function targetBadge(target: ImportRow["target"]) {
  if (!target || target === "skip")
    return (
      <Badge variant="secondary" className="text-xs">
        Skip
      </Badge>
    );
  if (target === "earnings")
    return (
      <Badge className="bg-green-100 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
        Earnings
      </Badge>
    );
  if (target === "expense")
    return (
      <Badge className="bg-red-100 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">
        Expense
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {target}
    </Badge>
  );
}

function decisionBadge(d: ImportRow["decision"]) {
  switch (d) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Approved
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="secondary" className="text-xs">
          Skipped
        </Badge>
      );
    case "duplicate":
      return (
        <Badge variant="outline" className="border-yellow-400 text-xs text-yellow-700">
          Duplicate
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs text-muted-foreground">
          Pending
        </Badge>
      );
  }
}

const PAGE_SIZE = 25;

// ── Parse progress panel ──────────────────────────────────────────────────────

function ParseProgress({
  batch,
  onBatchChange,
}: {
  batch: ImportBatch;
  onBatchChange: (b: ImportBatch) => void;
}) {
  // Poll until batch moves out of queued/parsing
  useQuery<ImportBatch>({
    queryKey: [`/api/imports/${batch.id}`],
    queryFn: () => apiRequest(`/api/imports/${batch.id}`),
    refetchInterval: 2000,
    select: (data) => {
      if (data.status !== "queued" && data.status !== "parsing") {
        onBatchChange(data);
      }
      return data;
    },
  });

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <RefreshCw className="h-10 w-10 animate-spin text-primary" />
      <div>
        <p className="text-lg font-medium">
          {batch.status === "queued" ? "Waiting to parse…" : "Parsing file…"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This may take a moment depending on the file size.
        </p>
      </div>
      {batch.parse_progress > 0 && (
        <div className="w-full max-w-sm">
          <Progress value={batch.parse_progress} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">{batch.parse_progress}%</p>
        </div>
      )}
    </div>
  );
}

// ── Main review table ─────────────────────────────────────────────────────────

export function ImportReviewStep({ batch, onBatchChange, onDone }: Props) {
  const [page, setPage] = useState(1);
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // If still parsing, show progress
  if (batch.status === "queued" || batch.status === "parsing") {
    return <ParseProgress batch={batch} onBatchChange={onBatchChange} />;
  }

  if (batch.status === "failed") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
        <p className="font-medium text-destructive">Parse failed</p>
        {batch.error && <p className="mt-1 text-sm text-muted-foreground">{batch.error}</p>}
        <p className="mt-3 text-sm text-muted-foreground">
          Go back to configure step to retry with different settings.
        </p>
      </div>
    );
  }

  return (
    <ReviewTable
      batch={batch}
      page={page}
      setPage={setPage}
      decisionFilter={decisionFilter}
      setDecisionFilter={setDecisionFilter}
      onDone={onDone}
      toast={toast}
      queryClient={queryClient}
    />
  );
}

function ReviewTable({
  batch,
  page,
  setPage,
  decisionFilter,
  setDecisionFilter,
  onDone,
  toast,
  queryClient,
}: {
  batch: ImportBatch;
  page: number;
  setPage: (n: number) => void;
  decisionFilter: string;
  setDecisionFilter: (s: string) => void;
  onDone: (b: ImportBatch) => void;
  toast: any;
  queryClient: any;
}) {
  const qKey = [`/api/imports/${batch.id}/rows`, { decision: decisionFilter, page }];

  const { data, isLoading } = useQuery<RowsPage>({
    queryKey: qKey,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (decisionFilter !== "all") params.set("decision", decisionFilter);
      return apiRequest(`/api/imports/${batch.id}/rows?${params}`);
    },
  });

  // Set decision on a single row
  const { mutate: setDecision } = useMutation<any, Error, { rowId: number; decision: string }>({
    mutationFn: ({ rowId, decision }) =>
      apiRequest(`/api/imports/${batch.id}/rows/${rowId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/imports/${batch.id}/rows`] }),
    onError: (err) =>
      toast({ title: "Failed to update row", description: err.message, variant: "destructive" }),
  });

  // Bulk decisions
  const { mutate: bulkDecision, isPending: bulkPending } = useMutation<
    { count: number },
    Error,
    { decision: string; filter: string }
  >({
    mutationFn: ({ decision, filter }) =>
      apiRequest(`/api/imports/${batch.id}/rows/bulk`, {
        method: "POST",
        body: JSON.stringify({ decision, filter }),
      }),
    onSuccess: (result, { decision }) => {
      toast({ title: `${result.count} row(s) marked as ${decision}` });
      queryClient.invalidateQueries({ queryKey: [`/api/imports/${batch.id}/rows`] });
    },
    onError: (err) =>
      toast({ title: "Bulk action failed", description: err.message, variant: "destructive" }),
  });

  const counts = data?.counts ?? { pending: 0, approved: 0, skipped: 0, duplicate: 0 };
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];

  const totalApproved = counts.approved;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Review rows</h3>
        <p className="text-sm text-muted-foreground">
          Approve rows to include them or skip to exclude. Rows the parser is uncertain about are
          shown first.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span
          className={`cursor-pointer rounded-full px-3 py-1 ${decisionFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          onClick={() => {
            setDecisionFilter("all");
            setPage(1);
          }}
        >
          All ({batch.row_count})
        </span>
        <span
          className={`cursor-pointer rounded-full px-3 py-1 ${decisionFilter === "pending" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          onClick={() => {
            setDecisionFilter("pending");
            setPage(1);
          }}
        >
          Pending ({counts.pending})
        </span>
        <span
          className={`cursor-pointer rounded-full px-3 py-1 ${decisionFilter === "approved" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          onClick={() => {
            setDecisionFilter("approved");
            setPage(1);
          }}
        >
          Approved ({counts.approved})
        </span>
        <span
          className={`cursor-pointer rounded-full px-3 py-1 ${decisionFilter === "skipped" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          onClick={() => {
            setDecisionFilter("skipped");
            setPage(1);
          }}
        >
          Skipped ({counts.skipped})
        </span>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={bulkPending || counts.pending === 0}
          onClick={() => bulkDecision({ decision: "approved", filter: "pending" })}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          Approve all pending
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={bulkPending || counts.pending === 0}
          onClick={() => bulkDecision({ decision: "skipped", filter: "pending" })}
        >
          <SkipForward className="mr-1.5 h-3.5 w-3.5" />
          Skip all pending
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No rows match the current filter.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = row.parsed ?? {};
                const amount = p.amount_pence as number | undefined;
                const isNeg = typeof amount === "number" && amount < 0;
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.row_number}</td>
                    <td className="px-3 py-2">
                      {p.date ? (
                        String(p.date).slice(0, 10)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2">
                      <span className="line-clamp-1">
                        {p.description ?? Object.values(row.raw)[0] ?? "—"}
                      </span>
                      {row.issues?.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {row.issues[0]}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span
                        className={`flex items-center justify-end gap-1 ${isNeg ? "text-red-600" : "text-green-700"}`}
                      >
                        {isNeg ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {fmtPence(amount)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{targetBadge(row.target)}</td>
                    <td className="px-3 py-2">{decisionBadge(row.decision)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {row.decision !== "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-green-700 hover:bg-green-50 hover:text-green-700"
                            onClick={() => setDecision({ rowId: row.id, decision: "approved" })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {row.decision !== "skipped" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => setDecision({ rowId: row.id, decision: "skipped" })}
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Continue to commit */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          {totalApproved} row{totalApproved !== 1 ? "s" : ""} approved
          {counts.pending > 0 && ` · ${counts.pending} still pending`}
        </p>
        <Button disabled={totalApproved === 0} onClick={() => onDone(batch)}>
          Continue to commit
        </Button>
      </div>
    </div>
  );
}
