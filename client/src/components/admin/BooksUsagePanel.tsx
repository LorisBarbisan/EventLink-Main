import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BOOKS_AREAS,
  type BooksCohort,
  type BooksUsageResponse,
  type BooksUsageRow,
} from "@shared/books-usage";

const COHORTS: { key: BooksCohort; label: string; hint: string; tone: string }[] = [
  {
    key: "active",
    label: "Active",
    hint: "Wrote something in 30 days",
    tone: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  {
    key: "slowing",
    label: "Slowing",
    hint: "Nothing for 30–90 days",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    key: "lapsed",
    label: "Lapsed",
    hint: "90+ days, more than 5 records",
    tone: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  {
    key: "tried",
    label: "Tried it",
    hint: "5 records or fewer, then stopped",
    tone: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    key: "never",
    label: "Never started",
    hint: "No records",
    tone: "bg-muted text-muted-foreground",
  },
];
const AREA_LABEL: Record<string, string> = {
  earnings: "Earn",
  expenses: "Exp",
  mileage: "Miles",
  kit: "Kit",
  invoices: "Inv",
  imports: "Imp",
};

type SortKey =
  | "name"
  | "signed_up"
  | "total_records"
  | "first_activity"
  | "last_activity"
  | "cohort";

export function BooksUsagePanel() {
  const { data, isLoading } = useQuery<BooksUsageResponse>({
    queryKey: ["/api/admin/books-usage"],
  });
  const [filter, setFilter] = useState<BooksCohort | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "last_activity",
    desc: true,
  });

  const rows = useMemo(() => {
    const list = (data?.rows ?? []).filter((r) => !filter || r.cohort === filter);
    const v = (r: BooksUsageRow) => r[sort.key] ?? "";
    return [...list].sort((a, b) => {
      const x = v(a);
      const y = v(b);
      const c =
        typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -c : c;
    });
  }, [data, filter, sort]);

  const th = (key: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-2 py-2 text-left font-medium"
      onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
    >
      {label}
      {sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Counts and dates only — how many Books records each freelancer has and when they last wrote
        one. None of the content is read.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COHORTS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter((f) => (f === c.key ? null : c.key))}
            className={`rounded-lg border p-3 text-left transition-colors ${filter === c.key ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"}`}
          >
            <div className="text-2xl font-semibold tabular-nums">{data?.cohorts[c.key] ?? "—"}</div>
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-xs text-muted-foreground">{c.hint}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filter ? COHORTS.find((c) => c.key === filter)!.label : "All freelancers"} (
            {rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead className="border-b bg-muted/40 text-xs">
                <tr>
                  {th("name", "Name")}
                  {th("signed_up", "Signed up")}
                  {BOOKS_AREAS.map((a) => (
                    <th key={a} className="px-1 py-2 text-center font-medium">
                      {AREA_LABEL[a]}
                    </th>
                  ))}
                  {th("total_records", "Records")}
                  {th("first_activity", "First")}
                  {th("last_activity", "Last")}
                  <th className="px-2 py-2 text-center font-medium">Workbook</th>
                  {th("cohort", "Cohort")}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = COHORTS.find((c) => c.key === r.cohort)!;
                  return (
                    <tr key={r.user_id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-2 py-1.5">{r.name}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{r.signed_up}</td>
                      {BOOKS_AREAS.map((a) => (
                        <td
                          key={a}
                          className="px-1 py-1.5 text-center"
                          title={`${r.counts[a]} records`}
                        >
                          {r.counts[a] > 0 ? (
                            <Check className="mx-auto h-4 w-4 text-green-600" />
                          ) : (
                            <Minus className="mx-auto h-3 w-3 text-muted-foreground/50" />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right">{r.total_records}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{r.first_activity ?? "—"}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{r.last_activity ?? "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        {r.workbook_downloaded ? (
                          <Check className="mx-auto h-4 w-4 text-green-600" />
                        ) : (
                          <Minus className="mx-auto h-3 w-3 text-muted-foreground/50" />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className={`border-0 ${tone.tone}`}>
                          {tone.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
