import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: 'always',
    },
  },
});

export async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
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