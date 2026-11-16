import type { QueryClient } from "@tanstack/react-query";

const PREFIXES = ["/api/books", "/api/earnings", "/api/expenses", "/api/imports"];

/**
 * Refresh everything a removal or restore can change. Earnings queries use
 * keys like "/api/earnings/summary", so match on the prefix of the first key.
 */
export function invalidateBooks(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (q) => {
      const head = q.queryKey[0];
      return typeof head === "string" && PREFIXES.some((p) => head.startsWith(p));
    },
  });
}
