/** Resolved employer company + team role for API auth and session payloads. */
export type ResolvedTeamContext = {
  companyId: number;
  teamRole: "owner" | "admin" | "manager" | "viewer";
  isTeamMember: boolean;
};

type TeamMembershipRow = {
  companyId: number;
  role: string;
  inviteAccepted: boolean;
};

/**
 * Company account holders (user id === company id) are always owners,
 * even if they also have a team_members row from a self-invite or bad data.
 */
export function resolveTeamContextForUser(
  userId: number,
  membership?: TeamMembershipRow | null
): ResolvedTeamContext {
  if (membership?.inviteAccepted) {
    if (userId === membership.companyId) {
      return {
        companyId: membership.companyId,
        teamRole: "owner",
        isTeamMember: false,
      };
    }
    const role = membership.role as ResolvedTeamContext["teamRole"];
    return {
      companyId: membership.companyId,
      teamRole: role === "admin" || role === "manager" || role === "viewer" ? role : "viewer",
      isTeamMember: true,
    };
  }

  return {
    companyId: userId,
    teamRole: "owner",
    isTeamMember: false,
  };
}

export function canManageTeam(teamRole: string | undefined): boolean {
  return teamRole === "owner" || teamRole === "admin";
}
