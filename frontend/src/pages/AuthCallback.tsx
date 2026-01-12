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
          const user = session.user;
          const userMetadata = user.user_metadata || {};
          
          // Check if we need to set defaults for OAuth users (Google sign-in)
          // Use display_name (Google can't overwrite this field)
          const needsChatStyle = !userMetadata.chat_style;
          const needsDisplayName = !userMetadata.display_name;
          
          if (needsChatStyle || needsDisplayName) {
            const updateData: Record<string, string> = {};
            
            // Set default chat_style if missing
            if (needsChatStyle) {
              updateData.chat_style = 'more_english';
            }
            
            // Set display_name from Google's name only if user doesn't have one
            // (Manual signup users will already have display_name set)
            if (needsDisplayName && (userMetadata.full_name || userMetadata.name)) {
              updateData.display_name = userMetadata.full_name || userMetadata.name;
            }
            
            if (Object.keys(updateData).length > 0) {
              await supabase.auth.updateUser({ data: updateData });
              
              // Refresh session to get updated metadata
              const { data: { session: updatedSession } } = await supabase.auth.getSession();
              if (updatedSession) {
                const appUser = toAppUser(updatedSession.user);
                if (appUser) {
                  login(appUser, updatedSession);
                }
                navigate('/homepage', { replace: true });
                return;
              }
            }
          }
          
          // Convert to app user and update context
          const appUser = toAppUser(user);
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
