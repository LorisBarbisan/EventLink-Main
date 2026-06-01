import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { MoreVertical, UserPlus, Users, Loader2, X, ArrowRightLeft } from "lucide-react";
import { InviteMemberModal } from "./InviteMemberModal";

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-[#1E3A5F] text-white border-0" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700 border-0" },
  manager: { label: "Manager", className: "bg-gray-100 text-gray-600 border-0" },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-100 text-green-700 border-0" },
  invited: { label: "Invited", className: "bg-amber-100 text-amber-700 border-0" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-700 border-0" },
};

function MemberAvatar({ firstName, lastName, photoUrl }: { firstName?: string | null; lastName?: string | null; photoUrl?: string | null }) {
  const initials = `${(firstName ?? "?")[0]}${(lastName ?? "")[0] ?? ""}`.toUpperCase();
  if (photoUrl) {
    return <img src={photoUrl} alt={initials} className="w-9 h-9 rounded-full object-cover" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

interface TeamData {
  team: { id: number; name: string; ownerId: number } | null;
  role: string | null;
  isOwner: boolean;
  members: Array<{
    member: { id: number; userId: number | null; role: string; status: string };
    user: { id: number; email: string; first_name: string; last_name: string } | null;
    profile: { company_name: string | null; profile_photo_url: string | null } | null;
  }>;
  delegateAccess: Array<{ id: number; delegatorUserId: number; delegateUserId: number; grantedByUserId: number }>;
  seatLimit: number;
  seatsUsed: number;
}

interface SubStatus {
  tier: string;
  status: string;
}

export function TeamManagementPanel() {
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [delegatorId, setDelegatorId] = useState<string>("");
  const [delegateId, setDelegateId] = useState<string>("");

  const { data: teamData, isLoading } = useQuery<TeamData>({
    queryKey: ["/api/team"],
    queryFn: () => apiRequest("/api/team"),
  });

  const { data: sub } = useQuery<SubStatus>({
    queryKey: ["/api/subscription/status"],
    queryFn: () => apiRequest("/api/subscription/status"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ targetUserId, role }: { targetUserId: number; role: string }) =>
      apiRequest("/api/team/members/role", {
        method: "PATCH",
        body: JSON.stringify({ targetUserId, role }),
      }),
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest(`/api/team/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setConfirmRemove(null);
    },
    onError: (err: any) => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const grantDelegateMutation = useMutation({
    mutationFn: ({ delegatorUserId, delegateUserId }: { delegatorUserId: number; delegateUserId: number }) =>
      apiRequest("/api/team/delegate", {
        method: "POST",
        body: JSON.stringify({ delegatorUserId, delegateUserId }),
      }),
    onSuccess: () => {
      toast({ title: "Delegate access granted" });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setDelegatorId("");
      setDelegateId("");
    },
    onError: () => toast({ title: "Failed to grant access", variant: "destructive" }),
  });

  const revokeDelegateMutation = useMutation({
    mutationFn: ({ delegatorUserId, delegateUserId }: { delegatorUserId: number; delegateUserId: number }) =>
      apiRequest("/api/team/delegate", {
        method: "DELETE",
        body: JSON.stringify({ delegatorUserId, delegateUserId }),
      }),
    onSuccess: () => {
      toast({ title: "Delegate access revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    },
    onError: () => toast({ title: "Failed to revoke access", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!teamData?.team && sub?.tier !== "teams") {
    return (
      <div className="text-center py-12 space-y-4">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-semibold">Team accounts are available on the Teams plan</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Upgrade to Teams to invite colleagues and collaborate together.
          </p>
        </div>
        <Link href="/pricing">
          <Button className="bg-orange-500 hover:bg-orange-600">Upgrade to Teams</Button>
        </Link>
      </div>
    );
  }

  if (!teamData?.team) {
    return (
      <div className="flex items-center gap-3 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        <span className="text-muted-foreground">Setting up your team…</span>
      </div>
    );
  }

  const { team, role, isOwner, members, delegateAccess, seatLimit, seatsUsed } = teamData;
  const isAdmin = role === "admin" || isOwner;
  const seatPct = Math.min((seatsUsed / seatLimit) * 100, 100);

  const activeMembers = members.filter((m) => m.member.status === "active");

  const getMemberName = (userId: number) => {
    const m = members.find((m) => m.member.userId === userId);
    if (!m?.user) return `User ${userId}`;
    return `${m.user.first_name} ${m.user.last_name}`.trim();
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Team header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 flex-1">
          <h3 className="text-xl font-bold">{team.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{seatsUsed} of {seatLimit} seats used</span>
          </div>
          <Progress value={seatPct} className="h-2 w-48" />
          {seatsUsed >= seatLimit && (
            <p className="text-xs text-amber-700">
              Seat limit reached.{" "}
              <Link href="/pricing" className="underline">Upgrade</Link> to add more members.
            </p>
          )}
        </div>
        {isAdmin && (
          <Button
            className="bg-orange-500 hover:bg-orange-600 gap-2"
            onClick={() => setShowInvite(true)}
            disabled={seatsUsed >= seatLimit}
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members table */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-800">Team Members</h4>
        <div className="rounded-lg border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Member</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => {
                const roleCfg = ROLE_BADGE[m.member.role] ?? ROLE_BADGE.manager;
                const statusCfg = STATUS_BADGE[m.member.status] ?? STATUS_BADGE.active;
                const isThisOwner = m.member.role === "owner";
                const canChangeRole = isAdmin && !isThisOwner;
                const canRemove = isOwner && !isThisOwner;

                return (
                  <tr key={m.member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          firstName={m.user?.first_name}
                          lastName={m.user?.last_name}
                          photoUrl={m.profile?.profile_photo_url}
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {m.user
                              ? `${m.user.first_name} ${m.user.last_name}`.trim()
                              : m.member.inviteEmail ?? "Pending"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.user?.email ?? m.member.inviteEmail ?? ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${roleCfg.className} text-xs`}>{roleCfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusCfg.className} text-xs`}>{statusCfg.label}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {(canChangeRole || canRemove) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canChangeRole && m.member.role !== "admin" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateRoleMutation.mutate({
                                      targetUserId: m.member.userId!,
                                      role: "admin",
                                    })
                                  }
                                >
                                  Promote to Admin
                                </DropdownMenuItem>
                              )}
                              {canChangeRole && m.member.role !== "manager" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateRoleMutation.mutate({
                                      targetUserId: m.member.userId!,
                                      role: "manager",
                                    })
                                  }
                                >
                                  Change to Manager
                                </DropdownMenuItem>
                              )}
                              {canRemove && (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => setConfirmRemove(m.member.userId!)}
                                >
                                  Remove Member
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delegate Access */}
      {isAdmin && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-800">Delegate Access</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Allow a team member to manage bookings on behalf of another
            </p>
          </div>

          {delegateAccess.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Delegate</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Can act on behalf of</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {delegateAccess.map((da) => (
                    <tr key={da.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{getMemberName(da.delegateUserId)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <ArrowRightLeft className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                        {getMemberName(da.delegatorUserId)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:text-red-700"
                          onClick={() =>
                            revokeDelegateMutation.mutate({
                              delegatorUserId: da.delegatorUserId,
                              delegateUserId: da.delegateUserId,
                            })
                          }
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border">
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <p className="text-xs font-medium text-gray-600">Delegate (who will act)</p>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select member…" />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.member.id} value={String(m.member.userId ?? "")}>
                      {m.user ? `${m.user.first_name} ${m.user.last_name}`.trim() : "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <p className="text-xs font-medium text-gray-600">On behalf of</p>
              <Select value={delegatorId} onValueChange={setDelegatorId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select member…" />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers
                    .filter((m) => String(m.member.userId) !== delegateId)
                    .map((m) => (
                      <SelectItem key={m.member.id} value={String(m.member.userId ?? "")}>
                        {m.user ? `${m.user.first_name} ${m.user.last_name}`.trim() : "Unknown"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 h-9"
              disabled={!delegateId || !delegatorId || grantDelegateMutation.isPending}
              onClick={() =>
                grantDelegateMutation.mutate({
                  delegatorUserId: parseInt(delegatorId),
                  delegateUserId: parseInt(delegateId),
                })
              }
            >
              {grantDelegateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add Delegate Access"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <InviteMemberModal open={showInvite} onOpenChange={setShowInvite} />

      <AlertDialog open={confirmRemove !== null} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {confirmRemove ? getMemberName(confirmRemove) : "this member"} from
              the team. Their records will remain on the account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmRemove && removeMutation.mutate(confirmRemove)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
