import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  email: string;
  role: 'freelancer' | 'recruiter';
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

export function NewConversationModal({ currentUser, onConversationCreated }: NewConversationModalProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  // Fetch freelancers or recruiters based on current user role
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: [currentUser.role === 'freelancer' ? '/api/recruiter-profiles' : '/api/freelancers'],
    queryFn: () => apiRequest(currentUser.role === 'freelancer' ? '/api/recruiter-profiles' : '/api/freelancers'),
    enabled: open,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (otherUserId: number) => {
      return apiRequest('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          userOneId: currentUser.id,
          userTwoId: otherUserId
        }),
      });
    },
    onSuccess: (conversation) => {
      setOpen(false);
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      onConversationCreated?.(conversation.id);
    },
  });

  const filteredProfiles = profiles.filter((profile: UserProfile) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    if (currentUser.role === 'freelancer') {
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
  });

  const getDisplayName = (profile: UserProfile) => {
    if (currentUser.role === 'freelancer') {
      return profile.company_name || 'Company';
    } else {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
    }
  };

  const getDisplaySubtext = (profile: UserProfile) => {
    if (currentUser.role === 'freelancer') {
      return profile.contact_name || 'Contact';
    } else {
      return 'Freelancer';
    }
  };

  const getInitials = (profile: UserProfile) => {
    if (currentUser.role === 'freelancer') {
      return profile.company_name?.substring(0, 2).toUpperCase() || 'CO';
    } else {
      const firstName = profile.first_name || '';
      const lastName = profile.last_name || '';
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:bg-primary-hover" data-testid="button-new-conversation">
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">
              Search {currentUser.role === 'freelancer' ? 'Recruiters' : 'Freelancers'}
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder={`Search ${currentUser.role === 'freelancer' ? 'companies' : 'freelancers'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading...
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2" />
                <p>No {currentUser.role === 'freelancer' ? 'recruiters' : 'freelancers'} found</p>
              </div>
            ) : (
              filteredProfiles.map((profile: UserProfile) => (
                <div
                  key={profile.id}
                  onClick={() => createConversationMutation.mutate(profile.user_id)}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  data-testid={`user-${profile.user_id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {getInitials(profile)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {getDisplayName(profile)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getDisplaySubtext(profile)}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {currentUser.role === 'freelancer' ? 'recruiter' : 'freelancer'}
                  </Badge>
                </div>
              ))
            )}
          </div>

          {createConversationMutation.isPending && (
            <div className="text-center py-2 text-muted-foreground">
              Creating conversation...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}