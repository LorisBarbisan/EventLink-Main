import { QueryClient } from "@tanstack/react-query";

// Custom error class for authentication errors
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = 'UNKNOWN'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

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

export async function apiRequest(url: string, options?: RequestInit & { skipAuthRedirect?: boolean }) {
  // Get JWT token from localStorage
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Keep for backward compatibility
    headers: {
      "Content-Type": "application/json",
      ...(token && { 'Authorization': `Bearer ${token}` }), // Add JWT token to headers
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // Handle 401 Unauthorized errors with session validation
    if (response.status === 401) {
      if (options?.skipAuthRedirect) {
        // Just throw the error for calls that don't want auth handling
        const error = await response.json().catch(() => ({ error: "Unauthorized" }));
        throw new AuthError(error.error || 'Unauthorized', 401, 'UNAUTHORIZED');
      }
      
      // Verify if the session is actually invalid before logging out
      try {
        const sessionResponse = await fetch('/api/auth/session', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (sessionResponse.ok) {
          // Session is valid, this is just a permission/authorization issue
          const error = await response.json().catch(() => ({ error: "Access denied" }));
          throw new AuthError(error.error || 'Access denied', 401, 'UNAUTHORIZED_REQUEST');
        } else {
          // Session is invalid, dispatch auth:invalid event for cleanup
          window.dispatchEvent(new CustomEvent('auth:invalid'));
          throw new AuthError('Session expired', 401, 'INVALID_SESSION');
        }
      } catch (sessionError) {
        // If session check fails, assume invalid session
        window.dispatchEvent(new CustomEvent('auth:invalid'));
        throw new AuthError('Session expired', 401, 'INVALID_SESSION');
      }
    }
    
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