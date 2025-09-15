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

interface UserData {
  name?: string;
  email?: string;
  avatar?: string;
  food_status?: string;
}

const Profile = () => {
  const { user, logout, isLoading } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
  };

  const settingsItems = [
    { icon: "assets/All Icon Used/mdi_password.png", label: "Password", onClick: () => {} },
    { icon: "assets/All Icon Used/mingcute_voice-fill.png", label: "Change tone", onClick: () => {} },
    { icon: "assets/All Icon Used/mage_star-fill.png", label: "Favourites", onClick: () => {} },
  ];


  const applicationItems = [
    { icon: "assets/All Icon Used/Vector.png", label: "About Application", onClick: () => {} },
    { icon: "assets/All Icon Used/hugeicons_agreement-03.png", label: "Terms & Conditions", onClick: () => {} },
    { icon: "assets/All Icon Used/basil_logout-outline.png", label: "Logout", onClick: handleLogout },
  ];

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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-10">Profile</h1>
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
            <h2 className="text-xl font-semibold text-foreground">
              {user?.fname || "User"}
            </h2>
          </div>
          
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <img src="assets/All Icon Used/iconamoon_edit-thin.png" className="h-6 w-6" />
          </Button>
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
                  className="w-full justify-start text-left p-4 h-14 rounded-md bg-background shadow-sm border"
                  onClick={item.onClick}
                >
                  <img src={item.icon} alt={item.label} className="h-7 w-7 mr-3 object-contain" />
                  <span className="text-2xl font-normal">{item.label}</span>
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
                  className="w-full justify-start text-left p-4 h-auto rounded-md bg-background shadow-sm border"
                  onClick={item.onClick}
                >
                  <img src={item.icon} alt={item.label} className="h-7 w-7 mr-3 object-contain" />
                  <span className="text-2xl font-normal">{item.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </div>
      </div>
    </PageContainer>
  );
};

export default Profile;
