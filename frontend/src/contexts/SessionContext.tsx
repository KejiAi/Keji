import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface User {
  id: number;
  name: string;
  fname: string;
  email: string;
  initial: string;
}

interface SessionContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const isAuthenticated = !!user;

  const checkSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${getBackendUrl()}/check-session`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        return true;
      } else {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        return false;
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      return false;
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isLoggedIn', 'true');
  };

  const logout = async (): Promise<void> => {
    // Clear local state immediately for better UX
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    
    try {
      await fetch(`${getBackendUrl()}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    
    // Navigate to home page
    navigate('/');
  };

  // Initialize session on app load
  useEffect(() => {
    const initializeSession = async () => {
      setIsLoading(true);
      
      // Always validate with backend first, don't trust localStorage
      // This ensures that manual URL navigation is properly validated
      const isValidSession = await checkSession();
      
      // Only if backend validation fails, clear localStorage
      if (!isValidSession) {
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        setUser(null); // Ensure user state is cleared
      }
      
      setIsLoading(false);
    };

    initializeSession();
  }, []);

  const value: SessionContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
