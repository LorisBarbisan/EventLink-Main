import { useQuery } from "@tanstack/react-query";

export function useHasJobs() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["jobs-count"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // re-check every 5 minutes
  });
  return (data?.count ?? 0) > 0;
}
