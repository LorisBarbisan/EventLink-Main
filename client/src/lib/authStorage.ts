const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "user";
const SIGNED_OUT_KEY = "auth_signed_out";

/** Paths where we must not auto-restore or dev auto-login (invite / login flows). */
export function isPublicAuthPath(): boolean {
  const path = window.location.pathname;
  return path.startsWith("/join-team") || path.startsWith("/auth");
}

export function markSignedOut(): void {
  sessionStorage.setItem(SIGNED_OUT_KEY, "1");
}

export function clearSignedOutMark(): void {
  sessionStorage.removeItem(SIGNED_OUT_KEY);
}

export function wasSignedOut(): boolean {
  return sessionStorage.getItem(SIGNED_OUT_KEY) === "1";
}

/** Remove all client-side auth state immediately (sync). */
export function clearClientAuthState(): void {
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.clear();
  markSignedOut();
}

export function getStoredAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function persistAuthSession(token: string, user: object): void {
  clearSignedOutMark();
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}
