import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import Logo from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InputVerification } from "@/components/ui/input-verification";
import { Mail, KeyRound, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBackendUrl } from "@/lib/utils";

const EmailVerification = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const email = searchParams.get("email");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);







  // Placeholder function for email link verification
  const handleEmailLinkVerification = () => {
    // This would typically be handled by a URL parameter or backend endpoint
    toast({
      title: "Email Verified!",
      description: "Your account has been successfully verified.",
    });
    
    setTimeout(() => {
      navigate("/start?mode=login");
    }, 1500);
  };







  

  // Placeholder function for manual code verification
  const handleCodeVerification = async (code: string) => {
    setIsVerifying(true);
    try {
      const res = await fetch(`${getBackendUrl()}/verify-email/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        toast({
          title: "Email Verified!",
          description: "Your account has been successfully verified.",
        });
        setIsDialogOpen(false);
        setTimeout(() => navigate("/start?mode=login"), 1500);
      } else {
        const err = await res.json();
        toast({
          title: "Invalid Code",
          description: err.error || "Please check your code and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };


  // Placeholder function for resending verification code
  const handleResendCode = async () => {
    if (!canResend) return;

    const res = await fetch(`${getBackendUrl()}/verify-email/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      toast({ title: "Code Resent", description: "A new verification code has been sent." });
      setCanResend(false);
      setResendCountdown(60);
    } else {
      toast({ title: "Error", description: "Could not resend code.", variant: "destructive" });
    }
  };


  return (
    <PageContainer Logo={<Logo />} variant="compact">
      <SEO
        title="Verify Your Email — Keji AI"
        description="Verify your email address to complete your account setup."
      />
      
      <section className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-funnelDisplay text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-2">
            Check Your Email
          </h1>
          <p className="font-geist text-lg text-muted-foreground">
            We've sent a verification link to <strong>{email}</strong>
          </p>
        </div>

        <div className="space-y-6">
          {/* Option A: Email Link Verification */}
          <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Option 1: Click the Email Link</CardTitle>
              <CardDescription>
                Check your inbox and click the verification link we sent you
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button
                variant="outline"
                onClick={handleEmailLinkVerification}
                className="w-full"
              >
                I clicked the link in my email
              </Button>
              <p className="text-sm text-muted-foreground mt-3">
                Didn't receive an email? Check your spam folder
              </p>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Option B: Manual Code Entry */}
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                <KeyRound className="w-6 h-6 text-secondary-foreground" />
              </div>
              <CardTitle className="text-xl">Option 2: Enter Verification Code</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your email manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="hero" className="w-full">
                    Enter Code Manually
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="text-center">
                    <DialogTitle className="text-2xl font-bold">Enter Verification Code</DialogTitle>
                    <DialogDescription>
                      Enter the 6-digit code sent to {email}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <InputVerification
                        length={6}
                        value={verificationCode}
                        onChange={setVerificationCode}
                        onComplete={handleCodeVerification}
                        disabled={isVerifying}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Button
                        onClick={() => handleCodeVerification(verificationCode)}
                        disabled={verificationCode.length < 6 || isVerifying}
                        className="w-full"
                      >
                        {isVerifying ? "Verifying..." : "Verify Code"}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={handleResendCode}
                        disabled={!canResend}
                        className="w-full"
                      >
                        {!canResend ? (
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Resend in {resendCountdown}s
                          </span>
                        ) : (
                          "Resend Code"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Back to Login */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => navigate("/start?mode=login")}
              className="text-muted-foreground hover:text-foreground"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </section>
    </PageContainer>
  );
};

export default EmailVerification;