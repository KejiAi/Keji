/**
 * Auth Service
 * 
 * Centralized authentication functions using Supabase.
 * All auth operations should go through this service.
 */

import { supabase } from './supabase';
import type {
  AppUser,
  AuthError,
  AuthResult,
  LoginData,
  SignUpData,
  UserMetadata,
  Session,
  SupabaseUser,
} from './auth.types';
import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Maps Supabase auth errors to user-friendly messages
 */
function mapAuthError(error: SupabaseAuthError | Error | null): AuthError | null {
  if (!error) return null;

  const code = 'code' in error ? (error as SupabaseAuthError).code || 'unknown' : 'unknown';
  const message = error.message || 'An unknown error occurred';

  // Map common error codes to friendly messages
  const errorMap: Record<string, string> = {
    'invalid_credentials': 'Invalid email or password. Please try again.',
    'email_not_confirmed': 'Please verify your email before logging in.',
    'user_not_found': 'No account found with this email.',
    'email_exists': 'An account with this email already exists.',
    'weak_password': 'Password is too weak. Use at least 6 characters.',
    'invalid_email': 'Please enter a valid email address.',
    'over_request_rate_limit': 'Too many requests. Please wait a moment and try again.',
    'signup_disabled': 'Sign up is currently disabled.',
    'user_already_exists': 'An account with this email already exists.',
    'same_password': 'New password must be different from the current password.',
  };

  // Check for specific error messages
  let userMessage = errorMap[code] || message;

  // Handle some message-based errors
  if (message.includes('Invalid login credentials')) {
    userMessage = 'Invalid email or password. Please try again.';
  } else if (message.includes('Email not confirmed')) {
    userMessage = 'Please check your email and verify your account.';
  } else if (message.includes('User already registered')) {
    userMessage = 'An account with this email already exists.';
  }

  return {
    code,
    message,
    userMessage,
  };
}

/**
 * Wraps auth operations with consistent error handling
 */
async function withErrorHandling<T>(
  operation: () => Promise<{ data: T | null; error: SupabaseAuthError | null }>
): Promise<AuthResult<T>> {
  try {
    const { data, error } = await operation();
    
    if (error) {
      return {
        data: null,
        error: mapAuthError(error),
        success: false,
      };
    }

    return {
      data,
      error: null,
      success: true,
    };
  } catch (err) {
    return {
      data: null,
      error: mapAuthError(err as Error),
      success: false,
    };
  }
}

// =============================================================================
// User Helpers
// =============================================================================

/**
 * Converts Supabase user to AppUser format
 */
export function toAppUser(user: SupabaseUser | null): AppUser | null {
  if (!user) return null;

  const metadata = user.user_metadata as UserMetadata;
  // Prioritize our custom 'display_name' (Google can't overwrite this)
  // Fall back to Google's full_name, then name, then email prefix
  const name = metadata?.display_name || metadata?.full_name || metadata?.name || user.email?.split('@')[0] || 'User';
  const fname = name.split(' ')[0];
  const initial = fname.charAt(0).toUpperCase();

  return {
    id: user.id,
    email: user.email || '',
    name,
    fname,
    initial,
    chat_style: (metadata?.chat_style as AppUser['chat_style']) || 'more_english',
    avatar_url: metadata?.avatar_url || metadata?.picture, // Google uses 'picture' for avatar
    created_at: user.created_at,
  };
}

// =============================================================================
// Auth Operations
// =============================================================================

/**
 * Sign up a new user with email and password
 */
export async function signUp(data: SignUpData): Promise<AuthResult<{ user: AppUser | null; isExistingUser?: boolean }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.name,  // Use display_name so Google OAuth won't overwrite it
          name: data.name,          // Also set name for Supabase email templates ({{ .Data.name }})
          chat_style: 'more_english',
        },
        // Use current origin so email links work for both localhost and production
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // Check if user already exists (Supabase returns user with empty identities)
    if (response.data.user && response.data.user.identities?.length === 0) {
      return {
        data: { user: null, isExistingUser: true },
        error: new Error('User already registered') as SupabaseAuthError,
      };
    }

    return {
      data: response.data.user ? { user: toAppUser(response.data.user), isExistingUser: false } : null,
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null; isExistingUser?: boolean }>;
}

/**
 * Sign in with email and password
 */
export async function signIn(data: LoginData): Promise<AuthResult<{ user: AppUser | null; session: Session | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    return {
      data: {
        user: toAppUser(response.data.user),
        session: response.data.session,
      },
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null; session: Session | null }>;
}

/**
 * Sign in with Google OAuth
 * 
 * Uses Supabase's signInWithOAuth - this automatically:
 * 1. Redirects user to Google's consent screen
 * 2. Google redirects back to Supabase
 * 3. Supabase redirects to your app with the session
 */
