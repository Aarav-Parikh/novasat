import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { DataBootstrap } from "@/components/DataBootstrap";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BadgeWatcher } from "@/components/BadgeWatcher";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";
import Practice from "./pages/Practice.tsx";
import DailyPlan from "./pages/DailyPlan.tsx";
import WeakAreas from "./pages/WeakAreas.tsx";
import Analytics from "./pages/Analytics.tsx";
import TestSession from "./pages/TestSession.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import Pet from "./pages/Pet.tsx";
import Store from "./pages/Store.tsx";
import CoachArticle from "./pages/CoachArticle.tsx";
import AdminUsers from "./pages/admin/Users.tsx";
import AdminReviews from "./pages/admin/Reviews.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Friends from "./pages/Friends.tsx";
import Quests from "./pages/Quests.tsx";
import Updates from "./pages/Updates.tsx";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <DataBootstrap />
            <OnboardingGate />
            <BadgeWatcher />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app" element={<RequireAuth><Index /></RequireAuth>} />
              <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
              <Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
              <Route path="/quests" element={<RequireAuth><Quests /></RequireAuth>} />
              <Route path="/practice" element={<RequireAuth><Practice /></RequireAuth>} />
              <Route path="/plan" element={<RequireAuth><DailyPlan /></RequireAuth>} />
              <Route path="/coach" element={<Navigate to="/practice" replace />} />
              <Route path="/coach/:slug" element={<RequireAuth><CoachArticle /></RequireAuth>} />
              <Route path="/weak-areas" element={<RequireAuth><WeakAreas /></RequireAuth>} />
              <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/pet" element={<RequireAuth><Pet /></RequireAuth>} />
              <Route path="/store" element={<RequireAuth><Store /></RequireAuth>} />
              <Route path="/updates" element={<RequireAuth><Updates /></RequireAuth>} />
              <Route path="/admin/users" element={<RequireAuth><RequireAdmin><AdminUsers /></RequireAdmin></RequireAuth>} />
              <Route path="/admin/reviews" element={<RequireAuth><RequireAdmin><AdminReviews /></RequireAdmin></RequireAuth>} />
              <Route path="/test/:mode" element={<RequireAuth><TestSession /></RequireAuth>} />
              <Route path="/help" element={<Navigate to="/updates" replace />} />
              <Route path="/articles" element={<Navigate to="/practice" replace />} />
              <Route path="/parent" element={<Navigate to="/app" replace />} />
              <Route path="/clubs" element={<Navigate to="/quests" replace />} />
              <Route path="/clubs/:slug" element={<Navigate to="/quests" replace />} />
              <Route path="/share/:slug" element={<Navigate to="/" replace />} />
              <Route path="/duel/:id" element={<Navigate to="/friends" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
