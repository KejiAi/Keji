import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

const Logo = ({ className }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div
        aria-hidden
        className="grid place-items-center"
      >
        <img
          src="\assets\logo-k.png"
          alt="Keji Logo"
          className="h-36 w-36 object-contain"
        />
      </div>
    </div>
  );
};

export default Logo;
