import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Undo2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  FileText,
} from "lucide-react";
import type { ImportBatch } from "./ImportWizard";

interface Props {
  batch: ImportBatch;
  onBatchChange: (b: ImportBatch) => void;
  onDone: () => void;
}

function SummaryCard({ batch }: { batch: ImportBatch }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Total rows</CardDescription>
          <CardTitle className="text-2xl">{batch.row_count}</CardTitle>
        </CardHeader>
        <CardContent>
          <FileText className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Committed</CardDescription>
          <CardTitle className="text-2xl text-green-600">{batch.committed_count}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendingUp className="h-5 w-5 text-green-500" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Skipped</CardDescription>
          <CardTitle className="text-2xl text-muted-foreground">
            {batch.row_count - batch.committed_count}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendingDown className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ImportCommitStep({ batch, onBatchChange, onDone }: Props) {
  const { toast } = useToast();

  // Poll if committing
  useQuery<ImportBatch>({
    queryKey: [`/api/imports/${batch.id}`],
    queryFn: () => apiRequest(`/api/imports/${batch.id}`),
    refetchInterval: batch.status === "committing" ? 2000 : false,
    enabled: batch.status === "committing",
    select: (data) => {
      if (data.status !== "committing") onBatchChange(data);
      return data;
    },
  });

  const { mutate: commit, isPending: committing } = useMutation<ImportBatch, Error>({
    mutationFn: () => apiRequest(`/api/imports/${batch.id}/commit`, { method: "POST" }),
    onSuccess: (updated) => {
      toast({ title: `${updated.committed_count} record(s) committed successfully` });
      onBatchChange(updated);
    },
    onError: (err) =>
      toast({ title: "Commit failed", description: err.message, variant: "destructive" }),
  });

  const { mutate: rollback, isPending: rollingBack } = useMutation<ImportBatch, Error>({
    mutationFn: () => apiRequest(`/api/imports/${batch.id}/rollback`, { method: "POST" }),
    onSuccess: (updated) => {
      toast({ title: "Import rolled back — all created records deleted." });
      onBatchChange(updated);
    },
    onError: (err) =>
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" }),
  });

  // ── Committing in progress ──

  if (batch.status === "committing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <RefreshCw className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Writing records…</p>
        <p className="text-sm text-muted-foreground">This should only take a moment.</p>
      </div>
    );
  }

  // ── Committed ──

  if (batch.status === "committed") {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold">Import committed</h3>
            <p className="text-sm text-muted-foreground">
              Records are now visible in your books. You can roll back this import at any time to
              delete them.
            </p>
          </div>
        </div>

        <SummaryCard batch={batch} />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="outline" onClick={() => rollback()} disabled={rollingBack}>
            {rollingBack ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Rolling back…
              </>
            ) : (
              <>
                <Undo2 className="mr-2 h-4 w-4" />
                Roll back import
              </>
            )}
          </Button>
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  // ── Rolled back ──

  if (batch.status === "rolled_back") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/40 p-6 text-center">
          <Undo2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Import rolled back</p>
          <p className="mt-1 text-sm text-muted-foreground">
            All records created by this import have been deleted.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  // ── Failed ──

  if (batch.status === "failed") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="font-medium text-destructive">Commit failed</p>
          {batch.error && <p className="mt-1 text-sm text-muted-foreground">{batch.error}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={() => commit()} disabled={committing}>
            Retry commit
          </Button>
        </div>
      </div>
    );
  }

  // ── Pre-commit confirmation ──

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Confirm and commit</h3>
        <p className="text-sm text-muted-foreground">
          Approved rows will be written to your earnings and expenses ledgers. You can roll back
          afterwards if needed.
        </p>
      </div>

      {/* Approve count reminder */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Ready to commit</p>
            <p className="text-sm text-muted-foreground">
              Approved rows will be added to your books. Skipped rows are ignored.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => commit()} disabled={committing}>
          {committing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Committing…
            </>
          ) : (
            "Commit import"
          )}
        </Button>
      </div>
    </div>
  );
}
