/**
 * Auth Context Provider
 * 
 * Provides authentication state and user data throughout the app.
 * Replaces the old SessionContext with Supabase-based auth.
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  ReactNode 
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  getSession, 
  signOut, 
  toAppUser, 
  updateUserName as updateName,
  updateChatStyle as updateStyle,
  getGreeting,
} from '@/lib/auth';
import type { AppUser, Session } from '@/lib/auth.types';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// =============================================================================
// Types
// =============================================================================

interface AuthContextType {
  // User state
  user: AppUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Greeting info
  greeting: {
    type: 'morning' | 'afternoon' | 'evening' | 'night';
    message?: string;
  };
  
  // Actions
  login: (user: AppUser, session: Session) => void;
  logout: () => Promise<void>;
  updateUserName: (name: string) => Promise<boolean>;
  updateChatStyle: (style: AppUser['chat_style']) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

// Alias for backwards compatibility with old SessionContext
export const useSession = useAuthContext;

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting] = useState(() => getGreeting());
  const navigate = useNavigate();

  const isAuthenticated = !!user && !!session;

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const result = await getSession();
        
        if (mounted && result.success && result.data) {
          setUser(result.data.user);
          setSession(result.data.session);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);
        
        if (mounted) {
          if (newSession) {
            const appUser = toAppUser(newSession.user);
            setUser(appUser);
            setSession(newSession);
          } else {
            setUser(null);
            setSession(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Login handler (called after successful sign in)
  const login = useCallback((userData: AppUser, sessionData: Session) => {
    setUser(userData);
    setSession(sessionData);
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSession(null);
      navigate('/');
    }
  }, [navigate]);

  // Update user name
  const updateUserName = useCallback(async (name: string): Promise<boolean> => {
    const result = await updateName(name);
    
    if (result.success && result.data?.user) {
      setUser(result.data.user);
      return true;
    }
    
    return false;
  }, []);

  // Update chat style
  const updateChatStyle = useCallback(async (style: AppUser['chat_style']): Promise<boolean> => {
    const result = await updateStyle(style);
    
    if (result.success && result.data?.user) {
      setUser(result.data.user);
      return true;
    }
    
    return false;
  }, []);

  // Refresh user data from Supabase
  const refreshUser = useCallback(async () => {
    const result = await getSession();
    
    if (result.success && result.data) {
      setUser(result.data.user);
      setSession(result.data.session);
    }
  }, []);

  // Context value
  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    greeting,
    login,
    logout,
    updateUserName,
    updateChatStyle,
    refreshUser,
  };

  // Show loading spinner while initializing
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Backwards Compatibility (for gradual migration)
// =============================================================================

// This allows existing code using SessionProvider to work
export const SessionProvider = AuthProvider;

export default AuthProvider;
