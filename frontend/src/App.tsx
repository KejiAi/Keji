import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import MobileOnlyWrapper from "./components/common/MobileOnlyWrapper";
import Index from "./pages/Index";
import Start from "./pages/Start";
import AuthCallback from "./pages/AuthCallback";
import EmailVerification from "./pages/EmailVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Homepage from "./pages/Homepage";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Feedback from "./pages/Feedback";
import NotFound from "./pages/NotFound";
import { getBackendUrl } from "@/lib/utils";

const queryClient = new QueryClient();
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_CHECK_TIMEOUT_MS = 10 * 1000;

const BackendHealthCheck = () => {
  useEffect(() => {
    let activeRequest: AbortController | null = null;
    const backendUrl = getBackendUrl();

    const checkBackendHealth = async () => {
      if (activeRequest) return;

      const controller = new AbortController();
      activeRequest = controller;
      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, HEALTH_CHECK_TIMEOUT_MS);

      try {
        const response = await fetch(`${backendUrl}/health`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Backend health check failed with status ${response.status}`);
        }
      } catch (error) {
        if (timedOut) {
          console.error("Backend health check timed out.");
        } else if (!controller.signal.aborted) {
          console.error("Backend health check failed:", error);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (activeRequest === controller) {
          activeRequest = null;
        }
      }
    };

    void checkBackendHealth();
    const intervalId = window.setInterval(
      () => void checkBackendHealth(),
      HEALTH_CHECK_INTERVAL_MS
    );

    return () => {
      window.clearInterval(intervalId);
      activeRequest?.abort();
    };
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BackendHealthCheck />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <MobileOnlyWrapper>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/start" element={<Start />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/email-verification" element={<EmailVerification />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/homepage" element={<ProtectedRoute><Homepage /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
                <Route path="/error" element={<NotFound />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MobileOnlyWrapper>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
