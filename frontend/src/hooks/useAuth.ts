/**
 * useAuth Hook
 * 
 * Custom hook for auth operations with loading and error states.
 * Wraps the auth service functions with React state management.
 */

import { useState, useCallback } from 'react';
import { 
  signUp, 
  signIn, 
  signInWithGoogle, 
  signOut, 
  resetPassword, 
  updatePassword,
  resendConfirmationEmail,
  updateUserName,
  updateChatStyle,
} from '@/lib/auth';
import type { 
  AppUser, 
  AuthError, 
  SignUpData, 
  LoginData 
} from '@/lib/auth.types';

interface UseAuthReturn {
  // State
  isLoading: boolean;
  error: AuthError | null;
  
  // Clear error
  clearError: () => void;
  
  // Auth operations
  handleSignUp: (data: SignUpData) => Promise<{ success: boolean; user?: AppUser | null }>;
  handleSignIn: (data: LoginData) => Promise<{ success: boolean; user?: AppUser | null }>;
  handleGoogleSignIn: () => Promise<{ success: boolean }>;
  handleSignOut: () => Promise<{ success: boolean }>;
  handleResetPassword: (email: string) => Promise<{ success: boolean }>;
  handleUpdatePassword: (newPassword: string) => Promise<{ success: boolean }>;
  handleResendConfirmation: (email: string) => Promise<{ success: boolean }>;
  handleUpdateName: (name: string) => Promise<{ success: boolean; user?: AppUser | null }>;
  handleUpdateChatStyle: (style: AppUser['chat_style']) => Promise<{ success: boolean; user?: AppUser | null }>;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Generic operation wrapper
  const executeOperation = useCallback(async <T>(
    operation: () => Promise<{ success: boolean; data: T | null; error: AuthError | null }>
  ): Promise<{ success: boolean; data?: T | null }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      
      if (!result.success && result.error) {
        setError(result.error);
      }
      
      return { success: result.success, data: result.data };
    } catch (err) {
      const authError: AuthError = {
        code: 'unknown',
        message: (err as Error).message || 'An unexpected error occurred',
        userMessage: 'Something went wrong. Please try again.',
      };
      setError(authError);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignUp = useCallback(async (data: SignUpData) => {
    const result = await executeOperation(() => signUp(data));
    return { 
      success: result.success, 
      user: result.data?.user,
      isExistingUser: result.data?.isExistingUser || false,
    };
  }, [executeOperation]);

  const handleSignIn = useCallback(async (data: LoginData) => {
    const result = await executeOperation(() => signIn(data));
    return { 
      success: result.success, 
      user: result.data?.user 
    };
  }, [executeOperation]);

  const handleGoogleSignIn = useCallback(async () => {
    const result = await executeOperation(() => signInWithGoogle());
    // For OAuth, success means we got the redirect URL
    // The actual sign-in happens after redirect
    return { success: result.success };
  }, [executeOperation]);

  const handleSignOut = useCallback(async () => {
    const result = await executeOperation(() => signOut());
    return { success: result.success };
  }, [executeOperation]);

  const handleResetPassword = useCallback(async (email: string) => {
    const result = await executeOperation(() => resetPassword(email));
    return { success: result.success };
  }, [executeOperation]);

  const handleUpdatePassword = useCallback(async (newPassword: string) => {
    const result = await executeOperation(() => updatePassword(newPassword));
    return { success: result.success };
  }, [executeOperation]);

  const handleResendConfirmation = useCallback(async (email: string) => {
    const result = await executeOperation(() => resendConfirmationEmail(email));
    return { success: result.success };
  }, [executeOperation]);

  const handleUpdateName = useCallback(async (name: string) => {
    const result = await executeOperation(() => updateUserName(name));
    return { 
      success: result.success, 
      user: result.data?.user 
    };
  }, [executeOperation]);

  const handleUpdateChatStyle = useCallback(async (style: AppUser['chat_style']) => {
    const result = await executeOperation(() => updateChatStyle(style));
    return { 
      success: result.success, 
      user: result.data?.user 
    };
  }, [executeOperation]);

  return {
    isLoading,
    error,
    clearError,
    handleSignUp,
    handleSignIn,
    handleGoogleSignIn,
    handleSignOut,
    handleResetPassword,
    handleUpdatePassword,
    handleResendConfirmation,
    handleUpdateName,
    handleUpdateChatStyle,
  };
}

export default useAuth;
