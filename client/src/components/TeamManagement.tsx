import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Mail, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";

type TeamMemberRole = "admin" | "manager" | "viewer";

interface TeamMemberRecord {
  id: number;
  role: TeamMemberRole;
  invitedEmail: string;
  inviteAccepted: boolean;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
  userId: number | null;
  firstName: string | null;
  lastName: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-orange-100 text-orange-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-700",
};

function canManageTeam(teamRole: string | null | undefined): boolean {
  return teamRole === "owner" || teamRole === "admin";
}

export function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const manageTeam = canManageTeam(user?.teamRole);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>("manager");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery<TeamMemberRecord[]>({
    queryKey: ["/api/team"],
    queryFn: () => apiRequest("/api/team"),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest("/api/team/invite", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setInviteSuccess(variables.email);
      setInviteEmail("");
      setInviteRole("manager");
      toast({ title: "Invitation sent", description: `Invitation sent to ${variables.email}` });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send invitation",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest("/api/team/invite", {
        method: "POST",
        body: JSON.stringify({ ...data, resend: true }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (_data, variables) => {
      toast({ title: "Invitation resent", description: `Invitation resent to ${variables.email}` });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to resend",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiRequest(`/api/team/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update role",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/team/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Team member removed" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to remove member",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSuccess(null);
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const displayName = (m: TeamMemberRecord) =>
    m.firstName && m.lastName
      ? `${m.firstName} ${m.lastName}`
      : m.invitedEmail;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Team Management</h2>
        <p className="text-muted-foreground">
          Invite team members to access your company dashboard
        </p>
      </div>

      {/* Current team members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p>No team members yet. Invite someone below.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{displayName(member)}</p>
                        {member.firstName && (
                          <p className="text-xs text-muted-foreground">
                            {member.invitedEmail}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${ROLE_COLORS[member.role] || ROLE_COLORS.manager}`}
                      >
                        {ROLE_LABELS[member.role] || member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.inviteAccepted ? (
                        <Badge className="bg-green-100 text-xs text-green-700">Active</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-xs text-yellow-700">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {manageTeam ? (
                        <div className="flex items-center justify-end gap-2">
                          {!member.inviteAccepted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                resendMutation.mutate({
                                  email: member.invitedEmail,
                                  role: member.role,
                                })
                              }
                              disabled={resendMutation.isPending}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Resend
                            </Button>
                          )}
                          {member.inviteAccepted &&
                            member.userId !== user?.companyId &&
                            member.userId !== user?.id && (
                              <Select
                                value={member.role}
                                onValueChange={(role) =>
                                  updateRoleMutation.mutate({ id: member.id, role })
                                }
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          {member.userId !== user?.companyId && member.userId !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeMutation.mutate(member.id)}
                              disabled={removeMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite new member */}
      {manageTeam ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteSuccess(null);
                  }}
                  required
                />
              </div>
              <div className="w-full space-y-1.5 sm:w-40">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as TeamMemberRole)}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600"
                disabled={inviteMutation.isPending || !inviteEmail.trim()}
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Invitation
              </Button>
            </div>

            {inviteSuccess && (
              <p className="text-sm text-green-600">
                Invitation sent to {inviteSuccess}
              </p>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Role permissions:</p>
              <ul className="space-y-0.5">
                <li><span className="font-medium">Admin</span> — Full access except billing. Can invite and remove members.</li>
                <li><span className="font-medium">Manager</span> — Post jobs, manage bookings, rate freelancers. Cannot manage team.</li>
                <li><span className="font-medium">Viewer</span> — View-only access to all dashboard data.</li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only company owners and admins can invite or manage team members.
        </p>
      )}
    </div>
  );
}