export async function signInWithGoogle(): Promise<AuthResult<{ url: string | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Supabase will redirect here after Google auth completes
        // Use current origin so it works in both dev and production
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    return {
      data: { url: response.data.url },
      error: response.error,
    };
  });

  return result as AuthResult<{ url: string | null }>;
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  return withErrorHandling(async () => {
    const response = await supabase.auth.signOut();
    return { data: null, error: response.error };
  });
}

/**
 * Get current session
 */
export async function getSession(): Promise<AuthResult<{ session: Session | null; user: AppUser | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.getSession();
    return {
      data: {
        session: response.data.session,
        user: toAppUser(response.data.session?.user || null),
      },
      error: response.error,
    };
  });

  return result as AuthResult<{ session: Session | null; user: AppUser | null }>;
}

/**
 * Get current user
 */
export async function getUser(): Promise<AuthResult<{ user: AppUser | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.getUser();
    return {
      data: { user: toAppUser(response.data.user) },
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null }>;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  return withErrorHandling(async () => {
    const response = await supabase.auth.resetPasswordForEmail(email, {
      // Redirect to reset-password page for setting new password
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { data: null, error: response.error };
  });
}

/**
 * Update password (for reset flow)
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  return withErrorHandling(async () => {
    const response = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data: null, error: response.error };
  });
}

/**
 * Resend confirmation email
 */
export async function resendConfirmationEmail(email: string): Promise<AuthResult> {
  return withErrorHandling(async () => {
    const response = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data: null, error: response.error };
  });
}

/**
 * Verify email with OTP code (for signup verification)
 * Uses type: 'signup' which expects a 6-digit code
 */
export async function verifyEmailWithCode(email: string, code: string): Promise<AuthResult<{ user: AppUser | null; session: Session | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup', // 'signup' type for email verification (6-digit code)
    });

    return {
      data: {
        user: toAppUser(response.data.user),
        session: response.data.session,
      },
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null; session: Session | null }>;
}

/**
 * Verify password reset with OTP code
 * Uses type: 'recovery' for password reset verification (6-digit code)
 */
export async function verifyPasswordResetCode(email: string, code: string): Promise<AuthResult<{ user: AppUser | null; session: Session | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery', // 'recovery' type for password reset (6-digit code)
    });

    return {
      data: {
        user: toAppUser(response.data.user),
        session: response.data.session,
      },
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null; session: Session | null }>;
}

// =============================================================================
// User Profile Operations
// =============================================================================

/**
 * Update user's display name
 */
export async function updateUserName(name: string): Promise<AuthResult<{ user: AppUser | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.updateUser({
      data: { display_name: name },  // Use display_name so Google OAuth won't overwrite it
    });

    return {
      data: { user: toAppUser(response.data.user) },
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null }>;
}

/**
 * Update user's chat style preference
 */
export async function updateChatStyle(chatStyle: AppUser['chat_style']): Promise<AuthResult<{ user: AppUser | null }>> {
  const result = await withErrorHandling(async () => {
    const response = await supabase.auth.updateUser({
      data: { chat_style: chatStyle },
    });

    return {
      data: { user: toAppUser(response.data.user) },
      error: response.error,
    };
  });

  return result as AuthResult<{ user: AppUser | null }>;
}

// =============================================================================
// Auth State Listener
// =============================================================================

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null, user: AppUser | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    const user = toAppUser(session?.user || null);
    callback(event, session, user);
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if user's email is verified
 */
export function isEmailVerified(user: SupabaseUser | null): boolean {
  return user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined;
}

/**
 * Get time-based greeting
 */
export function getGreeting(): { type: 'morning' | 'afternoon' | 'evening' | 'night'; message?: string } {
  const hour = new Date().getHours();
  
  const nightLines = [
    "Night crawler 😎, still up, ehn?",
    "Night crawler mode ON.🦉",
    "Who is awake by this time? Night crawler 😁",
    "Night crawler vibes 😆, Oya now",
    "🛌 Go sleep jare, night crawler 😂",
    "Kerosene 😂, you no see sleep",
    "Young John 😜"
  ];

  if (hour >= 5 && hour < 12) {
    return { type: 'morning' };
  } else if (hour >= 12 && hour < 16) {
    return { type: 'afternoon' };
  } else if (hour >= 16 && hour < 22) {
    return { type: 'evening' };
  } else {
    return { 
      type: 'night', 
      message: nightLines[Math.floor(Math.random() * nightLines.length)] 
    };
  }
}

// Export everything as a service object for convenience
export const authService = {
  signUp,
  signIn,
  signInWithGoogle,
  signOut,
  getSession,
  getUser,
  resetPassword,
  updatePassword,
  resendConfirmationEmail,
  verifyEmailWithCode,
  verifyPasswordResetCode,
  updateUserName,
  updateChatStyle,
  onAuthStateChange,
  isEmailVerified,
  getGreeting,
  toAppUser,
};

export default authService;
