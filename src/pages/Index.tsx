import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import HeroSection from "@/components/sections/HeroSection";
import MealOptions from "@/components/sections/MealOptions";
import Logo from "@/components/branding/Logo";

const Index = () => {
  return (
    <PageContainer Logo={<Logo />}>
      <SEO
        title="Keji AI — Your Correct Food Padi"
        description="Start for free. Keji helps you eat better whether you're broke or busy."
      />
      <HeroSection />
      <MealOptions />
      <footer className="pb-10 md:pb-16 text-center text-sm text-muted-foreground">
        By using Keji, you agree to our <a href="/terms" className="underline">Terms</a> and
        {' '}have read our <a href="/privacy" className="underline">Privacy Policy</a>
      </footer>
    </PageContainer>
  );
};

export default Index;
