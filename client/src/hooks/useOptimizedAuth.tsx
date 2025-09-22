import { useState, useEffect, createContext, useContext } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { User } from '@shared/types';

// OPTIMIZED AUTH HOOK: Simplified authentication with essential features only

interface OptimizedAuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'freelancer' | 'recruiter') => Promise<{ error: any; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const OptimizedAuthContext = createContext<OptimizedAuthContextType | undefined>(undefined);

export const OptimizedAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateStoredUser = async () => {
      // Version-based cache clearing
      const APP_VERSION = "2025-09-13-admin-cache-fix"; 
      const storedVersion = localStorage.getItem('app_version');
      
      if (storedVersion !== APP_VERSION) {
        console.log('App version updated, clearing cache');
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('app_version', APP_VERSION);
      }
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Validate user session on server
          try {
            const response = await apiRequest(`/api/auth/session`);
            if (response && response.user && response.user.id && response.user.email) {
              // Update cached user with server's current session data (fixes admin role not showing)
              setUser(response.user);
              localStorage.setItem('user', JSON.stringify(response.user));
            } else {
              localStorage.removeItem('user');
              setUser(null);
            }
          } catch (error) {
            console.log('Session validation failed, clearing cache');
            localStorage.removeItem('user');
            setUser(null);
          }
        } catch (error) {
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        // No cached user - user is not authenticated
        console.log('No cached user found - user not authenticated');
      }
      setLoading(false);
    };
    
    validateStoredUser();
  }, []);

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
      
      // After successful login, get fresh session data
      const sessionResponse = await apiRequest('/api/auth/session');
      if (sessionResponse && sessionResponse.user) {
        setUser(sessionResponse.user);
        localStorage.setItem('user', JSON.stringify(sessionResponse.user));
      } else {
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
    sessionStorage.clear();
  };

  return (
    <OptimizedAuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut
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