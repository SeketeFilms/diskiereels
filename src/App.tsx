import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAgeVerification } from "@/hooks/useAgeVerification";
import AgeGate from "@/components/AgeGate";

// Eager load all main navigation routes for instant switching
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import CreatorDashboard from "./pages/CreatorDashboard";
import Milestones from "./pages/Milestones";
import Messages from "./pages/Messages";
import VideoAnalytics from "./pages/VideoAnalytics";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ParentDashboard from "./pages/ParentDashboard";
import Install from "./pages/Install";
import StarsDashboard from "./pages/StarsDashboard";
import ToonlyStudio from "./pages/ToonlyStudio";
import Leaderboard from "./pages/Leaderboard";
import ToonlyAI from "./components/ToonlyAI";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - reduce refetches
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: 1, // Reduce retry attempts to prevent freezing
      refetchOnWindowFocus: false, // Disable refetch on focus to reduce network calls
      refetchOnReconnect: false,
    },
  },
});

// Component to handle age gate logic
const AppContent = () => {
  const { isVerified, verify } = useAgeVerification();
  const location = useLocation();

  // Allow access to legal pages without verification
  const legalPages = ["/privacy-policy", "/terms-of-service", "/install"];
  const isLegalPage = legalPages.includes(location.pathname);

  // Show app logo while checking verification status
  if (isVerified === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#333333' }}>
        <img 
          src="/toonlyreels-splash-logo.png" 
          alt="ToonlyReels" 
          className="h-28 w-28 object-contain rounded-2xl"
        />
      </div>
    );
  }

  // Show age gate if not verified and not on a legal page
  if (!isVerified && !isLegalPage) {
    return <AgeGate onVerified={verify} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/search" element={<Search />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/video-analytics/:videoId" element={<VideoAnalytics />} />
        <Route path="/creator-dashboard" element={<CreatorDashboard />} />
        <Route path="/milestones" element={<Milestones />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/parent-dashboard" element={<ParentDashboard />} />
        <Route path="/install" element={<Install />} />
        <Route path="/stars-dashboard" element={<StarsDashboard />} />
        <Route path="/toonly-studio" element={<ToonlyStudio />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToonlyAI />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
