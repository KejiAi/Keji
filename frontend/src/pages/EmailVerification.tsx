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
  const [isResending, setIsResending] = useState(false);
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
    if (!canResend || isResending) return;

    setIsResending(true);
    try {
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
    } finally {
      setIsResending(false);
    }
  };


  return (
    <PageContainer Logo={<Logo />} variant="compact">
      <SEO
        title="Verify Your Email - Keji AI"
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
          <p className="font-geist text-lg text-muted-foreground px-2">
            We’ve sent a verification link and code to <strong>{email}</strong>.
            You can either click the link in the email or enter the code manually to verify your account.
          </p>
        </div>

        <div className="space-y-6">
          {/* Manual Code Entry */}
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                <KeyRound className="w-6 h-6 text-secondary-foreground" />
              </div>
              <CardTitle className="text-xl">Enter Verification Code</CardTitle>
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
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto px-4 sm:px-6">
                  <DialogHeader className="text-center mt-6 sm:mt-8">
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-center">Enter Verification Code</DialogTitle>
                    <DialogDescription className="text-sm sm:text-base text-center">
                      Enter the 6-digit code sent to {email}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex justify-center w-full overflow-hidden py-4 sm:py-6">
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
                        disabled={verificationCode.length < 6}
                        loading={isVerifying}
                        className="w-full"                       
                      >
                        {isVerifying ? "Verifying..." : "Verify Code"}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={handleResendCode}
                        disabled={!canResend || isResending}
                        loading={isResending}
                        className="w-full"
                      >
                        {isResending ? (
                          "Sending..."
                        ) : !canResend ? (
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