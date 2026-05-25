/** Resolved employer company + team role for API auth and session payloads. */
export type ResolvedTeamContext = {
  companyId: number;
  teamRole: "owner" | "admin" | "manager";
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
      teamRole: role === "admin" || role === "manager" ? role : "manager",
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

/** Company id for employer API requests (owner id or invited company's owner id). */
export function getEmployerCompanyId(req: {
  companyId?: number;
  user?: { id: number };
}): number {
  return req.companyId ?? req.user?.id ?? 0;
}

/** Whether the request may act on data owned by the company (jobs, applications, crew, etc.). */
export function ownsEmployerCompany(
  req: { companyId?: number; user?: { id: number; role?: string } },
  companyOwnerId: number
): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.role === "admin") return true;
  return getEmployerCompanyId(req) === companyOwnerId;
}
