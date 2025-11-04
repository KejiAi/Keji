import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import Logo from "@/components/branding/Logo";
import { getBackendUrl } from "@/lib/utils";
import { useSession } from "@/contexts/SessionContext";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const frontendUrl = import.meta.env.VITE_FRONTEND_BASE_URL;


const Start = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") === "login"); // false = signup, true = login
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const { login } = useSession();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    try {
      const endpoint = isLogin ? `${getBackendUrl()}/login` : `${getBackendUrl()}/sign-up`;
      const requestBody = isLogin 
        ? { email: data.email, password: data.password } 
        : data;
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        credentials: "include"
      });

      if (res.ok) {
        // For login, we need to get user data from the backend
        if (isLogin) {
          const sessionResponse = await fetch(`${getBackendUrl()}/check-session`, {
            credentials: "include"
          });
          if (sessionResponse.ok) {
            const userData = await sessionResponse.json();
            login(userData);
          }
          navigate("/homepage");
        } else {
          // For signup, redirect to email verification
          navigate(`/verify-email?email=${encodeURIComponent(data.email)}`);
        }
      } else {
        const error = await res.json();
        console.error("Authentication error:", error.error);
        navigate("/error", { state: { message: error.error } });
      }
    } catch (err) {
      console.error("Network error:", err);
      navigate("/error", { state: { message: "Something went wrong. Try again later." } });
    }
  };

  const handleForgotPassword = async () => {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const email = emailInput?.value || "";

    if (!email) {
      toast({
        title: "⚠️ Email Required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`${getBackendUrl()}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setForgotPasswordSuccess(true);

        toast({
          title: "📧 Reset link sent to your email!",
          description: "Check your inbox and click the link to reset your password.",
        });

        // Optionally clear the input after success
        emailInput.value = "";
      } else {
        const error = await res.json();
        toast({
          title: "❌ Reset Failed",
          description: error.error || "Could not send reset email. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      toast({
        title: "🚨 Server Error",
        description: "Something went wrong. Please try again later.",
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
            {!isLogin && (
              <div className="flex justify-center">
                <Button
                  variant="pill"
                  size="lg"
                  className="w-50 rounded-2xl py-4 text-md mt-6"
                  aria-label="Continue with Google"
                  asChild
                >
                  <a href={`${getBackendUrl()}/login/google`}>
                    <img
                      src="/assets/All Icon Used/devicon_google.png"
                      alt=""
                      className="h-5 w-5 mr-2"
                      aria-hidden
                    />
                    Continue with Google
                  </a>
                </Button>
              </div>
            )}

            <form className="space-y-2" onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="name" className="font-geist text-lg">
                    What name should I call you?
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="e.g Timee, or John"
                    className="h-16 rounded-2xl text-lg md:text-lg"
                    required={!isLogin}
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
                      className="text-sm text-brand hover:underline font-medium transition-colors"
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
                >
                  {isLogin ? "Log in" : "Sign up"}
                </Button>
              </div>
            </form>

            {forgotPasswordSuccess && isLogin && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Mail className="h-5 w-5" />
                  <h3 className="font-semibold">Check Your Email! 📧</h3>
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 space-y-2">
                  <p>We've sent a password reset link to your email. Click the link to create a new password.</p>
                  <p className="text-sm">The link will expire in 1 hour for security.</p>
                </div>
              </div>
            )}

            <p className="text-center font-funnelSans text-lg md:text-lg text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <span
                onClick={() => {
                  setIsLogin(!isLogin);
                  setForgotPasswordSuccess(false); // Reset success message when switching
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
