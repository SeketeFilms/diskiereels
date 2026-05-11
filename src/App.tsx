import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";

import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import CreatorDashboard from "./pages/CreatorDashboard";
import Milestones from "./pages/Milestones";
// Messages merged into Notifications
import VideoAnalytics from "./pages/VideoAnalytics";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Install from "./pages/Install";
import StarsDashboard from "./pages/StarsDashboard";
import DiskieStudio from "./pages/DiskieStudio";
import Leaderboard from "./pages/Leaderboard";
import PWAQA from "./pages/PWAQA";
import DiskieAI from "./components/DiskieAI";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const AppContent = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/search" element={<Search />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/messages" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/video-analytics/:videoId" element={<VideoAnalytics />} />
        <Route path="/creator-dashboard" element={<CreatorDashboard />} />
        <Route path="/milestones" element={<Milestones />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/install" element={<Install />} />
        <Route path="/stars-dashboard" element={<StarsDashboard />} />
        <Route path="/diskie-studio" element={<DiskieStudio />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/pwa-qa" element={<PWAQA />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <DiskieAI />
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
