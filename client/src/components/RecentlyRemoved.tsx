import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateBooks } from "@/lib/invalidate-books";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, RotateCcw } from "lucide-react";

interface RemovedRecord {
  id: number;
  date: string;
  description: string;
  amount_pence: number;
  currency: string;
  archived_at: string;
  removed_by: string;
  restore_until: string;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const money = (pence: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(pence / 100);

/**
 * Collapsed list of records removed in the last 30 days (deleted, rolled back
 * or cleared by Start again), each with Restore. Renders nothing when empty.
 */
export function RecentlyRemoved({ table }: { table: "earnings" | "expenses" }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data = [] } = useQuery<RemovedRecord[]>({
    queryKey: ["/api/books/removed", table],
    queryFn: () => apiRequest(`/api/books/removed?table=${table}`),
  });

  const restore = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/books/removed/${table}/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      invalidateBooks(queryClient);
      toast({ title: "Restored" });
    },
    onError: () => toast({ title: "Restore failed", variant: "destructive" }),
  });

  if (data.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm"
        data-help="books.import.removed"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="font-medium">Recently removed</span>
        <span className="text-xs text-muted-foreground">
          {data.length} {data.length === 1 ? "record" : "records"} · restorable for 30 days
        </span>
      </button>
      {open && (
        <ul className="divide-y border-t">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {day(r.date)} · {r.removed_by} {day(r.archived_at)} · until {day(r.restore_until)}
                </p>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {money(r.amount_pence, r.currency)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => restore.mutate(r.id)}
                disabled={restore.isPending}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
