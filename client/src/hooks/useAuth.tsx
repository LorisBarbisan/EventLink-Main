import { useState, useEffect, createContext, useContext } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { User } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'freelancer' | 'recruiter') => Promise<{ error: any; message?: string; emailSent?: boolean; devVerificationUrl?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: any; user?: any }>;
  signOut: () => Promise<{ error: any }>;
  resendVerificationEmail: (email: string) => Promise<{ error: any; message?: string }>;
  refreshUser: () => Promise<void>;
  clearAllCache: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AGGRESSIVE CACHE CLEARING: First, immediately clear any existing auth state
    const clearAuthState = () => {
      setUser(null);
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
    };

    // Check for stored user session and validate it against the server
    const validateStoredUser = async () => {
      // Check if this is a fresh deployment by looking for a version mismatch
      const APP_VERSION = "2025-08-28-auth-fix-v2"; // Change this when we need to force clear cache
      const storedVersion = localStorage.getItem('app_version');
      
      if (storedVersion !== APP_VERSION) {
        console.log('App version mismatch detected');
        // Only clear if there's no fresh user data (to avoid clearing fresh logins)
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.log('No user data found, clearing all cache');
          localStorage.clear();
          sessionStorage.clear();
        }
        localStorage.setItem('app_version', APP_VERSION);
      }
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('Attempting to validate cached user:', parsedUser.id);
          
          // For fresh logins, trust the stored user data without validation
          // Only validate if the data is old (more than 5 minutes)
          const now = Date.now();
          const userTimestamp = parsedUser.timestamp || 0;
          const isRecentLogin = (now - userTimestamp) < 5 * 60 * 1000; // 5 minutes
          
          if (isRecentLogin) {
            console.log('Recent login detected, trusting stored user data');
            setUser(parsedUser);
          } else {
            // For older sessions, validate with server and UPDATE user data
            try {
              const response = await apiRequest(`/api/users/${parsedUser.id}`);
              if (response && response.id && response.email && response.id == parsedUser.id) {
                console.log('User validation successful, updating with fresh data from server');
                console.log('Server user role:', response.role, 'Cached user role:', parsedUser.role);
                const freshUserWithTimestamp = {
                  ...response,
                  timestamp: Date.now()
                };
                setUser(freshUserWithTimestamp);
                localStorage.setItem('user', JSON.stringify(freshUserWithTimestamp));
              } else {
                console.log('Invalid user validation response, clearing cache');
                clearAuthState();
              }
            } catch (error) {
              // For validation errors, be more tolerant - keep user for short term
              console.log('User validation failed, but keeping user for this session:', error);
              setUser(parsedUser);
            }
          }
        } catch (error) {
          console.log('Error parsing cached user, clearing cache:', error);
          clearAuthState();
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
      // New signup flow returns message instead of user
      return { error: null, message: result.message, emailSent: result.emailSent, devVerificationUrl: result.devVerificationUrl };
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
      
      // Add timestamp for fresh login detection
      const userWithTimestamp = {
        ...result.user,
        timestamp: Date.now()
      };
      
      setUser(userWithTimestamp);
      localStorage.setItem('user', JSON.stringify(userWithTimestamp));
      return { error: null, user: userWithTimestamp };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'Sign in failed' } };
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('user');
    return { error: null };
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const result = await apiRequest('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { error: null, message: result.message };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'Failed to resend verification email' } };
    }
  };

  const refreshUser = async () => {
    if (!user?.id) return;
    
    try {
      console.log('Refreshing user data from server...');
      const response = await apiRequest(`/api/users/${user.id}`);
      if (response && response.id && response.email) {
        const userWithTimestamp = {
          ...response,
          timestamp: Date.now()
        };
        setUser(userWithTimestamp);
        localStorage.setItem('user', JSON.stringify(userWithTimestamp));
        console.log('User data refreshed successfully');
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const clearAllCache = () => {
    // Clear all localStorage data for this application
    localStorage.clear();
    // Clear any sessionStorage as well
    sessionStorage.clear();
    // Reset user state
    setUser(null);
    // Force reload to ensure clean state
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut,
      resendVerificationEmail,
      refreshUser,
      clearAllCache
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};