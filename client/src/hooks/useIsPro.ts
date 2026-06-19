import { useAuth } from "@/hooks/useAuth";

export function useIsPro(): boolean {
  const { user } = useAuth();
  return user?.subscription_tier === "pro";
}
