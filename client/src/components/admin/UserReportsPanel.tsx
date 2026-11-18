import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_CATEGORIES, REPORT_STATUSES, type ReportStatus } from "@shared/safety";

interface ReportRow {
  id: number;
  reporter_id: number | null;
  reporter_name: string | null;
  subject_id: number;
  subject_name: string | null;
  subject_deleted: boolean;
  category: string;
  details: string | null;
  conversation_id: number | null;
  booking_id: number | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  subject_report_count: number;
}

const CATEGORY_LABEL = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.value, c.label]));

export function UserReportsPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery<ReportRow[]>({ queryKey: ["/api/admin/user-reports"] });
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const update = useMutation({
    mutationFn: (v: { id: number; status?: ReportStatus; admin_notes?: string }) =>
      apiRequest(`/api/admin/user-reports/${v.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: v.status, admin_notes: v.admin_notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/user-reports"] }),
  });

  const rows = useMemo(
    () => data.filter((r) => filter === "all" || r.status === filter),
    [data, filter]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of data) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {REPORT_CATEGORIES.map((c) => (
          <div key={c.value} className="rounded-lg border p-3">
            <div className="text-2xl font-semibold tabular-nums">{counts[c.value] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Reports about people</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as ReportStatus | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {REPORT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No reports here.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                <span className="font-medium">
                  About{" "}
                  <a
                    className="underline"
                    href={`/profile/${r.subject_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.subject_name ?? `user ${r.subject_id}`}
                  </a>
                  {r.subject_deleted && " (account deleted)"}
                </span>
                {r.subject_report_count > 1 && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                    {r.subject_report_count} reports about this person
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-GB")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                From{" "}
                {r.reporter_name ?? (r.reporter_id ? `user ${r.reporter_id}` : "a deleted account")}
                {r.conversation_id && ` · conversation #${r.conversation_id}`}
                {r.booking_id && ` · booking #${r.booking_id}`}
              </div>
              {r.details && <p className="whitespace-pre-wrap">{r.details}</p>}
              <div className="flex flex-wrap items-end gap-2">
                <Textarea
                  className="min-h-[2.5rem] flex-1"
                  placeholder="Admin notes"
                  value={notes[r.id] ?? r.admin_notes ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    update.mutate({ id: r.id, status: v as ReportStatus, admin_notes: notes[r.id] })
                  }
                >
                  <SelectTrigger className="w-36 capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {notes[r.id] !== undefined && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id: r.id, admin_notes: notes[r.id] })}
                  >
                    Save notes
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
