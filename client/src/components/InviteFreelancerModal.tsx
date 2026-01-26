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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, Search, Send, UserPlus } from "lucide-react";
import { useState } from "react";

interface InviteFreelancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: number;
  jobTitle: string;
  alreadyInvitedIds?: number[];
}

export function InviteFreelancerModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  alreadyInvitedIds = [],
}: InviteFreelancerModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFreelancers, setSelectedFreelancers] = useState<Set<number>>(new Set());

  // Fetch freelancers
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
    enabled: isOpen, // Only fetch when open
  });

  const freelancers = searchResults?.results || [];

  // Send invitations mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const promises = Array.from(selectedFreelancers).map(freelancerId =>
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
        description: `Successfully sent invitations to ${selectedFreelancers.size} freelancers.`,
      });
      setSelectedFreelancers(new Set()); // Reset selection
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

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-5 h-5 text-gray-700" />
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Invite Freelancers
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-500 text-sm">
            Invite freelancers to apply for "{jobTitle}". They will receive an email notification.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search freelancers by name, skills, or title..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 border-orange-200 focus-visible:ring-orange-500"
            />
          </div>
        </div>

        <div className="flex-1 px-6 py-2 min-h-0">
          <div className="border border-gray-200 rounded-lg h-full overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-2">
                {isLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : freelancers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No freelancers found matching your search.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {freelancers.map((freelancer: any) => {
                      const isAlreadyInvited = alreadyInvitedIds.includes(freelancer.user_id);
                      const isSelected = selectedFreelancers.has(freelancer.user_id);

                      return (
                        <div
                          key={freelancer.user_id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group ${
                            isAlreadyInvited
                              ? "bg-gray-50 border-gray-100 opacity-75 cursor-default"
                              : isSelected
                                ? "border-orange-200 bg-orange-50"
                                : "border-transparent hover:bg-gray-50"
                          }`}
                          onClick={() => !isAlreadyInvited && toggleSelection(freelancer.user_id)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={freelancer.profile_photo_url} />
                              <AvatarFallback className="bg-orange-100 text-orange-600 font-medium">
                                {freelancer.first_name?.[0]}
                                {freelancer.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm">
                                {freelancer.first_name} {freelancer.last_name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {freelancer.title || "Freelancer"}
                              </p>
                            </div>
                          </div>

                          {isAlreadyInvited ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-medium"
                            >
                              Invited
                            </Badge>
                          ) : (
                            isSelected && (
                              <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )
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

        <div className="p-4 border-t mt-auto">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-gray-500 font-medium">Select freelancers to invite</div>
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
                className="bg-[#EFA068] hover:bg-[#E59058] text-white border-none"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
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
