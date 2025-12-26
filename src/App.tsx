import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Classes from "./pages/Classes";
import Spa from "./pages/Spa";
import Cafe from "./pages/Cafe";
import Amenities from "./pages/Amenities";
import KidsCare from "./pages/KidsCare";
import ClassPasses from "./pages/ClassPasses";
import Memberships from "./pages/Memberships";
import Apply from "./pages/Apply";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/spa" element={<Spa />} />
            <Route path="/cafe" element={<Cafe />} />
            <Route path="/amenities" element={<Amenities />} />
            <Route path="/kids-care" element={<KidsCare />} />
            <Route path="/class-passes" element={<ClassPasses />} />
            <Route path="/memberships" element={<Memberships />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
