import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import CandidateOnboarding from "./pages/CandidateOnboarding";
import CandidateDashboard from "./pages/CandidateDashboard";
import EmployerBriefing from "./pages/EmployerBriefing";
import EmployerDashboard from "./pages/EmployerDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/candidate/onboarding" element={<CandidateOnboarding />} />
          <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
          <Route path="/employer/briefing" element={<EmployerBriefing />} />
          <Route path="/employer/dashboard" element={<EmployerDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
