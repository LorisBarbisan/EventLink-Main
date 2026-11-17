import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { Download } from "lucide-react";

/** Download the year-end workbook with the signed-in user's token. */
export async function downloadBooksWorkbook(): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem("auth_token");
  } catch {
    /* storage blocked: the request fails with 401 and says so */
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

function DownloadButton({ label = "Download your workbook" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        downloadBooksWorkbook()
          .catch((e: Error) => toast({ title: e.message, variant: "destructive" }))
          .finally(() => setBusy(false));
      }}
    >
      <Download className="mr-1.5 h-4 w-4" />
      {busy ? "Preparing…" : label}
    </Button>
  );
}

/**
 * For a freelancer whose Books are hidden (based outside the UK) but who has
 * records from before: say why Books has gone and let them take their records.
 */
export function BooksHiddenNotice() {
  const { data } = useQuery<{ has_records: boolean }>({
    queryKey: ["/api/books/records-held"],
    queryFn: () => apiRequest("/api/books/records-held"),
    retry: false,
  });
  if (!data?.has_records) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">Your books are still here</p>
        <p className="text-sm text-muted-foreground">
          Books is for UK-based freelancers, so it&apos;s hidden while your profile country is
          outside the UK. Your earnings and expenses are kept, and you can download them any time.
        </p>
      </div>
      <DownloadButton />
    </div>
  );
}

/**
 * Asked before saving a profile that moves a freelancer out of the UK: their
 * Books will be hidden, so offer the workbook first.
 */
export function LeavingUkDialog({
  open,
  newCountry,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  newCountry: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change your country to {newCountry}?</DialogTitle>
          <DialogDescription>
            Books is for UK-based freelancers. Once you save, the Books tab will be hidden. Your
            records are kept and you can still download them, but you won&apos;t be able to add to
            them or see them in the app.
          </DialogDescription>
        </DialogHeader>
        <div>
          <DownloadButton label="Download your workbook first" />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            Keep United Kingdom
          </Button>
          <Button onClick={onConfirm}>Change country</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
