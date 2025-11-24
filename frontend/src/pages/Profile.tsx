import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import Logo from "@/components/branding/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBackendUrl } from "@/lib/utils";
import { useSession } from "@/contexts/SessionContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ChatStyleModal from "@/components/modals/ChatStyleModal";

interface UserData {
  name?: string;
  email?: string;
  avatar?: string;
  food_status?: string;
}

const Profile = () => {
  const { user, logout, isLoading, updateUserName, updateChatStyle } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChatStyleModalOpen, setIsChatStyleModalOpen] = useState(false);
  const [chatStyle, setChatStyle] = useState(user?.chat_style || "pure_english");

  useEffect(() => {
    setNameInput(user?.name || "");
  }, [user?.name]);

  useEffect(() => {
    setChatStyle(user?.chat_style || "pure_english");
  }, [user?.chat_style]);

  const handleLogout = async () => {
    await logout();
  };

  const settingsItems = [
    // { icon: "assets/All Icon Used/mdi_password.png", label: "Password", onClick: () => {} },
    { icon: "assets/All Icon Used/mingcute_voice-fill.png", label: "Switch Mood", onClick: () => setIsChatStyleModalOpen(true) },
    { icon: "assets/All Icon Used/mage_star-fill.png", label: "Favourites", onClick: () => {} },
  ];


  const applicationItems = [
    { icon: "assets/All Icon Used/Vector.png", label: "About Application", onClick: () => {} },
    { icon: "assets/All Icon Used/hugeicons_agreement-03.png", label: "Terms & Conditions", onClick: () => {} },
    { icon: "assets/All Icon Used/basil_logout-outline.png", label: "Logout", onClick: handleLogout },
  ];

  const handleNameSave = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      toast({
        title: "Name too short",
        description: "Name must be at least 2 characters.",
        variant: "destructive",
      });
      return;
    }

    if (trimmed === user?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const response = await fetch(`${getBackendUrl()}/update-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.user?.name) {
          updateUserName(data.user.name);
        }
        toast({
          title: "Name updated",
          description: "Your profile name has been updated.",
        });
        setIsEditingName(false);
      } else {
        toast({
          title: "Update failed",
          description: data.error || "Could not update your name. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Name update error:", error);
      toast({
        title: "Network error",
        description: "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer Logo={<Logo />} variant="compact">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="compact">
      <SEO 
        title="Profile — Keji AI" 
        description="Manage your profile and settings" 
      />
      
      <div className="max-w-md mx-auto space-y-4 px-5">
        {/* Profile Header */}
        <div className="flex items-center justify-center mb-10 relative">
          <Button
            variant="ghost"
            onClick={() => navigate("/homepage")}
            className="absolute left-0 p-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: 24, height: 24 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5 L7 12 L15 19" />
              <line x1="7" y1="12" x2="21" y2="12" />
            </svg>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        </div>

        {/* User Info Section */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.initial} alt={user?.fname} />
            <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
              {user?.fname?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-3">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isSavingName}
                  className="bg-transparent border-0 border-b border-black rounded-none px-0 text-xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setNameInput(user?.name || "");
                  }}
                  disabled={isSavingName}
                  className="bg-transparent text-black text-3xl hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  ×
                </button>
                <Button
                  onClick={handleNameSave}
                  disabled={isSavingName}
                  className="px-3 text-lg"
                >
                  {isSavingName ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <h2 className="text-xl font-semibold text-foreground">
                {user?.name || "User"}
              </h2>
            )}
          </div>
          
          {!isEditingName && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setIsEditingName(true)}
            >
              <img src="assets/All Icon Used/iconamoon_edit-thin.png" className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* Food Status Card */}
        <Card className="bg-ingredient-green text-white border-none">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-white font-normal text-xl">Food Status</span>
              <span className="text-xl font-medium">
                {"Odogwu"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Other Settings */}
        <div className="bg-white p-5 rounded-3xl pt-4 border">
          <CardContent className="p-0">
            <h3 className="text-lg font-semibold text-foreground mb-2">Other settings</h3>
            <div className="space-y-3">
              {settingsItems.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  className="w-full justify-start text-left p-3 h-14 rounded-md bg-background shadow-sm border"
                  onClick={item.onClick}
                >
                  <img src={item.icon} alt={item.label} className="h-5 w-5 mr-1 object-contain" />
                  <span className="text-xl font-semibold">{item.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </div>

        {/* Application Section */}
        <div className="bg-white p-5 rounded-3xl border">
          <CardContent className="p-0">
            <div className="space-y-3">
              {applicationItems.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  className="w-full justify-start text-left p-3 h-auto rounded-md bg-background shadow-sm border"
                  onClick={item.onClick}
                >
                  <img src={item.icon} alt={item.label} className="h-5 w-5 mr-1 object-contain" />
                  <span className="text-xl font-semibold">{item.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </div>
      </div>

      <ChatStyleModal
        isOpen={isChatStyleModalOpen}
        onClose={() => setIsChatStyleModalOpen(false)}
        currentStyle={chatStyle}
        onStyleUpdate={(style) => {
          setChatStyle(style);
          updateChatStyle(style);
        }}
      />
    </PageContainer>
  );
};

export default Profile;
