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
import Dashboard from "./pages/admin/Dashboard";
import Members from "./pages/admin/Members";
import CheckIn from "./pages/admin/CheckIn";
import Applications from "./pages/admin/Applications";
import Appointments from "./pages/admin/Appointments";
import Payments from "./pages/admin/Payments";
import Settings from "./pages/admin/Settings";

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
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/members" element={<Members />} />
            <Route path="/admin/check-in" element={<CheckIn />} />
            <Route path="/admin/applications" element={<Applications />} />
            <Route path="/admin/appointments" element={<Appointments />} />
            <Route path="/admin/payments" element={<Payments />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
