import { ReactNode } from "react";
import clsx from "clsx";

interface PageContainerProps {
  children: ReactNode;
  Logo?: ReactNode; // Optional Logo prop for customization
  variant?: "default" | "compact" | "static"; // layout spacing variant
}

const PageContainer = ({ children, Logo, variant = "default" }: PageContainerProps) => {
  return (
    <div 
      className={clsx(
        "min-h-screen bg-background text-foreground overscroll-contain overflow-x-hidden",
        variant === "static" ? "overflow-y-hidden h-screen" : "touch-pan-y"
      )}
    >
      {/* Header */}
      <header className="w-full">
        <div
          className={clsx(
            "container mx-auto text-center flex justify-center",
            variant === "default"
              ? "px-8 md:px-4 pt-16 md:pt-14 pb-6"
              : 
            "px-4 md:px-2 pt-8 md:pt-10 pb-4" // either compact or static
          )}
        >
          {Logo}
        </div>
      </header>

      {/* Main */}
      <main>
        <div
          className={clsx(
            "container mx-auto",
            variant === "default" ? "px-8 md:px-4" 
              : 
            "px-1 md:px-1" 
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageContainer;
