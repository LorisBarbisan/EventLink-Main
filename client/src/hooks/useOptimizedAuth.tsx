import React, { useState, useEffect, createContext, useContext } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/types';

// OPTIMIZED AUTH HOOK: Simplified authentication with essential features only

interface OptimizedAuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'freelancer' | 'recruiter') => Promise<{ error: any; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
}

const OptimizedAuthContext = createContext<OptimizedAuthContextType | undefined>(undefined);

export const OptimizedAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreStoredUser = () => {
      // Check if we already have a valid user to prevent infinite loops
      if (user) {
        setLoading(false);
        return;
      }

      // Version-based cache clearing - COMPLETELY DISABLED for session persistence
      const APP_VERSION = "2025-09-24-jwt-fixed"; 
      const storedVersion = localStorage.getItem('app_version');
      
      // Only update version, never clear cache to preserve sessions
      if (storedVersion !== APP_VERSION) {
        console.log('App version updated, preserving authentication state');
        localStorage.setItem('app_version', APP_VERSION);
      }
      
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('auth_token');
      
      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser);
          
          // CRITICAL FIX: Validate token with server before trusting it
          apiRequest('/api/auth/session', { skipAuthRedirect: true })
            .then((sessionData) => {
              if (sessionData && sessionData.user) {
                // Token is valid, use fresh data from server
                setUser(sessionData.user);
                localStorage.setItem('user', JSON.stringify(sessionData.user));
                console.log('✅ Token validated, user restored:', sessionData.user.email);
              } else {
                throw new Error('Invalid session response');
              }
              setLoading(false);
            })
            .catch((error) => {
              console.log('❌ Token validation failed, clearing auth state:', error.message);
              localStorage.removeItem('user');
              localStorage.removeItem('auth_token');
              setUser(null);
              setLoading(false);
            });
          
          return; // Exit early, let validation complete async
        } catch (error) {
          console.log('❌ Failed to parse stored user, clearing cache');
          localStorage.removeItem('user');
          localStorage.removeItem('auth_token');
          setUser(null);
        }
      } else {
        // No cached user or token - ensure clean state
        setUser(null);
      }
      setLoading(false);
    };
    
    restoreStoredUser();
  }, []); // Remove user dependency to prevent infinite loops

  const signUp = async (email: string, password: string, role: 'freelancer' | 'recruiter') => {
    try {
      const result = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, role }),
      });
      return { error: null, message: result.message };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'Signup failed' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await apiRequest('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      // Store JWT token and user data from signin response
      if (result && result.user && result.token) {
        localStorage.setItem('auth_token', result.token);
        setUser(result.user);
        localStorage.setItem('user', JSON.stringify(result.user));
      }
      
      return { error: null };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'Sign in failed' } };
    }
  };

  const signOut = async () => {
    try {
      // Call server signout to clear session
      await apiRequest('/api/auth/signout', { method: 'POST' });
    } catch (error) {
      console.log('Server signout failed, clearing local state anyway');
    }
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token'); // Clear JWT token
    sessionStorage.clear();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <OptimizedAuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut,
      updateUser
    }}>
      {children}
    </OptimizedAuthContext.Provider>
  );
};

export const useOptimizedAuth = () => {
  const context = useContext(OptimizedAuthContext);
  if (context === undefined) {
    throw new Error('useOptimizedAuth must be used within an OptimizedAuthProvider');
  }
  return context;
};