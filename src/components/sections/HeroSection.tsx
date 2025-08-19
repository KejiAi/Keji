import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="font-funnelDisplay text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
          <span className="text-primary">Hi, I'm Keji,</span>
          <br />
          <span>Your Correct Food Padi</span>
        </h1>
        <p className="mt-6 font-funnelSans text-xl md:text-2xl text-muted-foreground">
          Whether you are broke, or busy, I’ll help you eat better without headache
        </p>
        <div className="mt-12 md:mt-14 flex items-center justify-center">
          <Button asChild variant="hero" size="xl">
            <Link to="/start" aria-label="Start for free">Start for free</Link>
          </Button>
        </div>
        <p className="mt-6 font-funnelSans text-xl md:text-2xl text-muted-foreground">
          Already have an account?{" "}
          <Link 
            to="/start?mode=login" 
            className="font-semibold text-brand hover:underline font-bold"
          >
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
