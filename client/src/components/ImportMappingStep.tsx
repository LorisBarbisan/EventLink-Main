import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Info } from "lucide-react";
import type { ImportBatch } from "./ImportWizard";

interface Props {
  batch: ImportBatch;
  onDone: (updated: ImportBatch) => void;
}

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (UK / EU)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY" },
];

export function ImportMappingStep({ batch, onDone }: Props) {
  const [dateFormat, setDateFormat] = useState<string>(batch.date_format ?? "DD/MM/YYYY");
  const [fullFidelityFrom, setFullFidelityFrom] = useState<string>(batch.full_fidelity_from ?? "");
  const { toast } = useToast();

  // Save mapping + trigger parse in one flow
  const { mutate: submit, isPending } = useMutation<ImportBatch, Error>({
    mutationFn: async () => {
      // 1. Save mapping (advances batch to 'configuring')
      await apiRequest(`/api/imports/${batch.id}/mappings`, {
        method: "POST",
        body: JSON.stringify({
          headers: [], // empty — column mapping inferred by parser
          columnMap: {},
          dateFormat,
          fullFidelityFrom: fullFidelityFrom || undefined,
        }),
      });

      // 2. Enqueue parse job (advances to 'queued')
      return apiRequest(`/api/imports/${batch.id}/parse`, { method: "POST" });
    },
    onSuccess: (updated) => onDone(updated),
    onError: (err) =>
      toast({
        title: "Failed to start analysis",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Configure import</h3>
        <p className="text-sm text-muted-foreground">
          Tell the parser how dates are formatted in your file. Column headers are detected
          automatically.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Date format */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Date format</CardTitle>
            <CardDescription className="text-xs">
              How dates are written in the file (e.g. 01/02/2024 is ambiguous — choose the right
              interpretation).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Full fidelity from */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Full fidelity from (optional)</CardTitle>
            <CardDescription className="text-xs">
              If you have already imported transactions before this date, set a cutoff to skip
              duplicates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={fullFidelityFrom}
              onChange={(e) => setFullFidelityFrom(e.target.value)}
              placeholder="Leave blank to import everything"
            />
          </CardContent>
        </Card>
      </div>

      {/* Info callout */}
      <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The parser will detect column headers automatically and classify each transaction as an
          earning or expense. You can review and adjust individual rows in the next step.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button onClick={() => submit()} disabled={isPending}>
          {isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            "Analyse file"
          )}
        </Button>
      </div>

      {/* Re-configure banner if batch is failed */}
      {batch.status === "failed" && batch.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <strong>Previous parse failed:</strong> {batch.error}
          <br />
          Adjust the settings above and try again.
        </div>
      )}
    </div>
  );
}
