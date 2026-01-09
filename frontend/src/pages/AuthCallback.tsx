/**
 * Auth Callback Page
 * 
 * Handles OAuth redirects (Google sign-in) and email confirmation links.
 * This page is shown briefly while processing the auth callback.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { toAppUser } from '@/lib/auth';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL params (from Supabase)
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (errorParam) {
          setError(errorDescription || 'Authentication failed');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Get the session from URL hash (Supabase puts tokens there)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (session) {
          // Convert to app user and update context
          const appUser = toAppUser(session.user);
          if (appUser) {
            login(appUser, session);
          }
          
          // Redirect to homepage
          navigate('/homepage', { replace: true });
        } else {
          // No session found, redirect to login
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError('An unexpected error occurred');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate, searchParams, login]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-lg">{error}</div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <LoadingSpinner />
      <p className="mt-4 text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
