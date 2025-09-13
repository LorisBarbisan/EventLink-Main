import { useState, useEffect, createContext, useContext } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { User } from '@shared/types';

// OPTIMIZED AUTH HOOK: Simplified authentication with essential features only

interface OptimizedAuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'freelancer' | 'recruiter') => Promise<{ error: any; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => void;
}

const OptimizedAuthContext = createContext<OptimizedAuthContextType | undefined>(undefined);

export const OptimizedAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateStoredUser = async () => {
      // Version-based cache clearing
      const APP_VERSION = "2025-08-27-nuclear-reset-v2"; 
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
          // Validate user still exists on server
          try {
            const response = await apiRequest(`/api/users/${parsedUser.id}`);
            if (response && response.id && response.email) {
              setUser(parsedUser);
            } else {
              localStorage.removeItem('user');
              setUser(null);
            }
          } catch (error) {
            console.log('User validation failed, clearing cache');
            localStorage.removeItem('user');
            setUser(null);
          }
        } catch (error) {
          localStorage.removeItem('user');
          setUser(null);
        }
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
      setUser(result.user);
      localStorage.setItem('user', JSON.stringify(result.user));
      return { error: null };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'Sign in failed' } };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('user');
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