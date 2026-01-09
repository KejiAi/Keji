import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "@/components/branding/Logo";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Start = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") === "login"); // false = signup, true = login
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  
  // New Supabase auth hooks
  const { login } = useAuthContext();
  const { 
    handleSignIn, 
    handleSignUp, 
    handleGoogleSignIn, 
    handleResetPassword,
    isLoading: isSubmitting,
    error: authError,
    clearError 
  } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = (formData.get("email") as string).toLowerCase().trim();
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    if (isLogin) {
      // Login with Supabase
      const result = await handleSignIn({ email, password });
      
      if (result.success && result.user) {
        navigate("/homepage");
      } else if (authError) {
        toast({
          title: "Login Failed",
          description: authError.userMessage,
          variant: "destructive",
        });
      }
    } else {
      // Sign up with Supabase
      const result = await handleSignUp({ email, password, name });
      
      if (result.success && !result.isExistingUser) {
        // Navigate to email verification page where user can enter code or wait for link
        navigate(`/email-verification?email=${encodeURIComponent(email)}`);
      } else if (result.isExistingUser) {
        // Email already exists and is verified
        toast({
          title: "Email Already Registered",
          description: "This email is already registered. Please log in instead.",
          variant: "destructive",
        });
      } else if (authError) {
        toast({
          title: "Sign Up Failed",
          description: authError.userMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    const result = await handleGoogleSignIn();
    
    if (!result.success && authError) {
      toast({
        title: "Google Sign In Failed",
        description: authError.userMessage,
        variant: "destructive",
      });
    }
    // Success: user will be redirected to Google, then to /auth/callback
  };

  const handleForgotPassword = async () => {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const email = emailInput?.value?.trim() || "";

    if (!email) {
      toast({
        title: "⚠️ Email Required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }
    
    clearError();
    const result = await handleResetPassword(email);

    if (result.success) {
      // Navigate to forgot password page where user can enter code or wait for link
      navigate(`/forgot-password?email=${encodeURIComponent(email)}`);
    } else if (authError) {
      toast({
        title: "❌ Reset Failed",
        description: authError.userMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <PageContainer Logo={<Logo />}>
      <SEO
        title={`${isLogin ? "Log in" : "Get Started"} — Keji AI`}
        description={isLogin ? "Log in to Keji" : "Create your Keji plan in seconds."}
      />
      <section>
        <div className="max-w-xl mx-auto">
          <header className="text-center">
            <h1 className="mb-6 font-funnelDisplay text-3xl md:text-5xl font-bold leading-tight tracking-tight">
              {isLogin ? "Welcome Back" : "Get Started with Keji"}
            </h1>
          </header>

          <div className="space-y-6 mx-2 md:mx-6">
            {/* Google Sign In - Show for both login and signup */}
            <div className="flex justify-center">
              <Button
                variant="pill"
                size="lg"
                className="w-50 rounded-2xl py-4 text-md mt-6"
                aria-label="Continue with Google"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
              >
                <img
                  src="/assets/All Icon Used/devicon_google.png"
                  alt=""
                  className="h-5 w-5 mr-2"
                  aria-hidden
                />
                Continue with Google
              </Button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted-foreground/20"></div>
              </div>
              <span className="relative bg-background px-4 text-sm text-muted-foreground">
                or continue with email
              </span>
            </div>

            <form className="space-y-2" onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="name" className="font-geist text-lg">
                    Preferred name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="What should Keji call you?"
                    className="h-16 rounded-2xl text-lg md:text-lg"
                    required={!isLogin}
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="font-geist text-lg">Your Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  placeholder="e.g John123@gmail.com"
                  className="h-16 rounded-2xl text-lg md:text-lg"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-geist text-lg">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="e.g john1234@Secure"
                    className="h-16 rounded-2xl text-lg md:text-lg pr-12"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {isLogin && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isSubmitting}
                      className="text-sm text-brand hover:underline font-medium transition-colors disabled:opacity-50"
                    >
                      Forgot Password? 🔒
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-center">
                <Button
                  variant="hero"
                  size="xl"
                  className="w-42 rounded-3xl mt-6"
                  aria-label={isLogin ? "Log in" : "Sign up"}
                  type="submit"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (isLogin ? "Logging in..." : "Signing up...") : (isLogin ? "Log in" : "Sign up")}
                </Button>
              </div>
            </form>

            <p className="text-center font-funnelSans text-lg md:text-lg text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <span
                onClick={() => {
                  setIsLogin(!isLogin);
                  clearError();
                }}
                className="cursor-pointer font-bold text-brand hover:underline"
              >
                {isLogin ? "Sign up" : "Log in"}
              </span>
            </p>
          </div>

          <footer className="pb-10 md:pb-10 text-center text-sm text-muted-foreground mt-20">
            By proceeding you acknowledge that you have read and agree to our{" "}
            <a href="/terms" className="underline">Terms</a> and{" "}
            <a href="/privacy" className="underline">Privacy Policy</a>
          </footer>
        </div>
      </section>
    </PageContainer>
  );
};

export default Start;
