import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  const { handleUpdatePassword, isLoading, error: authError } = useAuth();

  // Check if user has a valid password reset session
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Supabase automatically handles the token from URL hash
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          setError("Invalid or expired reset link. Please request a new one.");
          setIsValidSession(false);
        } else if (session) {
          setIsValidSession(true);
        } else {
          setError("Invalid or expired reset link. Please request a new one.");
          setIsValidSession(false);
        }
      } catch (err) {
        console.error("Check session error:", err);
        setError("Something went wrong. Please try again.");
        setIsValidSession(false);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const result = await handleUpdatePassword(password);

    if (result.success) {
      setSuccess(true);
      toast({
        title: "Password Updated!",
        description: "Your password has been successfully reset.",
      });
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => navigate("/start?mode=login"), 2000);
    } else if (authError) {
      setError(authError.userMessage);
    }
  };

  if (isCheckingSession) {
    return (
      <PageContainer variant="static">
        <SEO title="Reset Password" description="Reset your Keji AI account password" />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-muted-foreground">Verifying reset link...</div>
        </div>
      </PageContainer>
    );
  }

  if (success) {
    return (
      <PageContainer variant="static">
        <SEO title="Password Reset Successful" description="Your password has been successfully reset" />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Password Reset Successful!</h1>
              <p className="text-muted-foreground">Redirecting to login...</p>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="static">
      <SEO title="Reset Password" description="Reset your Keji AI account password" />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
            <p className="text-muted-foreground">Enter your new password</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {!isValidSession ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                The reset link is invalid or has expired.
              </p>
              <Button
                onClick={() => navigate("/start?mode=login")}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  New Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isLoading}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!password || !confirmPassword}
                loading={isLoading}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => navigate("/start?mode=login")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default ResetPassword;
