import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import HeroSection from "@/components/sections/HeroSection";
import MealOptions from "@/components/sections/MealOptions";
import Logo from "@/components/branding/Logo";
import { useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/contexts/SessionContext";

const Index = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useSession();
  const [showRedirectMessage, setShowRedirectMessage] = useState(false);

  useEffect(() => {
    // Only show redirect message if user is not authenticated AND was redirected from protected route
    const wasRedirected = location.state?.fromProtectedRoute;
    if (wasRedirected && !isAuthenticated && !isLoading) {
      setShowRedirectMessage(true);
      // Auto-hide after 6 seconds
      const timer = setTimeout(() => setShowRedirectMessage(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.state, isAuthenticated, isLoading]);

  // Show loading while checking session
  if (isLoading) {
    return (
      <PageContainer Logo={<Logo />}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </PageContainer>
    );
  }

  // Redirect logged-in users to homepage
  if (isAuthenticated) {
    return <Navigate to="/homepage" replace />;
  }

  return (
    <PageContainer Logo={<Logo />}>
      <SEO
        title="Keji AI — Your Correct Food Padi"
        description="Start for free. Keji helps you eat better whether you're broke or busy."
      />
      {/* Floating Decorative Images */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 1. left Top */}
        <img
          src="assets/All Icon Used/emojione-monotone_hot-dog.png"
          alt=""
          className="absolute top-[192px] left-[52px] h-4 w-auto"
        />

        {/* 2. right Top */}
        <img
          src="assets/All Icon Used/uil_food.png"
          alt=""
          className="absolute top-[250px] right-8 h-7 w-auto"
        />

        {/* 3. left Center */}
        <img
          src="assets/All Icon Used/flowbite_bowl-food-outline.png"
          alt=""
          className="absolute top-[510px] left-5 h-10 w-auto"
        />

        {/* 4. right Center */}
        <img
          src="assets/All Icon Used/famicons_fast-food-outline.png"
          alt=""
          className="absolute top-[565px] right-6 h-6 w-auto"
        />

        {/* 5. left Bottom */}
        <img
          src="assets/All Icon Used/mdi_food-ramen.png"
          alt=""
          className="absolute top-[788px] left-16 h-8 w-auto"
        />
      </div>
      
      {/* Simple Redirect Message */}
      <AnimatePresence>
        {showRedirectMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-800">
                🔒 You are not logged in. Please log in or sign up to continue.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <HeroSection />
      <MealOptions />
      <footer className="mt-16 md:mt-20 lg:mt-16 pb-10 md:pb-16 text-center text-sm text-muted-foreground">
        By using Keji, you agree to our <a href="/terms" className="underline">Terms</a> and
        {' '}have read our <a href="/privacy" className="underline">Privacy Policy</a>
      </footer>
    </PageContainer>
  );
};

export default Index;
