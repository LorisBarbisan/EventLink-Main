import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateBooks } from "@/lib/invalidate-books";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import type { ImportBatch } from "./ImportWizard";

interface ImpactRecord {
  table: "earnings_entries" | "expenses";
  id: number;
  date: string;
  description: string;
  amount_pence: number;
  currency: string;
  edited: boolean;
  linked: boolean;
}

interface Impact {
  earnings: number;
  expenses: number;
  edited: number;
  linked: number;
  records: ImpactRecord[];
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadRecords(batch: ImportBatch, records: ImpactRecord[]) {
  const header = [
    "Type",
    "Date",
    "Description",
    "Amount",
    "Currency",
    "Edited since import",
    "Linked to EventLink job",
  ];
  const lines = records.map((r) =>
    [
      r.table === "earnings_entries" ? "Earning" : "Expense",
      r.date,
      r.description,
      (r.amount_pence / 100).toFixed(2),
      r.currency,
      r.edited ? "Yes" : "No",
      r.linked ? "Yes" : "No",
    ]
      .map(csvCell)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${batch.file_name.replace(/\.[^.]+$/, "")}-imported-records.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Confirmation before rolling an import back: what will be removed, how much of
 * it has been edited or linked since, and a download of the records first.
 */
export function ImportRollbackDialog({
  batch,
  open,
  onClose,
  onRolledBack,
}: {
  batch: ImportBatch;
  open: boolean;
  onClose: () => void;
  onRolledBack?: (updated: ImportBatch) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: impact, isLoading } = useQuery<Impact>({
    queryKey: ["/api/imports", batch.id, "impact"],
    queryFn: () => apiRequest(`/api/imports/${batch.id}/impact`),
    enabled: open,
  });

  const rollback = useMutation<ImportBatch, Error>({
    // The endpoint replies { ok }, so fetch the batch afterwards.
    mutationFn: async () => {
      await apiRequest(`/api/imports/${batch.id}/rollback`, { method: "POST" });
      return apiRequest(`/api/imports/${batch.id}`);
    },
    onSuccess: (updated) => {
      invalidateBooks(queryClient);
      toast({ title: "Import rolled back", description: "You can restore records for 30 days." });
      onRolledBack?.(updated);
      onClose();
    },
    onError: (err) =>
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" }),
  });

  const total = impact ? impact.earnings + impact.expenses : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle>Roll back this import?</DialogTitle>
          <DialogDescription className="truncate">
            Everything created from{" "}
            <span className="font-medium text-foreground">{batch.file_name}</span> will be removed.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !impact ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Checking what this import created…
          </p>
        ) : total === 0 ? (
          <p className="text-sm">This import has no records left in your books.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {[
                { n: impact.earnings, label: impact.earnings === 1 ? "earning" : "earnings" },
                { n: impact.expenses, label: impact.expenses === 1 ? "expense" : "expenses" },
              ].map((c) => (
                <div key={c.label} className="rounded-md border bg-muted/40 px-3 py-2">
                  <p className="text-xl font-semibold tabular-nums">{c.n}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>

            {(impact.edited > 0 || impact.linked > 0) && (
              <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-medium">
                    {impact.edited > 0
                      ? `${impact.edited} ${impact.edited === 1 ? "has" : "have"} been changed since the import`
                      : `${plural(impact.linked, "record")} ${impact.linked === 1 ? "is" : "are"} linked to EventLink jobs`}
                  </p>
                  <p className="text-amber-900/80 dark:text-amber-200/80">
                    {impact.edited > 0 && impact.linked > 0
                      ? `${impact.linked} ${impact.linked === 1 ? "is" : "are"} linked to EventLink jobs. `
                      : ""}
                    Payments, corrections, clients or receipts you added go with them.
                  </p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => downloadRecords(batch, impact.records)}
            >
              <Download className="mr-2 h-4 w-4" />
              Download these records first
            </Button>

            <p className="text-xs text-muted-foreground">
              Nothing else in your books changes. Removed records can be restored from Recently
              removed for 30 days.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => rollback.mutate()}
            disabled={!impact || rollback.isPending}
          >
            {rollback.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Roll back {impact && total > 0 ? plural(total, "record") : "import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
