import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Send, Mic, Plus } from "lucide-react";
import MealOptions from "@/components/sections/MealOptions";
import { useState } from "react";

const Homepage = () => {
  const [message, setMessage] = useState("");
  
  // Mock user data - in real app this would come from auth state
  const user = {
    name: "Josiah",
    avatar: "/lovable-uploads/ef051c02-7e2c-4cd8-be9d-14eafa989777.png" // Using uploaded image as placeholder
  };

  const handleSendMessage = () => {
    // Handle message sending logic here
    console.log("Sending message:", message);
    setMessage("");
  };

  return (
    <PageContainer>
      <SEO
        title="Homepage — Keji AI"
        description="Your personalized food assistant dashboard"
      />
      
      {/* Header with user info and menu */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-secondary text-foreground font-medium">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-geist font-medium text-foreground">
            {user.name}
          </h1>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </header>

      {/* Main greeting */}
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-funnelDisplay font-bold leading-tight">
          <span className="text-primary">Hi {user.name},</span>
          <br />
          <span className="text-foreground">How can I help you today?</span>
        </h2>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-2xl">
        <Button
          className="h-32 md:h-40 rounded-3xl bg-budget-red hover:bg-budget-red/90 text-budget-red-foreground p-6 flex flex-col items-start justify-between text-left relative overflow-hidden group"
          size="lg"
        >
          <div className="bg-white/20 rounded-2xl p-3 mb-2">
            <div className="w-6 h-6 bg-white/40 rounded"></div>
          </div>
          <div>
            <span className="text-xl md:text-2xl font-funnelDisplay font-bold">
              Enter your<br />Budget
            </span>
          </div>
          <div className="absolute top-4 right-4 opacity-60">
            <div className="w-6 h-6 border-2 border-white/60 transform rotate-45"></div>
          </div>
        </Button>

        <Button
          className="h-32 md:h-40 rounded-3xl bg-ingredient-green hover:bg-ingredient-green/90 text-ingredient-green-foreground p-6 flex flex-col items-start justify-between text-left relative overflow-hidden group"
          size="lg"
        >
          <div className="bg-white/20 rounded-2xl p-3 mb-2">
            <div className="w-6 h-6 bg-white/40 rounded-full"></div>
          </div>
          <div>
            <span className="text-xl md:text-2xl font-funnelDisplay font-bold">
              Start with<br />Ingredient
            </span>
          </div>
          <div className="absolute top-4 right-4 opacity-60">
            <div className="w-6 h-6 border-2 border-white/60 transform rotate-45"></div>
          </div>
        </Button>
      </div>

      {/* Meal options */}
      <MealOptions />

      {/* Chat input area */}
      <div className="fixed bottom-6 left-4 right-4 md:static md:bottom-auto md:left-auto md:right-auto max-w-2xl md:mx-0">
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-3xl shadow-lg">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
          >
            <Plus className="h-5 w-5" />
            <span className="sr-only">Add attachment</span>
          </Button>
          
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="E.g: I have ₦600, what can I eat"
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-base placeholder:text-muted-foreground"
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0"
              onClick={handleSendMessage}
              disabled={!message.trim()}
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send message</span>
            </Button>
            
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full bg-brand hover:bg-brand/90 flex-shrink-0"
            >
              <Mic className="h-5 w-5" />
              <span className="sr-only">Voice input</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom spacing for mobile */}
      <div className="h-24 md:h-0"></div>
    </PageContainer>
  );
};

export default Homepage;