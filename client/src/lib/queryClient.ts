import { QueryClient } from "@tanstack/react-query";

// Custom error class for authentication errors
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = "UNKNOWN"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        return apiRequest(url);
      },
      // 30s stale window — data fetched recently won't re-fire on every mount.
      // WebSocket invalidation keeps critical data fresh in real time.
      staleTime: 30 * 1000,
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: any) => {
        if (
          error?.message?.includes("401") ||
          error?.message?.includes("403") ||
          error?.message?.includes("404")
        ) {
          return false;
        }
        return failureCount < 2;
      },
      // WebSocket pushes real-time updates — no need to refetch on tab focus
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      networkMode: "online",
    },
  },
});

export async function apiRequest(
  url: string,
  options?: RequestInit & { skipAuthRedirect?: boolean }
) {
  // Get JWT token from localStorage
  const token = localStorage.getItem("auth_token");

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // Handle 401 Unauthorized errors with session validation
    if (response.status === 401) {
      if (options?.skipAuthRedirect) {
        // Just throw the error for calls that don't want auth handling
        const error = await response.json().catch(() => ({ error: "Unauthorized" }));
        throw new AuthError(error.error || "Unauthorized", 401, "UNAUTHORIZED");
      }

      // Verify if the session is actually invalid before logging out
      try {
        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const sessionResponse = await fetch("/api/auth/session", {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (sessionResponse.ok) {
          // Session is valid, this is just a permission/authorization issue
          const error = await response.json().catch(() => ({ error: "Access denied" }));
          throw new AuthError(error.error || "Access denied", 401, "UNAUTHORIZED_REQUEST");
        } else {
          // Session is invalid, dispatch auth:invalid event for cleanup
          window.dispatchEvent(new CustomEvent("auth:invalid"));
          throw new AuthError("Session expired", 401, "INVALID_SESSION");
        }
      } catch (sessionError: any) {
        // Check if it's a timeout/network error vs actual session invalid
        if (sessionError.name === "AbortError" || sessionError.message?.includes("timeout")) {
          console.warn("⚠️ Session validation timed out - treating as temporary network issue");
          // Don't log out user for network timeouts, just throw the original error
          const error = await response.json().catch(() => ({ error: "Request failed" }));
          throw new AuthError(error.error || "Request failed", response.status, "REQUEST_FAILED");
        } else {
          // If session check fails for other reasons, assume invalid session
          console.log("🔐 Session validation failed - logging out user");
          window.dispatchEvent(new CustomEvent("auth:invalid"));
          throw new AuthError("Session expired", 401, "INVALID_SESSION");
        }
      }
    }

    const error = await response.json().catch(() => ({ error: "Network error" }));
    const errorMessage = error.error || `HTTP ${response.status}`;
    const httpError = new Error(errorMessage);
    (httpError as any).status = response.status; // Attach status code for error handling
    throw httpError;
  }

  // Handle empty responses gracefully
  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return { success: true };
  }

  return response.json().catch(() => ({ success: true }));
}
