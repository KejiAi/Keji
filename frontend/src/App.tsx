import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/contexts/SessionContext";
import { SocketProvider } from "@/contexts/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import MobileOnlyWrapper from "./components/common/MobileOnlyWrapper";
import Index from "./pages/Index";
import Start from "./pages/Start";
import EmailVerification from "./pages/EmailVerification";
import ResetPassword from "./pages/ResetPassword";
import Homepage from "./pages/Homepage";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionProvider>
          <SocketProvider>
            <MobileOnlyWrapper>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/start" element={<Start />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/homepage" element={<ProtectedRoute><Homepage /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/error" element={<NotFound />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MobileOnlyWrapper>
          </SocketProvider>
        </SessionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
