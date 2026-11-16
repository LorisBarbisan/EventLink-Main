import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateBooks } from "@/lib/invalidate-books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Download } from "lucide-react";

type Scope = "all" | "keep_eventlink" | "imported";

interface Counts {
  all: { earnings: number; expenses: number };
  keep_eventlink: { earnings: number; expenses: number };
  imported: { earnings: number; expenses: number };
  eventlink_jobs: number;
  imports: number;
}

const n = (c: { earnings: number; expenses: number }) => c.earnings + c.expenses;
/** Fetch the year-end workbook with the bearer token and save it. */
async function downloadWorkbook(): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem("auth_token");
  } catch {
    /* storage blocked: the request will fail with 401 and say so */
  }
  const r = await fetch("/api/books/export.xlsx", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`Download failed (${r.status})`);
  const name =
    (r.headers.get("Content-Disposition") ?? "").match(/filename="?([^";\n]+)"?/i)?.[1] ??
    "eventlink-books.xlsx";
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const records = (k: number) => `${k} ${k === 1 ? "record" : "records"}`;

/**
 * "Start your books again": archive earnings and expenses in one of three
 * scopes, behind type-to-confirm, with the workbook offered first. Everything
 * cleared is restorable from Recently removed for 30 days.
 */
export function StartAgainCard() {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("keep_eventlink");
  const [typed, setTyped] = useState("");
  const [download, setDownload] = useState<"idle" | "busy" | "done">("idle");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: counts } = useQuery<Counts>({
    queryKey: ["/api/books/start-again"],
    queryFn: () => apiRequest("/api/books/start-again"),
    enabled: open,
  });

  const clear = useMutation<{ earnings: number; expenses: number }>({
    mutationFn: () =>
      apiRequest("/api/books/start-again", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, confirm: "CLEAR" }),
      }),
    onSuccess: (r) => {
      invalidateBooks(queryClient);
      setTyped("");
      toast({
        title: `Cleared ${records(r.earnings + r.expenses)}`,
        description: "Restore any of them from Recently removed within 30 days.",
      });
    },
    onError: () => toast({ title: "Could not clear your books", variant: "destructive" }),
  });

  const options: { value: Scope; label: string; detail: string }[] = counts
    ? [
        {
          value: "all",
          label: "Clear everything",
          detail: `every earning and expense (${records(n(counts.all))})`,
        },
        {
          value: "keep_eventlink",
          label: "Clear everything except EventLink work",
          detail: `keeps the ${counts.eventlink_jobs} ${counts.eventlink_jobs === 1 ? "job" : "jobs"} booked through the platform (${records(n(counts.keep_eventlink))} cleared)`,
        },
        {
          value: "imported",
          label: "Clear imported records only",
          detail: `${records(n(counts.imported))} from ${counts.imports} ${counts.imports === 1 ? "import" : "imports"}`,
        },
      ]
    : [];

  const selected = counts ? n(counts[scope]) : 0;

  return (
    <Card>
      <button
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="font-semibold">Start your books again</span>
      </button>
      {open && (
        <CardContent className="space-y-4 pt-0 text-sm">
          {!counts ? (
            <p className="text-muted-foreground">Counting your records…</p>
          ) : (
            <>
              <fieldset className="space-y-2">
                {options.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="start-again-scope"
                      className="mt-1"
                      checked={scope === o.value}
                      onChange={() => setScope(o.value)}
                    />
                    <span>
                      <span className="font-medium">{o.label}</span>
                      <span className="text-muted-foreground"> — {o.detail}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <p className="text-muted-foreground">
                This archives earnings and expenses rather than deleting them. You have 30 days to
                restore them from Recently removed. Mileage, invoices and kit are not affected.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={download === "busy"}
                  onClick={() => {
                    setDownload("busy");
                    downloadWorkbook()
                      .then(() => setDownload("done"))
                      .catch((e: Error) => {
                        setDownload("idle");
                        toast({ title: e.message, variant: "destructive" });
                      });
                  }}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {download === "busy"
                    ? "Preparing workbook…"
                    : "Download a workbook of everything first"}
                </Button>
                {download === "done" && (
                  <span className="text-xs text-muted-foreground">Workbook saved.</span>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label
                    className="mb-1 block text-xs text-muted-foreground"
                    htmlFor="clear-confirm"
                  >
                    Type CLEAR to confirm
                  </label>
                  <Input
                    id="clear-confirm"
                    className="h-8 w-40"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={typed !== "CLEAR" || selected === 0 || clear.isPending}
                  onClick={() => clear.mutate()}
                >
                  Clear {records(selected)}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
