/**
 * Auth Types
 * 
 * Type definitions for authentication-related data.
 */

import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// App-specific user data (extends Supabase user)
export interface AppUser {
  id: string;
  email: string;
  name: string;
  fname: string; // First name
  initial: string; // First letter of name
  chat_style: 'pure_english' | 'more_english' | 'pure_pidgin' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa';
  avatar_url?: string;
  created_at?: string;
}

// Auth state
export interface AuthState {
  user: AppUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Sign up data
export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

// Login data
export interface LoginData {
  email: string;
  password: string;
}

// Auth error with user-friendly message
export interface AuthError {
  code: string;
  message: string;
  userMessage: string; // Friendly message to show user
}

// Auth result wrapper
export interface AuthResult<T = void> {
  data: T | null;
  error: AuthError | null;
  success: boolean;
}

// User metadata stored in Supabase
export interface UserMetadata {
  // Our custom fields (won't be overwritten by OAuth providers)
  display_name?: string;  // User's chosen name - use this instead of 'name'
  chat_style?: string;
  
  // Fields that OAuth providers may set/overwrite
  name?: string;          // Google overwrites this with their profile name
  full_name?: string;     // Google's full name
  avatar_url?: string;
  picture?: string;       // Google's avatar
}

// Re-export Supabase types for convenience
export type { SupabaseUser, Session };
