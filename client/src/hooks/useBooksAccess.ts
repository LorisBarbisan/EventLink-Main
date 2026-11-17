import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isUkCountry, isCountryUnset } from "@shared/uk-country";

/**
 * Access state for the Books tab (UK-specific tax surfaces):
 * - "loading"       → profile not known yet: keep the tab (no flicker) but
 *                     don't mount Books until the answer is in.
 * - "available"     → UK freelancer, or the profile could not be loaded
 *                     (offline, server error): let the server decide.
 * - "needs-country" → no profile yet, or no country on it: show the prompt.
 * - "unavailable"   → non-UK freelancer, employer or admin: hide the tab.
 */
export type BooksAccess = "loading" | "available" | "needs-country" | "unavailable";

export function useBooksAccess(): BooksAccess {
  const { user } = useAuth();
  const isFreelancer = user?.role === "freelancer";

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return apiRequest(`/api/freelancer/${user.id}`);
    },
    retry: false,
    enabled: isFreelancer && !!user?.id,
  });

  if (!isFreelancer) return "unavailable";
  if (isLoading) return "loading";

  if (isError) {
    // 404 means there is no profile yet; anything else is a failed request,
    // which must not tell someone with a country set to go and set one.
    return (error as { status?: number })?.status === 404 ? "needs-country" : "available";
  }

  const country = (profile as { country?: unknown } | null)?.country;
  if (isCountryUnset(country)) return "needs-country";
  return isUkCountry(country) ? "available" : "unavailable";
}
