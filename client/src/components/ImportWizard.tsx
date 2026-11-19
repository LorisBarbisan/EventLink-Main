import { useCallback, useEffect, useRef, useState } from "react";
import { pressable } from "@/lib/a11y";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { ImportMappingStep } from "./ImportMappingStep";
import { ImportReviewStep } from "./ImportReviewStep";
import { ImportCommitStep } from "./ImportCommitStep";
import { ImportRollbackDialog } from "./ImportRollbackDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportBatch {
  id: number;
  source: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status:
    | "uploaded"
    | "configuring"
    | "queued"
    | "parsing"
    | "review"
    | "committing"
    | "committed"
    | "rolled_back"
    | "failed";
  row_count: number;
  committed_count: number;
  parse_progress: number;
  error: string | null;
  created_at: string;
  committed_at?: string | null;
  rolled_back_at?: string | null;
  full_fidelity_from: string | null;
  date_format: string | null;
}

type WizardStep = "history" | "upload" | "configure" | "review" | "commit";

function stepForStatus(status: ImportBatch["status"]): WizardStep {
  switch (status) {
    case "uploaded":
      return "configure";
    case "configuring":
      return "configure";
    case "queued":
    case "parsing":
      return "review"; // show progress in review step
    case "review":
      return "review";
    case "committing":
    case "committed":
    case "rolled_back":
      return "commit";
    case "failed":
      return "configure"; // let user re-configure + re-parse
    default:
      return "configure";
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ImportBatch["status"] }) {
  const map: Record<
    ImportBatch["status"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    uploaded: { label: "Uploaded", variant: "secondary" },
    configuring: { label: "Configuring", variant: "secondary" },
    queued: { label: "Queued", variant: "secondary" },
    parsing: { label: "Parsing…", variant: "default" },
    review: { label: "Needs review", variant: "default" },
    committing: { label: "Committing…", variant: "default" },
    committed: { label: "Committed", variant: "outline" },
    rolled_back: { label: "Rolled back", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}

function fileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 shrink-0 text-red-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />;
  return <File className="h-4 w-4 shrink-0 text-blue-500" />;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── Import history list ───────────────────────────────────────────────────────

function HistoryList({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (batch: ImportBatch) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rollingBack, setRollingBack] = useState<ImportBatch | null>(null);
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const { data: batches = [], isLoading } = useQuery<ImportBatch[]>({
    queryKey: ["/api/imports"],
    queryFn: () => apiRequest("/api/imports"),
    refetchInterval: (data) => {
      const active = (Array.isArray(data) ? data : []).some(
        (b) => b.status === "parsing" || b.status === "queued" || b.status === "committing"
      );
      return active ? 5000 : false;
    },
  });

  const { mutate: deleteImport, isPending: deleting } = useMutation<void, Error, number>({
    mutationFn: (id) => apiRequest(`/api/imports/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
      toast({ title: "Import deleted" });
    },
    onError: (err) =>
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading imports…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Import history</h3>
          <p className="text-sm text-muted-foreground">
            Upload a CSV, Excel or PDF bank statement to populate your books.
          </p>
        </div>
        <Button onClick={onNew} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New import
        </Button>
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No imports yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a bank statement or spreadsheet to get started.
            </p>
            <Button onClick={onNew} className="mt-4" size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New import
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <Card
              key={b.id}
              className={`group cursor-pointer transition-colors hover:bg-muted/40 ${
                b.status === "rolled_back" || b.status === "failed" ? "opacity-60" : ""
              }`}
              onClick={() => onOpen(b)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                {fileIcon(b.mime_type)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{b.file_name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    <span>{fmtBytes(b.size_bytes)}</span>
                    {b.row_count > 0 && <span>{b.row_count} rows</span>}
                    {b.committed_count > 0 && <span>{b.committed_count} committed</span>}
                    <span>{fmtDay(b.created_at)}</span>
                    {b.status === "rolled_back" && b.rolled_back_at && (
                      <span>rolled back {fmtDay(b.rolled_back_at)}</span>
                    )}
                  </div>
                  {(b.status === "parsing" || b.status === "queued") && (
                    <Progress value={b.parse_progress} className="mt-2 h-1.5" />
                  )}
                  {b.status === "failed" && b.error && (
                    <p className="mt-1 truncate text-xs text-destructive">{b.error}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {b.status === "review" ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Clock className="h-3.5 w-3.5" />
                      Review
                    </div>
                  ) : b.status === "committed" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        data-help="books.import.rollback"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRollingBack(b);
                        }}
                      >
                        Roll back
                      </Button>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </>
                  ) : b.status === "failed" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : b.status === "parsing" || b.status === "queued" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                  {b.status !== "committed" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${b.file_name}"?`)) deleteImport(b.id);
                      }}
                      disabled={deleting}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Delete import"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {rollingBack && (
        <ImportRollbackDialog batch={rollingBack} open onClose={() => setRollingBack(null)} />
      )}
    </div>
  );
}

// ── Upload step ───────────────────────────────────────────────────────────────

