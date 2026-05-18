import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SendEnquiryModal } from "./SendEnquiryModal";
import { EnquiryResponsesPanel } from "./EnquiryResponsesPanel";
import { EnquiryArchiveModal } from "./EnquiryArchiveModal";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, ArchiveRestore, CalendarDays, Send } from "lucide-react";

interface EnquirySummary {
  id: number;
  eventTitle: string;
  eventDate: string;
  status: "active" | "closed" | "archived";
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
  const [archiveTarget, setArchiveTarget] = useState<{ id: number; title: string } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const { toast } = useToast();

  const { data: enquiries = [], isLoading } = useQuery<EnquirySummary[]>({
    queryKey: ["/api/enquiries"],
    queryFn: () => apiRequest("/api/enquiries"),
  });

  const { data: archivedEnquiries = [], isLoading: archivedLoading } = useQuery<EnquirySummary[]>({
    queryKey: ["/api/enquiries/archived"],
    queryFn: () => apiRequest("/api/enquiries/archived"),
    enabled: archivedOpen,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/enquiries/${id}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries/archived"] });
      setArchiveTarget(null);
      toast({ title: "Enquiry archived", description: "You can restore it from the Archived view." });
    },
    onError: (err: any) => {
      toast({ title: "Could not archive", description: err?.message ?? "Something went wrong.", variant: "destructive" });
      setArchiveTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/enquiries/${id}/reactivate`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries/archived"] });
      toast({ title: "Enquiry reactivated", description: "The enquiry is now active again." });
    },
    onError: (err: any) => {
      toast({ title: "Could not reactivate", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    },
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
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setArchivedOpen(true)}
          className="flex items-center gap-1.5 text-muted-foreground"
        >
          <Archive className="h-3.5 w-3.5" />
          View Archived
        </Button>
        <Button onClick={() => setSendOpen(true)} className="bg-orange-500 hover:bg-orange-600">
          <Send className="mr-2 h-4 w-4" />
          New Enquiry
        </Button>
      </div>

      {/* Active / closed enquiries */}
      <div className="space-y-4">
        {enquiries.map((enq) => (
          <EnquiryCard
            key={enq.id}
            enq={enq}
            selectedEnquiryId={selectedEnquiryId}
            setSelectedEnquiryId={setSelectedEnquiryId}
            onArchive={() => setArchiveTarget({ id: enq.id, title: enq.eventTitle })}
          />
        ))}
      </div>

      <SendEnquiryModal open={sendOpen} onOpenChange={setSendOpen} />

      {/* Archived enquiries dialog */}
      <Dialog open={archivedOpen} onOpenChange={setArchivedOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Archived Enquiries
            </DialogTitle>
          </DialogHeader>
          {archivedLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : archivedEnquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No archived enquiries.</p>
          ) : (
            <div className="space-y-3">
              {archivedEnquiries.map((enq) => (
                <Card key={enq.id} className="opacity-80">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5 min-w-0">
                        <h3 className="text-sm font-semibold leading-tight text-muted-foreground">
                          {enq.eventTitle}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {enq.eventDate}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 self-start flex items-center gap-1.5"
                        disabled={reactivateMutation.isPending}
                        onClick={() => reactivateMutation.mutate(enq.id)}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Reactivate
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {enq.summary.yes > 0 && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                          {enq.summary.yes} Yes
                        </Badge>
                      )}
                      {enq.summary.maybe > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                          {enq.summary.maybe} Maybe
                        </Badge>
                      )}
                      {enq.summary.no > 0 && (
                        <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">
                          {enq.summary.no} No
                        </Badge>
                      )}
                      {enq.summary.pending > 0 && (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                          {enq.summary.pending} Pending
                        </Badge>
                      )}
                      {enq.summary.total === 0 && (
                        <span className="text-xs text-muted-foreground">No responses</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EnquiryArchiveModal
        open={archiveTarget !== null}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        enquiryTitle={archiveTarget?.title ?? ""}
        onConfirm={() => { if (archiveTarget) archiveMutation.mutate(archiveTarget.id); }}
        isPending={archiveMutation.isPending}
      />
    </>
  );
}

interface CardProps {
  enq: EnquirySummary;
  selectedEnquiryId: number | null;
  setSelectedEnquiryId: (id: number | null) => void;
  onArchive: () => void;
}

function EnquiryCard({ enq, selectedEnquiryId, setSelectedEnquiryId, onArchive }: CardProps) {
  return (
    <div>
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

            <div className="flex items-center gap-2 shrink-0 self-start">
              {enq.status === "closed" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground px-2"
                  title="Archive this enquiry"
                  onClick={onArchive}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelectedEnquiryId(selectedEnquiryId === enq.id ? null : enq.id)
                }
              >
                {selectedEnquiryId === enq.id ? "Hide Details" : "Details"}
              </Button>
            </div>
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
  );
}
