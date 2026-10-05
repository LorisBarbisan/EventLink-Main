import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

// Canonical DB value is "United Kingdom"; accept common variants defensively.
const UK_COUNTRY_VALUES = new Set([
  "united kingdom",
  "uk",
  "gb",
  "gbr",
  "great britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
]);

export function isUkCountry(country: unknown): boolean {
  if (typeof country !== "string") return false;
  return UK_COUNTRY_VALUES.has(country.trim().toLowerCase());
}

/**
 * Visibility state for the insurance offers button:
 * - "available"    → UK freelancer with a profile; open the offers.
 * - "needs-profile" → freelancer signed up but hasn't created a profile;
 *                     show the button but prompt them to create one.
 * - "hidden"       → everyone else (non-freelancers, non-UK profiles).
 */
export type InsuranceAccess = "available" | "needs-profile" | "hidden";

export function useInsuranceAccess(): InsuranceAccess {
  const { user } = useAuth();
  const isFreelancer = user?.role === "freelancer";

  const {
    data: profile,
    error,
    isError,
  } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return apiRequest(`/api/freelancer/${user.id}`);
    },
    retry: false,
    enabled: isFreelancer && !!user?.id,
  });

  if (!isFreelancer) return "hidden";

  // The profile endpoint returns 404 when the freelancer hasn't created one.
  if (isError && (error as { status?: number })?.status === 404) {
    return "needs-profile";
  }

  if (profile && isUkCountry((profile as { country?: unknown }).country)) {
    return "available";
  }

  // Loading, transient errors, or a non-UK profile: keep the button hidden.
  return "hidden";
}
