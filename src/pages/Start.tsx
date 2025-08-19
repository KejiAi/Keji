import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import Logo from "@/components/branding/Logo";


const Start = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") === "login"); // false = signup, true = login

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
      const endpoint = isLogin ? "http://localhost:5000/login" : "http://localhost:5000/sign-up";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLogin 
          ? { email: data.email, password: data.password } 
          : data),
        credentials: "include"
      });

      if (res.ok) {
        navigate("/homepage"); // success case
      } else {
        const error = await res.json(); // get error message from Flask
        console.error("Error:", error.error);
        navigate("/error", { state: { message: error.error } }); // redirect to error page with message
      }
    } catch (err) {
      console.error(err);
      navigate("/error", { state: { message: "Something went wrong. Try again later." } });
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
            <h1 className="font-funnelDisplay text-3xl md:text-5xl font-bold leading-tight tracking-tight">
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
                  <a href="http://localhost:5000/auth/google">
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
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="e.g john1234@Secure"
                  className="h-16 rounded-2xl text-lg md:text-lg"
                  required
                />
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

            <p className="text-center font-funnelSans text-lg md:text-lg text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <span
                onClick={() => setIsLogin(!isLogin)}
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