const ACCEPTED = ".csv,.xlsx,.pdf,.txt,.doc,.docx";
const ACCEPTED_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * The browser's MIME type, falling back to the extension: Windows often
 * reports none for .csv (or application/vnd.ms-excel when Excel is installed).
 */
function mimeFor(file: File): string {
  if (file.type && ACCEPTED_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "text/csv";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt") return "text/plain";
  if (ext === "doc") return "application/msword";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file.type;
}

/**
 * Read a picked file as base64. Uses file.arrayBuffer() (one attempt, then one
 * retry) rather than FileReader.readAsDataURL, and reports the browser's own
 * reason if both fail, so a failure can be diagnosed.
 */
async function readAsBase64(file: File): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
      }
      return btoa(binary);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const reason =
    lastError instanceof DOMException || lastError instanceof Error
      ? `${lastError.name}: ${lastError.message}`
      : String(lastError);
  console.error("[import] could not read the picked file:", lastError);
  throw new Error(
    `Your browser couldn't read "${file.name}" (${reason}). Pick the file again; if it keeps happening, copy it to your Desktop and upload the copy.`
  );
}

function UploadStep({ onUploaded }: { onUploaded: (batch: ImportBatch) => void }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // New import opens the file picker straight away; the drop zone stays as
  // the fallback if the picker is cancelled or for drag and drop.
  useEffect(() => {
    fileRef.current?.click();
  }, []);
  const { toast } = useToast();

  const { mutate: upload, isPending } = useMutation<ImportBatch, Error, File>({
    mutationFn: async (file: File) => {
      const base64 = await readAsBase64(file);
      if (!base64) throw new Error("The file is empty.");
      return apiRequest("/api/imports", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: mimeFor(file),
          fileData: base64,
        }),
      });
    },
    onSuccess: (batch) => onUploaded(batch),
    onError: (err) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!ACCEPTED_TYPES.includes(mimeFor(file))) {
      toast({
        title: "Unsupported file type",
        description:
          "Please upload a CSV, Excel (.xlsx), PDF, Word (.doc / .docx) or text (.txt) file.",
        variant: "destructive",
      });
      return;
    }
    upload(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Upload your file</h3>
        <p className="text-sm text-muted-foreground">
          Supported: CSV, Excel (.xlsx), PDF, Word (.doc / .docx) and text (.txt). Max 20 MB.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        {...pressable(() => !isPending && fileRef.current?.click(), {
          label: "Choose a file to import",
        })}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        } ${isPending ? "pointer-events-none opacity-60" : ""}`}
      >
        {isPending ? (
          <>
            <RefreshCw className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="font-medium">Uploading…</p>
          </>
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Drop a file here, or click to browse</p>
            <p className="mt-1 text-sm text-muted-foreground">CSV · Excel · PDF · Word · Text</p>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Clear it, or picking the same file again (e.g. after closing it in
          // Excel) fires no change event.
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "configure", label: "Configure" },
  { key: "review", label: "Review" },
  { key: "commit", label: "Commit" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              i < idx
                ? "bg-primary text-primary-foreground"
                : i === idx
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < idx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={`hidden text-sm sm:inline ${i === idx ? "font-medium" : "text-muted-foreground"}`}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="h-px w-6 bg-muted" />}
        </div>
      ))}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>("history");
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const queryClient = useQueryClient();

  const handleUploaded = (batch: ImportBatch) => {
    setActiveBatch(batch);
    setStep("configure");
    queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
  };

  const handleOpen = (batch: ImportBatch) => {
    setActiveBatch(batch);
    setStep(stepForStatus(batch.status));
  };

  const handleBack = () => {
    setActiveBatch(null);
    setStep("history");
    queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
  };

  const handleBatchUpdate = (batch: ImportBatch) => {
    setActiveBatch(batch);
    queryClient.invalidateQueries({ queryKey: ["/api/imports"] });
  };

  if (step === "history") {
    return <HistoryList onNew={() => setStep("upload")} onOpen={handleOpen} />;
  }

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to imports
        </button>
        <StepIndicator current="upload" />
        <UploadStep onUploaded={handleUploaded} />
      </div>
    );
  }

  if (!activeBatch) return null;

  return (
    <div className="space-y-4">
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to imports
      </button>

      <div className="flex items-center justify-between gap-4">
        <StepIndicator current={step} />
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          {fileIcon(activeBatch.mime_type)}
          <span className="truncate">{activeBatch.file_name}</span>
        </div>
      </div>

      {step === "configure" && (
        <ImportMappingStep
          batch={activeBatch}
          onDone={(updated) => {
            handleBatchUpdate(updated);
            setStep("review");
          }}
        />
      )}
      {step === "review" && (
        <ImportReviewStep
          batch={activeBatch}
          onBatchChange={handleBatchUpdate}
          onDone={(updated) => {
            handleBatchUpdate(updated);
            setStep("commit");
          }}
        />
      )}
      {step === "commit" && (
        <ImportCommitStep
          batch={activeBatch}
          onBatchChange={handleBatchUpdate}
          onDone={handleBack}
        />
      )}
    </div>
  );
}
