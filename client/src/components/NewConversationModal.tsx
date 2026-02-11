import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, User } from "lucide-react";
import { useState } from "react";

interface User {
  id: number;
  email: string;
  role: "freelancer" | "recruiter";
  deleted_at?: string | null;
}

interface UserProfile {
  id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  contact_name?: string;
}

interface NewConversationModalProps {
  currentUser: User;
  onConversationCreated?: (conversationId: number) => void;
}

export function NewConversationModal({
  currentUser,
  onConversationCreated,
}: NewConversationModalProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contactType, setContactType] = useState<"freelancers" | "recruiters">(
    currentUser.role === "freelancer" ? "recruiters" : "freelancers"
  );
  const queryClient = useQueryClient();

  // Fetch profiles based on selected contact type
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: [contactType === "freelancers" ? "/api/freelancers" : "/api/recruiter-profiles"],
    queryFn: () =>
      apiRequest(contactType === "freelancers" ? "/api/freelancers" : "/api/recruiter-profiles"),
    enabled: open,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async ({
      otherUserId,
      initialMessage,
    }: {
      otherUserId: number;
      initialMessage: string;
    }) => {
      return apiRequest("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          userTwoId: otherUserId,
          initialMessage: initialMessage,
        }),
      });
    },
    onSuccess: conversation => {
      setOpen(false);
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      onConversationCreated?.(conversation.id);
    },
  });

  const filteredProfiles = profiles
    .filter((profile: UserProfile) => {
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();

      if (contactType === "recruiters") {
        // Searching recruiters
        return (
          profile.company_name?.toLowerCase().includes(searchLower) ||
          profile.contact_name?.toLowerCase().includes(searchLower)
        );
      } else {
        // Searching freelancers
        return (
          profile.first_name?.toLowerCase().includes(searchLower) ||
          profile.last_name?.toLowerCase().includes(searchLower) ||
          `${profile.first_name} ${profile.last_name}`.toLowerCase().includes(searchLower)
        );
      }
    })
    .filter((profile: UserProfile) => {
      // Don't show current user in the list
      return profile.user_id !== currentUser.id;
    });

  const getDisplayName = (profile: UserProfile) => {
    if (contactType === "recruiters") {
      return profile.company_name || "Company";
    } else {
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";
    }
  };

  const getDisplaySubtext = (profile: UserProfile) => {
    if (contactType === "recruiters") {
      return profile.contact_name || "Contact";
    } else {
      return "Freelancer";
    }
  };

  const getInitials = (profile: UserProfile) => {
    if (contactType === "recruiters") {
      return profile.company_name?.substring(0, 2).toUpperCase() || "CO";
    } else {
      const firstName = profile.first_name || "";
      const lastName = profile.last_name || "";
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "U";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-gradient-primary hover:bg-primary-hover"
          data-testid="button-new-conversation"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Contact Type Selection (only for freelancers) */}
          {currentUser.role === "freelancer" && (
            <Tabs
              value={contactType}
              onValueChange={value => {
                setContactType(value as "freelancers" | "recruiters");
                setSearchTerm(""); // Clear search when switching tabs
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recruiters">Employers</TabsTrigger>
                <TabsTrigger value="freelancers">Freelancers</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="space-y-2">
            <Label htmlFor="search">
              Search {contactType === "recruiters" ? "Employers" : "Freelancers"}
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder={`Search ${contactType === "recruiters" ? "companies" : "freelancers"}...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2" />
                <p>No {contactType} found</p>
              </div>
            ) : (
              filteredProfiles.map((profile: UserProfile) => (
                <div
                  key={profile.id}
                  onClick={() =>
                    createConversationMutation.mutate({
                      otherUserId: profile.user_id,
                      initialMessage:
                        "Hello! I'd like to connect with you regarding potential opportunities.",
                    })
                  }
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  data-testid={`user-${profile.user_id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {getInitials(profile)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getDisplayName(profile)}</p>
                    <p className="text-sm text-muted-foreground">{getDisplaySubtext(profile)}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {currentUser.role === "freelancer" ? "employer" : "freelancer"}
                  </Badge>
                </div>
              ))
            )}
          </div>

          {createConversationMutation.isPending && (
            <div className="text-center py-2 text-muted-foreground">Creating conversation...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
