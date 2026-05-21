/** User fields needed to resolve employer company context (owner vs team member). */
export type EmployerContextUser = {
  id: number;
  companyId?: number;
};

/** Company owner's user id — profile and jobs are keyed by this id. */
export function getEffectiveCompanyId(user: EmployerContextUser): number {
  return user.companyId ?? user.id;
}

/** True when the logged-in account is the company owner (not a team member). */
export function isCompanyOwner(user: EmployerContextUser): boolean {
  return getEffectiveCompanyId(user) === user.id;
}
