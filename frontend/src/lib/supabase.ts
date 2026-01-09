/**
 * Supabase Client Configuration
 * 
 * This creates a singleton Supabase client instance for the entire app.
 * All auth operations should use this client.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables (Vite requires VITE_ prefix)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create and export the Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage
    persistSession: true,
    // Auto-refresh token before expiry
    autoRefreshToken: true,
    // Detect session from URL (for OAuth callbacks)
    detectSessionInUrl: true,
    // Storage key for session
    storageKey: 'keji-auth-token',
  },
});

export default supabase;
