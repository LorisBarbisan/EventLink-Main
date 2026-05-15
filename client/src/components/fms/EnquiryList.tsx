import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SendEnquiryModal } from "./SendEnquiryModal";
import { EnquiryResponsesPanel } from "./EnquiryResponsesPanel";
import { CalendarDays, Send } from "lucide-react";

interface EnquirySummary {
  id: number;
  eventTitle: string;
  eventDate: string;
  status: "active" | "closed";
  createdAt: string;
  summary: {
    total: number;
    yes: number;
    no: number;
    maybe: number;
    pending: number;
  };
}

export function EnquiryList() {
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<number | null>(null);

  const { data: enquiries = [], isLoading } = useQuery<EnquirySummary[]>({
    queryKey: ["/api/enquiries"],
    queryFn: () => apiRequest("/api/enquiries"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (enquiries.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Send className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No availability enquiries sent yet</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Send availability checks to your saved freelancers before committing to a booking.
            </p>
            <Button
              onClick={() => setSendOpen(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Send className="mr-2 h-4 w-4" />
              Send your first enquiry
            </Button>
          </CardContent>
        </Card>
        <SendEnquiryModal open={sendOpen} onOpenChange={setSendOpen} />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setSendOpen(true)} className="bg-orange-500 hover:bg-orange-600">
          <Send className="mr-2 h-4 w-4" />
          New Enquiry
        </Button>
      </div>

      <div className="space-y-4">
        {enquiries.map((enq) => (
          <div key={enq.id}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold leading-tight">{enq.eventTitle}</h3>
                      <Badge
                        variant={enq.status === "active" ? "default" : "secondary"}
                        className={
                          enq.status === "active"
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {enq.status === "active" ? "Active" : "Closed"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {enq.eventDate}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start"
                    onClick={() =>
                      setSelectedEnquiryId(selectedEnquiryId === enq.id ? null : enq.id)
                    }
                  >
                    {selectedEnquiryId === enq.id ? "Hide Details" : "Details"}
                  </Button>
                </div>

                {/* Response summary badges */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {enq.summary.yes > 0 && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      {enq.summary.yes} Yes
                    </Badge>
                  )}
                  {enq.summary.maybe > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                      {enq.summary.maybe} Maybe
                    </Badge>
                  )}
                  {enq.summary.no > 0 && (
                    <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">
                      {enq.summary.no} No
                    </Badge>
                  )}
                  {enq.summary.pending > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {enq.summary.pending} Pending
                    </Badge>
                  )}
                  {enq.summary.total === 0 && (
                    <span className="text-xs text-muted-foreground">No responses yet</span>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Sent {format(new Date(enq.createdAt), "d MMM yyyy")}
                </p>
              </CardContent>
            </Card>

            {selectedEnquiryId === enq.id && (
              <div className="mt-2 rounded-lg border bg-muted/30">
                <EnquiryResponsesPanel
                  enquiryId={enq.id}
                  onClose={() => setSelectedEnquiryId(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <SendEnquiryModal open={sendOpen} onOpenChange={setSendOpen} />
    </>
  );
}
