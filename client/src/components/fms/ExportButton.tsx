import { useState } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type ExportType = "bookings" | "crew" | "availability";
type ExportFormat = "excel" | "csv";

const FORMAT_EXT: Record<ExportFormat, string> = { excel: "xlsx", csv: "csv" };

export function ExportButton() {
  const { toast } = useToast();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingExport, setPendingExport] = useState<{
    type: ExportType;
    format: ExportFormat;
  } | null>(null);

  // Default: current year start → today
  const today = new Date().toISOString().split("T")[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo] = useState(today);
  const [isDownloading, setIsDownloading] = useState(false);

  const triggerDownload = async (
    type: ExportType,
    format: ExportFormat,
    from?: string,
    to?: string
  ) => {
    setIsDownloading(true);
    try {
      const ext = FORMAT_EXT[format];
      const params = new URLSearchParams();
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      const url = `/api/export/${type}/${ext}?${params}`;

      const res = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const downloadName = match?.[1] ?? `export.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Export downloaded" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsDownloading(false);
      setDatePickerOpen(false);
      setPendingExport(null);
    }
  };

  const handleExportClick = (type: ExportType, format: ExportFormat) => {
    setPendingExport({ type, format });
    setDatePickerOpen(true);
  };

  const handleDownload = () => {
    if (!pendingExport) return;
    triggerDownload(pendingExport.type, pendingExport.format, dateFrom, dateTo);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Bookings
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleExportClick("bookings", "excel")}>
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportClick("bookings", "csv")}>
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Crew List
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => triggerDownload("crew", "excel")}>
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerDownload("crew", "csv")}>
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Availability
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleExportClick("availability", "excel")}>
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportClick("availability", "csv")}>
            CSV (.csv)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date range picker dialog */}
      <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Select date range</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDatePickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isDownloading || !dateFrom || !dateTo}
              className="bg-orange-500 hover:bg-orange-600 gap-2"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
