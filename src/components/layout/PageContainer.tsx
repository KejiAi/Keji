import { ReactNode } from "react";
import Logo from "@/components/branding/Logo";

interface PageContainerProps {
  children: ReactNode;
  Logo?: ReactNode; // Optional Logo prop for customization
}

const PageContainer = ({ children, Logo }: PageContainerProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground touch-pan-y overscroll-contain overflow-x-hidden">
      <header className="w-full">
        <div className="container mx-auto px-8 md:px-4 pt-16 md:pt-14 pb-6 text-center flex justify-center">
          {Logo && Logo}
        </div>
      </header>
      <main>
        <div className="container mx-auto px-8 md:px-4">{children}</div>
      </main>
    </div>
  );
};

export default PageContainer;
