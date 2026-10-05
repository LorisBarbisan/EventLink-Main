import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { JobApplication } from "@shared/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users, X } from "lucide-react";
import { useState } from "react";

interface InvitedFreelancersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle: string;
  invitedApplications: JobApplication[];
}

export function InvitedFreelancersDialog({
  isOpen,
  onClose,
  jobTitle,
  invitedApplications,
}: InvitedFreelancersDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<number | null>(null);

  const withdrawMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/applications/${applicationId}/invite`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to withdraw invitation" }));
        throw new Error(err.error || "Failed to withdraw invitation");
      }
      return applicationId;
    },
    onSuccess: (applicationId) => {
      toast({
        title: "Invitation withdrawn",
        description: "The freelancer has been notified.",
      });
      setRemovingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setRemovingId(null);
    },
  });

  const handleRemove = (applicationId: number) => {
    setRemovingId(applicationId);
    withdrawMutation.mutate(applicationId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filter out the ones we just removed optimistically
  const visibleApplications = invitedApplications.filter(
    (app) => app.id !== removingId || !withdrawMutation.isPending
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-[500px]">
        <DialogHeader className="p-6 pb-4">
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-700" />
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Invited Freelancers
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-500">
            Manage invitations for &quot;{jobTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 px-6 pb-6">
          <div className="flex h-[300px] flex-col overflow-hidden rounded-lg border border-gray-200">
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-2">
                {visibleApplications.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    No invited freelancers found.
                  </div>
                ) : (
                  visibleApplications.map((app) => {
                    const isRemoving = withdrawMutation.isPending && removingId === app.id;
                    const canRemove = app.status === "invited";

                    return (
                      <div
                        key={app.id}
                        className={`flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:bg-gray-50 ${isRemoving ? "opacity-50" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0 border border-gray-200">
                            {app.freelancer_profile?.profile_photo_url ? (
                              <AvatarImage src={app.freelancer_profile.profile_photo_url} />
                            ) : null}
                            <AvatarFallback className="bg-orange-100 font-medium text-orange-600">
                              {app.freelancer_profile?.first_name?.[0] || "?"}
                              {app.freelancer_profile?.last_name?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-gray-900">
                              {app.freelancer_profile
                                ? `${app.freelancer_profile.first_name} ${app.freelancer_profile.last_name}`
                                : `Freelancer #${app.freelancer_id}`}
                            </h4>
                            <div className="flex flex-col text-xs text-gray-500">
                              <span className="truncate">
                                {app.freelancer_profile?.title || "Freelancer"}
                              </span>
                              <span className="mt-0.5 text-muted-foreground">
                                Invited {formatDate(app.applied_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            {app.status === "invited" ? "Invited" : app.status}
                          </Badge>
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleRemove(app.id)}
                              disabled={isRemoving}
                              title="Withdraw invitation"
                            >
                              {isRemoving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t bg-gray-50 p-4">
          <Button onClick={onClose} variant="outline" className="ml-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
