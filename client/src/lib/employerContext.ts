/** User fields needed to resolve employer company context (owner vs team member). */
export type EmployerContextUser = {
  id: number;
  companyId?: number;
  teamRole?: string | null;
  isTeamMember?: boolean;
};

/** Company owner's user id — profile and jobs are keyed by this id. */
export function getEffectiveCompanyId(user: EmployerContextUser): number {
  return user.companyId ?? user.id;
}

/** True when the logged-in account is the company owner (not a team member). */
export function isCompanyOwner(user: EmployerContextUser): boolean {
  return getEffectiveCompanyId(user) === user.id;
}

/** Manager team members get a limited dashboard (no company profile or team management). */
export function isManagerTeamMember(user: EmployerContextUser): boolean {
  return !!user.isTeamMember && user.teamRole === "manager";
}
