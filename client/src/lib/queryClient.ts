import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 408/429
        if (error?.message?.includes('401') || error?.message?.includes('403') || error?.message?.includes('404')) {
          return false;
        }
        return failureCount < 2; // Retry up to 2 times
      },
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: 'always',
      // Performance: Use network-only for critical data, cache-first for static
      networkMode: 'online',
    },
  },
});

export async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Critical: Include session cookies in all API requests
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Network error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle empty responses gracefully
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0' || !contentLength) {
    return { success: true }; // Return a default success response for empty bodies
  }

  return response.json();
}