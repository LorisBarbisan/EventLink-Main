import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isUkCountry, isCountryUnset } from "@shared/uk-country";

/**
 * Access state for the Books tab. Books is now open to every freelancer; only
 * the UK tax surfaces (HMRC estimate, VAT return, Making Tax Digital) are gated.
 * - "loading"       → profile not known yet: keep the tab (no flicker) but
 *                     don't mount Books until the answer is in.
 * - "available"     → show Books. `isUk` decides whether the tax surfaces show.
 * - "needs-country" → no profile yet, or no country on it: show the prompt
 *                     (so Books can tailor itself once the country is known).
 * - "unavailable"   → not a freelancer (employer or admin): hide the tab.
 */
export type BooksAccessState = "loading" | "available" | "needs-country" | "unavailable";

export interface BooksAccess {
  state: BooksAccessState;
  /** Whether to show UK-only tax surfaces (tax estimate, VAT return, MTD). */
  isUk: boolean;
}

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

  if (!isFreelancer) return { state: "unavailable", isUk: false };
  if (isLoading) return { state: "loading", isUk: false };

  if (isError) {
    // 404 means there is no profile yet; anything else is a failed request.
    // On a non-404 failure we fail open to the UK treatment (what shipped
    // before), so a blip never strips a UK user of their tax surfaces.
    return (error as { status?: number })?.status === 404
      ? { state: "needs-country", isUk: false }
      : { state: "available", isUk: true };
  }

  const country = (profile as { country?: unknown } | null)?.country;
  if (isCountryUnset(country)) return { state: "needs-country", isUk: false };
  return { state: "available", isUk: isUkCountry(country) };
}
