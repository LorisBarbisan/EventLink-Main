import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Zap, AlertTriangle, Download } from "lucide-react";

interface Invoice {
  id: number;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  total_pence: number;
  issue_date: string;
  due_date: string;
  to_details: { name?: string; company?: string } | null;
  booking_id: number | null;
  confidence_flags: string[] | null;
}

interface InvoicesSummary {
  outstanding_pence: number;
  overdue_pence: number;
  paid_last_90_pence: number;
}

const STATUS_COLORS: Record<Invoice["status"], string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function penceToGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function InvoiceRow({
  invoice,
  onMarkPaid,
}: {
  invoice: Invoice;
  onMarkPaid: (id: number) => void;
}) {
  const clientName = invoice.to_details?.company || invoice.to_details?.name || "—";

  return (
    <tr className="border-b transition-colors last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-mono text-sm">{invoice.invoice_number}</td>
      <td className="px-4 py-3 text-sm">{clientName}</td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">
        {penceToGBP(invoice.total_pence)}
      </td>
      <td className="px-4 py-3 text-sm">{invoice.issue_date}</td>
      <td className="px-4 py-3 text-sm">{invoice.due_date}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[invoice.status]}`}
        >
          {invoice.status === "overdue" && <AlertTriangle className="h-3 w-3" />}
          {invoice.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </a>
          {invoice.status === "sent" || invoice.status === "overdue" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onMarkPaid(invoice.id)}
            >
              Mark paid
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function InvoicesTab({ isPro }: { isPro: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    enabled: isPro,
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/invoices/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked as paid" });
    },
    onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
  });

  if (!isPro) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Invoices — Pro feature</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Generate invoices from completed bookings, chase late payments, and export records —
              all in one place.
            </p>
          </div>
          <Button className="gap-2" onClick={() => (window.location.href = "/upgrade")}>
            <Zap className="h-4 w-4" />
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Compute summary from loaded invoices
  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);

  const summary: InvoicesSummary = invoices.reduce(
    (acc, inv) => {
      if (inv.status === "sent") acc.outstanding_pence += inv.total_pence;
      if (inv.status === "overdue") {
        acc.outstanding_pence += inv.total_pence;
        acc.overdue_pence += inv.total_pence;
      }
      if (inv.status === "paid" && new Date(inv.issue_date) >= ninetyDaysAgo) {
        acc.paid_last_90_pence += inv.total_pence;
      }
      return acc;
    },
    { outstanding_pence: 0, overdue_pence: 0, paid_last_90_pence: 0 }
  );

  const filtered =
    statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {penceToGBP(summary.outstanding_pence)}
            </p>
          </CardContent>
        </Card>
        <Card className={summary.overdue_pence > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${summary.overdue_pence > 0 ? "text-red-600" : ""}`}
            >
              {penceToGBP(summary.overdue_pence)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Paid (last 90 days)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-green-600">
              {penceToGBP(summary.paid_last_90_pence)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.open("/api/invoices/export", "_blank")}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Invoice table */}
      {isLoading ? (
        <div className="flex justify-center py-8 text-muted-foreground">Loading invoices…</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "all" ? "No invoices yet." : `No ${statusFilter} invoices.`}
            </p>
            <p className="text-xs text-muted-foreground">
              You can create an invoice from any completed booking in the Bookings tab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Number</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Issued</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Due</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  onMarkPaid={(id) => markPaidMutation.mutate(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
