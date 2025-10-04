import { ReactNode, useEffect, useState } from "react";

interface MobileOnlyWrapperProps {
  children: ReactNode;
}

const MOBILE_BREAKPOINT = 768;

const MobileOnlyWrapper = ({ children }: MobileOnlyWrapperProps) => {
  const [isMobile, setIsMobile] = useState<boolean>(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="font-funnelDisplay text-3xl font-bold text-foreground">
            Mobile Only Experience
          </h1>
          <p className="font-funnelSans text-lg text-muted-foreground">
            Keji is optimized for mobile devices. Please switch to your phone or resize your browser to mobile view for the best experience.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileOnlyWrapper;
