import { apiRequest } from "@/lib/queryClient";
import {
  clearClientAuthState,
  clearSignedOutMark,
  getStoredAuthToken,
  isPublicAuthPath,
  persistAuthSession,
  wasSignedOut,
} from "@/lib/authStorage";
import type { User } from "@shared/types";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    role: "freelancer" | "recruiter",
    extra?: { first_name?: string; last_name?: string; company_name?: string }
  ) => Promise<{ error: any; message?: string }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: { message: string } | null; user?: User; token?: string }>;
  signOut: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
}

const OptimizedAuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreStoredUser = () => {
      const APP_VERSION = "2025-09-24-jwt-fixed";
      const storedVersion = localStorage.getItem("app_version");
      if (storedVersion !== APP_VERSION) {
        localStorage.setItem("app_version", APP_VERSION);
      }

      const storedToken = getStoredAuthToken();

      if (storedToken) {
        apiRequest("/api/auth/session", { skipAuthRedirect: true })
          .then((sessionData) => {
            if (sessionData?.user) {
              clearSignedOutMark();
              setUser(sessionData.user);
              localStorage.setItem("user", JSON.stringify(sessionData.user));
            } else {
              throw new Error("Invalid session response");
            }
            setLoading(false);
          })
          .catch(() => {
            clearClientAuthState();
            setUser(null);
            setLoading(false);
          });
        return;
      }

      // Dev convenience login — never on invite/auth pages or after explicit sign-out
      if (
        import.meta.env.DEV &&
        !wasSignedOut() &&
        !isPublicAuthPath()
      ) {
        fetch("/api/auth/dev-admin-login")
          .then((r) => r.json())
          .then((data) => {
            if (data.token && data.user) {
              persistAuthSession(data.token, data.user);
              setUser(data.user);
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
        return;
      }

      setUser(null);
      setLoading(false);
    };

    restoreStoredUser();
  }, []);

  useEffect(() => {
    const handleAuthInvalid = () => {
      clearClientAuthState();
      setUser(null);
      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
    };

    window.addEventListener("auth:invalid", handleAuthInvalid);
    return () => window.removeEventListener("auth:invalid", handleAuthInvalid);
  }, []);

  const signUp = async (
    email: string,
    password: string,
    role: "freelancer" | "recruiter",
    extra?: { first_name?: string; last_name?: string; company_name?: string }
  ) => {
    try {
      const result = await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          first_name: extra?.first_name,
          last_name: extra?.last_name,
          company_name: extra?.company_name,
        }),
      });
      return { error: null, message: result.message };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Signup failed" } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await apiRequest("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuthRedirect: true,
      });

      if (!result?.user || !result?.token) {
        return {
          error: { message: "Sign in failed. Please try again or contact support." },
        };
      }

      persistAuthSession(result.token, result.user);
      setUser(result.user);

      return { error: null, user: result.user as User, token: result.token as string };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Sign in failed" } };
    }
  };

  const signOut = async () => {
    const token = getStoredAuthToken();

    // Clear client state first so navigation cannot race ahead of logout
    setUser(null);
    clearClientAuthState();

    if (!token) {
      return;
    }

    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.log("Server signout failed, local session already cleared", error);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  return (
    <OptimizedAuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        updateUser,
      }}
    >
      {children}
    </OptimizedAuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(OptimizedAuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
