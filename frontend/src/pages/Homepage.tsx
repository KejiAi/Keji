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

const frontendUrl = import.meta.env.VITE_FRONTEND_BASE_URL;


const Homepage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // 👈 track dropdown state
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { user, isLoading, logout } = useSession();

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

  const handleSendMessage = () => {
    if (message.trim() || selectedFiles.length > 0) {
      navigate("/chat", { state: { message: message, files: selectedFiles } });
      setMessage("");
      setSelectedFiles([]);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
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
    await logout();
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
                    onClick={() => navigate("/report")}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                  >
                    Report
                  </button>
                  <button
                    onClick={() => navigate("/profile")}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100 text-red-600"
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Main greeting */}
        <div className="mb-10 md:mb-12 mt-12">
          <h2 className="text-3xl md:text-5xl font-funnelDisplay font-bold leading-tight text-left">
            <span className="text-primary">
              {user.greet ? user.greet : user.time ? `${user.time} ${user.fname}` : `Hi ${user.fname}`},
            </span>
            <br />
            <span>How can I help you today?</span>
          </h2>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:mb-2">
          <Button
            onClick={() => setBudgetModalOpen(true)}
            className="h-52 md:h-60 rounded-3xl bg-budget-red hover:bg-budget-red/70
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
            className="h-52 md:h-60 rounded-3xl bg-brand-deep hover:bg-brand-deep/70
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
        <div className="fixed bottom-6 left-0 right-0">
          <div className="max-w-2xl mx-auto px-4">
            {/* File preview */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 bg-background-light border border-border rounded-xl p-3">
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg text-sm">
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-end gap-2">
              <div 
                className="flex items-end p-2 bg-background-light border border-border shadow-base flex-1 rounded-3xl transition-all duration-200"
                style={textareaHeight > 48 ? { 
                  borderRadius: `${borderRadius}px`,
                  minHeight: `${textareaHeight + 16}px`
                } : {}}
              >
                <button onClick={handleFileSelect} className="flex-shrink-0 mb-1">
                  <img src="assets\All Icon Used\ic_round-plus.png" alt="Upload Button" className="h-9 w-9 object-contain" />
                </button>
                
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="E.g: I have ₦600, what can I eat"
                  className="flex-1 bg-transparent border-0 ring-0 outline-none focus:border-0 focus:ring-0 text-base placeholder:text-muted-foreground placeholder:text-xs px-2 py-3 resize-none min-h-[48px]"
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
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full flex-shrink-0 mb-1"
                  onClick={handleSendMessage}
                  disabled={!message.trim() && selectedFiles.length === 0}
                >
                  <img
                    src="assets\All Icon Used\proicons_send.png"
                    alt="menu"
                    className="h-6 w-6 object-contain"
                  />
                  <span className="sr-only">Send message</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-full p-0 hover:opacity-80 transition h-12 w-12"
              >
                <img
                    src="assets\All Icon Used\lets-icons_mic-fill.png"   // 👈 replace with your image path
                    alt="mic"
                    className="h-12 w-12 object-contain"
                  />
                <span className="sr-only">Voice input</span>
              </Button>
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