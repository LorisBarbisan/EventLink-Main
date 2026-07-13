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
 * True only for a signed-in freelancer who has created a profile whose
 * country is in the UK. Shares the dashboard's profile query cache
 * (same queryKey) so it adds no extra request on pages that already load it.
 */
export function useIsUkFreelancer(): boolean {
  const { user } = useAuth();
  const isFreelancer = user?.role === "freelancer";

  const { data: profile } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return apiRequest(`/api/freelancer/${user.id}`);
    },
    retry: false,
    enabled: isFreelancer && !!user?.id,
  });

  return isFreelancer && !!profile && isUkCountry((profile as { country?: unknown }).country);
}
