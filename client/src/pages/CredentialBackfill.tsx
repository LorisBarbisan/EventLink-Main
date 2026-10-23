import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { DOCUMENT_TYPE_META, type DocumentType } from "@shared/credentials";

interface IncompleteDoc {
  id: number;
  document_type: string;
  custom_type_name?: string | null;
  original_filename: string;
}

function typeLabel(doc: IncompleteDoc): string {
  if (doc.document_type === "Other" && doc.custom_type_name) return doc.custom_type_name;
  return doc.document_type;
}

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Query key shared with the dashboard banner so both refresh together.
export const INCOMPLETE_CREDENTIALS_KEY = "/api/documents/incomplete";

/**
 * A small banner for the freelancer dashboard that appears only when the
 * freelancer has credentials still missing an expiry date, linking to the
 * one-screen backfill below.
 */
export function CredentialBacklogBanner() {
  const { data: incomplete = [] } = useQuery<IncompleteDoc[]>({
    queryKey: [INCOMPLETE_CREDENTIALS_KEY],
  });

  if (incomplete.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">
            {incomplete.length} of your certificates {incomplete.length === 1 ? "needs" : "need"} an
            expiry date
          </p>
          <p className="text-xs">
            Add the dates so EventLink can remind you before they lapse — it takes under a minute.
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link href="/credentials">Add expiry dates</Link>
      </Button>
    </div>
  );
}

export default function CredentialBackfill() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<Record<number, { issueDate: string; expiryDate: string }>>({});

  const { data: incomplete = [], isLoading } = useQuery<IncompleteDoc[]>({
    queryKey: [INCOMPLETE_CREDENTIALS_KEY],
  });

  const row = (id: number) => rows[id] ?? { issueDate: "", expiryDate: "" };

  const setIssue = (doc: IncompleteDoc, value: string) => {
    setRows((prev) => {
      const current = prev[doc.id] ?? { issueDate: "", expiryDate: "" };
      const meta = DOCUMENT_TYPE_META[doc.document_type as DocumentType];
      const canSuggest = !!(meta?.defaultValidityMonths && meta.validityConfirmed);
      // Suggest an expiry from the issue date only if they haven't typed one.
      const expiryDate =
        canSuggest && value && !current.expiryDate
          ? addMonthsISO(value, meta!.defaultValidityMonths!)
          : current.expiryDate;
      return { ...prev, [doc.id]: { issueDate: value, expiryDate } };
    });
  };

  const setExpiry = (id: number, value: string) => {
    setRows((prev) => ({
      ...prev,
      [id]: { issueDate: prev[id]?.issueDate ?? "", expiryDate: value },
    }));
  };

  const updates = incomplete
    .filter((d) => row(d.id).expiryDate)
    .map((d) => ({
      documentId: d.id,
      issueDate: row(d.id).issueDate || null,
      expiryDate: row(d.id).expiryDate,
    }));

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/documents/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }),
    onSuccess: (result: { saved?: number }) => {
      queryClient.invalidateQueries({ queryKey: [INCOMPLETE_CREDENTIALS_KEY] });
      toast({
        title: "Dates saved",
        description: `${result?.saved ?? updates.length} certificate${
          (result?.saved ?? updates.length) === 1 ? "" : "s"
        } updated. We'll remind you before they expire.`,
      });
      setLocation("/dashboard");
    },
    onError: (err: unknown) => {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please check the dates and try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add expiry dates</h1>
        <p className="text-sm text-muted-foreground">
          You already have these certificates on file — just add when each one expires so we can
          remind you in good time. You do not need to re-upload anything.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : incomplete.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="font-medium">All your certificates have expiry dates.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {incomplete.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{typeLabel(doc)}</CardTitle>
                  <CardDescription className="truncate">{doc.original_filename}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`issue-${doc.id}`} className="mb-1 block text-xs">
                      Issue date <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id={`issue-${doc.id}`}
                      type="date"
                      value={row(doc.id).issueDate}
                      onChange={(e) => setIssue(doc, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`expiry-${doc.id}`} className="mb-1 block text-xs">
                      Expiry date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`expiry-${doc.id}`}
                      type="date"
                      value={row(doc.id).expiryDate}
                      onChange={(e) => setExpiry(doc.id, e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button
              disabled={updates.length === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? "Saving…"
                : `Save ${updates.length || ""} date${updates.length === 1 ? "" : "s"}`.trim()}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
