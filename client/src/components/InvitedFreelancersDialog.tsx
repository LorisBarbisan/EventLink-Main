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
import type { JobApplication } from "@shared/types";
import { Users } from "lucide-react";

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
  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] flex flex-col gap-0 p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-gray-700" />
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Invited Freelancers
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-500 text-sm">
            Manage invitations for &quot;{jobTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-6 pb-6">
          <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col h-[300px]">
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {invitedApplications.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No invited freelancers found.
                  </div>
                ) : (
                  invitedApplications.map(app => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-gray-200">
                          {app.freelancer_profile?.profile_photo_url ? (
                            <AvatarImage src={app.freelancer_profile.profile_photo_url} />
                          ) : null}
                          <AvatarFallback className="bg-orange-100 text-orange-600 font-medium">
                            {app.freelancer_profile?.first_name?.[0] || "?"}
                            {app.freelancer_profile?.last_name?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {app.freelancer_profile
                              ? `${app.freelancer_profile.first_name} ${app.freelancer_profile.last_name}`
                              : `Freelancer #${app.freelancer_id}`}
                          </h4>
                          <div className="flex flex-col text-xs text-gray-500">
                            <span>{app.freelancer_profile?.title || "Freelancer"}</span>
                            <span className="text-muted-foreground mt-0.5">
                              Invited {formatDate(app.applied_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100"
                      >
                        {app.status === "invited" ? "Invited" : app.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-gray-50">
          <Button onClick={onClose} variant="outline" className="ml-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
