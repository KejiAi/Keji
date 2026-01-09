import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import MealOptions from "@/components/sections/MealOptions";
import ChatInputSection from "@/components/chat/ChatInputSection";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import BudgetModal from "@/components/modals/BudgetModal";
import IngredientModal from "@/components/modals/IngredientModal";
import { useAuthContext } from "@/contexts/AuthContext";

const Homepage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, isLoading, logout, greeting } = useAuthContext();

  const menuRef = useRef<HTMLDivElement | null>(null);

  // 🔹 Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const MAX_ATTACHMENTS = 2;

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    const filesToSend = selectedFiles.slice(0, MAX_ATTACHMENTS);

    if (!trimmedMessage && filesToSend.length === 0) {
      return;
    }

    navigate("/chat", { state: { message: trimmedMessage, files: filesToSend } });
    setMessage("");
    setSelectedFiles([]);
  };

  const handleBudgetSubmit = (budgetMessage: string) => {
    navigate("/chat", { state: { message: budgetMessage } });
  };

  const handleIngredientSubmit = (ingredientMessage: string) => {
    navigate("/chat", { state: { message: ingredientMessage } });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  if (!user) return null; // Just in case

  return (
    <PageContainer variant="compact">
      <SEO
        title="Homepage — Keji AI"
        description="Your personalized food assistant dashboard"
      />
      
      {/* Header with user info and menu */}
      <div className="max-w-xs md:max-w-2xl mx-auto relative">
        <header className="flex justify-between mb-8 md:items-center relative">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.initial} alt={user.fname} />
              <AvatarFallback className="bg-secondary text-foreground font-medium">
                {user.fname.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-base font-geist font-medium text-foreground">
              {user.fname}
            </h1>
          </div>
          
          {/* 🔹 Menu button with image */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 md:mt-0"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <img
                src="assets\All Icon Used\gg_menu-left.png"   // 👈 replace with your image path
                alt="menu"
                className="h-6 w-6 object-contain"
              />
              <span className="sr-only">Open menu</span>
            </Button>

            {/* 🔹 Dropdown Menu with animation */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-32 bg-white shadow-lg rounded-xl border border-border overflow-hidden z-50"
                >
                  <button
                    onClick={() => navigate("/chat")}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => navigate("/profile")}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                  >
                    Profile
                  </button>
                  {/* <button
                    onClick={() => navigate("/report")}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                  >
                    Report
                  </button> */}
                  <button
                    onClick={() => navigate("/feedback")}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                  >
                    Feedback
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Main greeting */}
        <div className="mb-10 md:mb-12 mt-12">
          <h2 className="font-funnelDisplay leading-none text-left">
            <span className="inline-flex items-center gap-2 flex-wrap">
              {greeting.type === 'night' && greeting.message ? (
                <>
                  <span className="text-primary text-2xl md:text-4xl font-bold">{greeting.message}</span>
                </>
              ) : (
                <>
                  <span className="text-gray-400 text-xl md:text-2xl font-normal">Good {greeting.type}</span>{" "}
                  <img 
                    src={
                      greeting.type === "morning" 
                        ? "assets/All Icon Used/vaadin_morning.svg"
                        : greeting.type === "afternoon"
                        ? "assets/All Icon Used/mingcute_sun-fill.svg"
                        : "assets/All Icon Used/material-symbols-light_clear-night.svg"
                    }
                    alt={greeting.type}
                    className="h-6 w-6 md:h-8 md:w-8 inline"
                  />{" "}
                  <span className="text-primary text-3xl md:text-4xl font-extrabold">{user.fname},</span>
                </>
              )}
            </span>
            <br />
            <span className="text-brand-deep text-[2.5rem] md:text-5xl font-extrabold">How can I help you today?</span>
          </h2>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:mb-2">
          <Button
            onClick={() => setBudgetModalOpen(true)}
            className="h-52 md:h-60 rounded-3xl bg-budget-red
                       text-budget-red-foreground  pt-6 pb-6 flex flex-col
                       justify-between text-left relative overflow-hidden group"
            size="lg"
          >
              {/* Left icon */}
              <img 
                src="assets\All Icon Used\tabler_currency-naira.png" 
                alt="Budget Icon" 
                className="w-10 h-10 object-contain absolute top-5 left-3" 
              />
              
              {/* Right icon */}
              <img 
                src="assets\All Icon Used\Arrow icon 1.png" 
                alt="Budget Icon" 
                className="w-4 h-4 object-contain absolute top-7 right-5" 
              />

            <div className="absolute left-3 mt-28">
              <span className="text-lg md:text-2xl font-funnelDisplay font-medium">
                Enter your<br />Budget
              </span>
            </div>
          </Button>

          <Button
            onClick={() => setIngredientModalOpen(true)}
            className="h-52 md:h-60 rounded-3xl bg-brand-deep hover:bg-brand-deep
                       text-budget-red-foreground pl-4 pt-6 pb-6 flex flex-col items-start
                       justify-between text-left relative overflow-hidden group"
            size="lg"
          >
            <div className="flex">
              <img 
                src="assets\All Icon Used\ph_bowl-food-fill.png" 
                alt="Budget Icon" 
                className="w-11 h-11 object-contain absolute top-5 left-3" 
              />
              {/* Right icon */}
              <img 
                src="assets\All Icon Used\Arrow icon.png" 
                alt="Budget Icon" 
                className="w-4 h-4 object-contain absolute top-7 right-5" 
              />
            </div>
            
            <div className="absolute left-3 mt-28">
              <span className="text-lg md:text-2xl font-funnelDisplay font-medium">
                Start with<br />Ingredient
              </span>
            </div>
          </Button>
        </div>

        {/* Meal options */}
        <MealOptions className="pt-2" />

        {/* Chat input area */}
        <ChatInputSection
          message={message}
          onMessageChange={setMessage}
          onSendMessage={handleSendMessage}
          selectedFiles={selectedFiles}
          onFilesChange={setSelectedFiles}
          placeholder="E.g: I have ₦600, what can I eat"
          isFixed={true}
        />

        {/* Spacer so content doesn't hide behind the fixed bar */}
        <div className="h-28 md:h-0"></div>
      </div>

      {/* Budget Modal */}
      <BudgetModal 
        open={budgetModalOpen}
        onOpenChange={setBudgetModalOpen}
        onSubmit={handleBudgetSubmit}
      />

      {/* Ingredient Modal */}
      <IngredientModal 
        open={ingredientModalOpen}
        onOpenChange={setIngredientModalOpen}
        onSubmit={handleIngredientSubmit}
      />
    </PageContainer>
  );
};

export default Homepage;