import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, Send, UserPlus } from "lucide-react";
import { useState } from "react";

interface ExistingApplication {
  freelancer_id: number;
  status: string;
}

interface InviteFreelancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: number;
  jobTitle: string;
  alreadyInvitedIds?: number[];
  existingApplications?: ExistingApplication[];
}

export function InviteFreelancerModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  alreadyInvitedIds = [],
  existingApplications = [],
}: InviteFreelancerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFreelancers, setSelectedFreelancers] = useState<Set<number>>(new Set());

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["/api/freelancers/search", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("keyword", searchQuery);
      params.append("limit", "10");
      const response = await fetch(`/api/freelancers/search?${params}`);
      if (!response.ok) throw new Error("Failed to fetch freelancers");
      return await response.json();
    },
    enabled: isOpen,
  });

  const freelancers = searchResults?.results || [];

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const promises = Array.from(selectedFreelancers).map((freelancerId) =>
        apiRequest("/api/applications/invite", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            freelancerId,
            message: `I'd like to invite you to apply for my job: ${jobTitle}`,
          }),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Invitations Sent",
        description: `Successfully sent invitations to ${selectedFreelancers.size} freelancer${selectedFreelancers.size > 1 ? "s" : ""}.`,
      });
      setSelectedFreelancers(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter"] });
      onClose();
    },
    onError: (error: any) => {
      console.error("Invite error:", error);
      toast({
        title: "Error",
        description: "Failed to send some invitations. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedFreelancers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedFreelancers(newSelection);
  };

  const getFreelancerStatus = (userId: number): string | null => {
    if (alreadyInvitedIds.includes(userId)) {
      const app = existingApplications.find((a) => a.freelancer_id === userId);
      if (app) return app.status;
      return "invited";
    }
    const app = existingApplications.find((a) => a.freelancer_id === userId);
    if (app) return app.status;
    return null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "invited":
        return (
          <Badge variant="secondary" className="border-none bg-blue-100 font-medium text-blue-700">
            Invited
          </Badge>
        );
      case "applied":
        return (
          <Badge
            variant="secondary"
            className="border-none bg-purple-100 font-medium text-purple-700"
          >
            Applied
          </Badge>
        );
      case "hired":
        return (
          <Badge
            variant="secondary"
            className="border-none bg-green-100 font-medium text-green-700"
          >
            Hired
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="secondary" className="border-none bg-gray-100 font-medium text-gray-600">
            Declined
          </Badge>
        );
      case "reviewed":
      case "shortlisted":
        return (
          <Badge
            variant="secondary"
            className="border-none bg-amber-100 font-medium text-amber-700"
          >
            In Review
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="border-none bg-red-100 font-medium text-red-600">
            Declined
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="border-none bg-gray-100 font-medium text-gray-600">
            {status}
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[600px] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-[600px]">
        <DialogHeader className="p-6 pb-2">
          <div className="mb-1 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gray-700" />
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Invite Freelancers
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-500">
            Invite freelancers to apply for "{jobTitle}". They will receive an email notification.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search freelancers by name, skills, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-orange-200 pl-9 focus-visible:ring-orange-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 px-6 py-2">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200">
            <ScrollArea className="flex-1">
              <div className="p-2">
                {isLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : freelancers.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No freelancers found matching your search.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {freelancers.map((freelancer: any) => {
                      const existingStatus = getFreelancerStatus(freelancer.user_id);
                      const hasExistingRelation = !!existingStatus;
                      const isSelected = selectedFreelancers.has(freelancer.user_id);

                      return (
                        <div
                          key={freelancer.user_id}
                          className={`group flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${
                            hasExistingRelation
                              ? "cursor-default border-gray-100 bg-gray-50 opacity-75"
                              : isSelected
                                ? "border-orange-200 bg-orange-50"
                                : "border-transparent hover:bg-gray-50"
                          }`}
                          onClick={() =>
                            !hasExistingRelation && toggleSelection(freelancer.user_id)
                          }
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={freelancer.profile_photo_url} />
                              <AvatarFallback className="bg-orange-100 font-medium text-orange-600">
                                {freelancer.first_name?.[0]}
                                {freelancer.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900">
                                {freelancer.first_name} {freelancer.last_name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {freelancer.title || "Freelancer"}
                              </p>
                            </div>
                          </div>

                          {hasExistingRelation
                            ? getStatusBadge(existingStatus!)
                            : isSelected && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="mt-auto border-t p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-sm font-medium text-gray-500">
              {selectedFreelancers.size > 0
                ? `${selectedFreelancers.size} freelancer${selectedFreelancers.size > 1 ? "s" : ""} selected`
                : "Select freelancers to invite"}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                Cancel
              </Button>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={selectedFreelancers.size === 0 || inviteMutation.isPending}
                className="border-none bg-[#EFA068] text-white hover:bg-[#E59058]"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Invitations
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
