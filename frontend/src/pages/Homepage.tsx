import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import MealOptions from "@/components/sections/MealOptions";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import BudgetModal from "@/components/modals/BudgetModal";
import IngredientModal from "@/components/modals/IngredientModal";
import { getBackendUrl } from "@/lib/utils";
import { useSession } from "@/contexts/SessionContext";
import { useToast } from "@/hooks/use-toast";

const frontendUrl = import.meta.env.VITE_FRONTEND_BASE_URL;


const Homepage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // 👈 track dropdown state
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, isLoading, logout } = useSession();
  const { toast } = useToast();

  const menuRef = useRef<HTMLDivElement | null>(null); // 👈 ref for menu wrapper
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(48); // Initial height in pixels
  const [borderRadius, setBorderRadius] = useState(24); // Initial border radius

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

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24; // Approximate line height
      const minHeight = 48; // 2 lines
      const maxHeight = 120; // 5 lines max before scrolling
      
      let lines = Math.floor(scrollHeight / lineHeight);
      lines = Math.max(2, lines); // Minimum 2 lines
      
      let newHeight = minHeight;
      let newBorderRadius = 24;
      
      if (lines <= 2) {
        newHeight = minHeight;
        newBorderRadius = 24;
      } else if (lines === 3) {
        newHeight = 72;
        newBorderRadius = 18;
      } else if (lines === 4) {
        newHeight = 96;
        newBorderRadius = 12;
      } else {
        newHeight = maxHeight;
        newBorderRadius = 8;
        textarea.style.overflowY = "auto";
      }
      
      if (lines < 5) {
        textarea.style.overflowY = "hidden";
      }
      
      setTextareaHeight(newHeight);
      setBorderRadius(newBorderRadius);
      textarea.style.height = `${newHeight}px`;
    };

    adjustHeight();
  }, [message]);

  // No need for manual session fetching - handled by SessionContext

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

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combined = [...selectedFiles, ...newFiles];
      if (combined.length > MAX_ATTACHMENTS) {
        toast({
          title: "Attachment limit reached",
          description: `You can only attach up to ${MAX_ATTACHMENTS} files at a time.`,
        });
      }
      setSelectedFiles(combined.slice(0, MAX_ATTACHMENTS));
      e.target.value = ''; // Reset input
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
              {user.greet ? (
                <span className="text-primary text-2xl md:text-4xl font-bold">{user.greet}</span>
              ) : user.time ? (
                <>
                  <span className="text-gray-400 text-xl md:text-2xl font-normal">Good {user.time}</span>{" "}
                  <img 
                    src={
                      user.time === "morning" 
                        ? "assets/All Icon Used/vaadin_morning.svg"
                        : user.time === "afternoon"
                        ? "assets/All Icon Used/mingcute_sun-fill.svg"
                        : "assets/All Icon Used/material-symbols-light_clear-night.svg"
                    }
                    alt={user.time}
                    className="h-6 w-6 md:h-8 md:w-8 inline"
                  />{" "}
                  <span className="text-primary text-3xl md:text-4xl font-extrabold">{user.fname},</span>
                </>
              ) : (
                <span className="text-primary text-3xl md:text-4xl font-bold">Hi {user.fname},</span>
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
        <div className="fixed bottom-0 left-0 right-0 bg-[#FFFBFB]" style={{ borderTopLeftRadius: '40px', borderTopRightRadius: '40px' }}>
          <div className="w-full">
            {/* File preview - displayed above */}
            {selectedFiles.length > 0 && (
              <div className="px-2 mx-4 mt-3">
                <div className="flex flex-wrap gap-3">
                  {selectedFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    const fileUrl = isImage ? URL.createObjectURL(file) : null;
                    
                    return (
                      <div key={index} className="relative group">
                        <div className="flex flex-col items-center gap-1 bg-muted p-2 rounded-lg">
                          {isImage && fileUrl ? (
                            <img 
                              src={fileUrl} 
                              alt={file.name}
                              className="w-16 h-16 object-cover rounded"
                              onLoad={() => URL.revokeObjectURL(fileUrl)}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-background flex items-center justify-center rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                          )}
                          <span className="text-xs truncate max-w-[64px] text-center">{file.name}</span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute -top-0 -right-0 bg-white text-black text-2xl rounded-full w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Chat input placeholder - displayed above */}
            <div 
              className="flex items-end p-2 flex-1 mx-4 mt-3 transition-all duration-200"
              style={textareaHeight > 48 ? { 
                borderRadius: `${borderRadius}px`,
                minHeight: `${textareaHeight + 16}px`
              } : { borderRadius: '24px' }}
            > 
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="E.g: I have ₦600, what can I eat"
                className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/70 placeholder:text-base px-2 py-3 resize-none min-h-[48px]"
                onKeyDown={(e) => {
                  // On mobile, Enter creates new line, Ctrl+Enter or Cmd+Enter sends message
                  // On desktop, Enter sends message, Shift+Enter creates new line
                  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                  
                  if (e.key === "Enter") {
                    if (isMobile) {
                      // On mobile: Enter = new line, Ctrl+Enter = send
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                      // Otherwise, let Enter create a new line naturally
                    } else {
                      // On desktop: Enter = send (unless Shift is held)
                      if (!e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                      // Shift+Enter creates new line naturally
                    }
                  }
                }}
                rows={1}
              />
            </div>

            {/* Buttons container - displayed below and centralized */}
            <div className="flex items-center px-4 pb-4 pt-1 justify-between mb-2">
              <button onClick={handleFileSelect} className="flex-shrink-0 mb-1">
                  <img src="assets/All Icon Used/ic_round-plus2.png" alt="Upload Button" className="h-10 w-10 object-contain" />
              </button>

              <div className="flex items-center justify-center gap-[10px]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-0 hover:opacity-80 transition"
                >
                  <img
                    src="assets/All Icon Used/mic-HP.png"
                    alt="mic"
                    className="h-6 w-6 object-contain"
                  />
                  <span className="sr-only">Voice input</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[44px] w-[44px] rounded-full bg-black flex-shrink-0 p-0"
                  onClick={handleSendMessage}
                  disabled={!message.trim() && selectedFiles.length === 0}
                >
                  <img
                    src="assets/All Icon Used/iconamoon_send-fill-HP.png"
                    alt="Send"
                    className="h-6 w-6 object-contain"
                  />
                  <span className="sr-only">Send message</span>
                </Button>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            />
          </div>
        </div>

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