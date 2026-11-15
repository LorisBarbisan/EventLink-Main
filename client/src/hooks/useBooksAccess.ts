import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isUkCountry } from "@/hooks/useIsUkFreelancer";

/**
 * Access state for the Books tab (UK-specific tax surfaces):
 * - "available"     → UK freelancer; show Books tab normally.
 * - "needs-country" → freelancer hasn't set their country yet; show a prompt.
 * - "unavailable"   → non-UK freelancer; hide the Books tab.
 */
export type BooksAccess = "available" | "needs-country" | "unavailable";

export function useBooksAccess(): BooksAccess {
  const { user } = useAuth();
  const isFreelancer = user?.role === "freelancer";

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return apiRequest(`/api/freelancer/${user.id}`);
    },
    retry: false,
    enabled: isFreelancer && !!user?.id,
  });

  if (!isFreelancer) return "unavailable";
  if (isLoading) return "available"; // optimistic while loading — avoids flicker

  const country = (profile as { country?: unknown } | null)?.country;

  if (country === null || country === undefined) return "needs-country";
  if (isUkCountry(country)) return "available";
  return "unavailable";
}
