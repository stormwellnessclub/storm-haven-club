import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { SessionMonitor } from "@/components/SessionMonitor";
import { ProtectedAdminRoute } from "@/components/admin/ProtectedAdminRoute";
import { ProtectedMemberRoute } from "@/components/member/ProtectedMemberRoute";
import MemberDashboard from "@/pages/member/Dashboard";
import MemberProfile from "@/pages/member/Profile";
import MemberCredits from "@/pages/member/Credits";
import MemberMembership from "@/pages/member/Membership";
import MemberBookings from "@/pages/member/Bookings";
import MemberWaivers from "@/pages/member/Waivers";
import KidsCareServiceForm from "@/pages/member/KidsCareServiceForm";
import MemberSupport from "@/pages/member/Support";
import MemberFreezeRequest from "@/pages/member/FreezeRequest";
import MemberPaymentMethods from "@/pages/member/PaymentMethods";
import HealthScore from "@/pages/member/HealthScore";
import Achievements from "@/pages/member/Achievements";
import Workouts from "@/pages/member/Workouts";
import Habits from "@/pages/member/Habits";
import Goals from "@/pages/member/Goals";
import FitnessProfile from "@/pages/member/FitnessProfile";
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
import Schedule from "./pages/Schedule";
import MyBookings from "./pages/MyBookings";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/admin/Dashboard";
import Members from "./pages/admin/Members";
import MemberCreditsAdmin from "./pages/admin/MemberCredits";
import CheckIn from "./pages/admin/CheckIn";
import Applications from "./pages/admin/Applications";
import Appointments from "./pages/admin/Appointments";
import Payments from "./pages/admin/Payments";
import Settings from "./pages/admin/Settings";
import GuestPasses from "./pages/admin/GuestPasses";
import CafePOS from "./pages/admin/CafePOS";
import Childcare from "./pages/admin/Childcare";
import AdminClasses from "./pages/admin/Classes";
import StaffRoles from "./pages/admin/StaffRoles";
import ClassTypes from "./pages/admin/ClassTypes";
import Instructors from "./pages/admin/Instructors";
import ClassSchedules from "./pages/admin/ClassSchedules";
import EmailManagement from "./pages/admin/EmailManagement";
import FreezeRequests from "./pages/admin/FreezeRequests";
import Equipment from "./pages/admin/Equipment";
import Agreements from "./pages/admin/Agreements";
import DesignSystem from "./pages/DesignSystem";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SessionMonitor />
            <ScrollToTop />
            <Routes>
              {/* Public Routes */}
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
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/design-system" element={<DesignSystem />} />
              
              {/* Member Portal Routes - Protected */}
              <Route path="/member" element={<ProtectedMemberRoute><MemberDashboard /></ProtectedMemberRoute>} />
              <Route path="/member/profile" element={<ProtectedMemberRoute><MemberProfile /></ProtectedMemberRoute>} />
              <Route path="/member/credits" element={<ProtectedMemberRoute><MemberCredits /></ProtectedMemberRoute>} />
              <Route path="/member/membership" element={<ProtectedMemberRoute><MemberMembership /></ProtectedMemberRoute>} />
              <Route path="/member/payment-methods" element={<ProtectedMemberRoute><MemberPaymentMethods /></ProtectedMemberRoute>} />
              <Route path="/member/bookings" element={<ProtectedMemberRoute><MemberBookings /></ProtectedMemberRoute>} />
              <Route path="/member/waivers" element={<ProtectedMemberRoute><MemberWaivers /></ProtectedMemberRoute>} />
              <Route path="/member/kids-care-service-form" element={<ProtectedMemberRoute><KidsCareServiceForm /></ProtectedMemberRoute>} />
              <Route path="/member/support" element={<ProtectedMemberRoute><MemberSupport /></ProtectedMemberRoute>} />
              <Route path="/member/freeze" element={<ProtectedMemberRoute><MemberFreezeRequest /></ProtectedMemberRoute>} />
              <Route path="/member/health-score" element={<ProtectedMemberRoute><HealthScore /></ProtectedMemberRoute>} />
              <Route path="/member/achievements" element={<ProtectedMemberRoute><Achievements /></ProtectedMemberRoute>} />
              <Route path="/member/workouts" element={<ProtectedMemberRoute><Workouts /></ProtectedMemberRoute>} />
              <Route path="/member/habits" element={<ProtectedMemberRoute><Habits /></ProtectedMemberRoute>} />
              <Route path="/member/goals" element={<ProtectedMemberRoute><Goals /></ProtectedMemberRoute>} />
              <Route path="/member/fitness-profile" element={<ProtectedMemberRoute><FitnessProfile /></ProtectedMemberRoute>} />
              
              {/* Admin Routes - Protected by Role */}
              <Route path="/admin" element={<ProtectedAdminRoute><Dashboard /></ProtectedAdminRoute>} />
              <Route path="/admin/check-in" element={<ProtectedAdminRoute><CheckIn /></ProtectedAdminRoute>} />
              <Route path="/admin/members" element={<ProtectedAdminRoute><Members /></ProtectedAdminRoute>} />
              <Route path="/admin/member-credits" element={<ProtectedAdminRoute><MemberCreditsAdmin /></ProtectedAdminRoute>} />
              <Route path="/admin/applications" element={<ProtectedAdminRoute><Applications /></ProtectedAdminRoute>} />
              <Route path="/admin/appointments" element={<ProtectedAdminRoute><Appointments /></ProtectedAdminRoute>} />
              <Route path="/admin/payments" element={<ProtectedAdminRoute><Payments /></ProtectedAdminRoute>} />
              <Route path="/admin/guest-passes" element={<ProtectedAdminRoute><GuestPasses /></ProtectedAdminRoute>} />
              <Route path="/admin/cafe" element={<ProtectedAdminRoute><CafePOS /></ProtectedAdminRoute>} />
              <Route path="/admin/childcare" element={<ProtectedAdminRoute><Childcare /></ProtectedAdminRoute>} />
              <Route path="/admin/classes" element={<ProtectedAdminRoute><AdminClasses /></ProtectedAdminRoute>} />
              <Route path="/admin/class-types" element={<ProtectedAdminRoute><ClassTypes /></ProtectedAdminRoute>} />
              <Route path="/admin/instructors" element={<ProtectedAdminRoute><Instructors /></ProtectedAdminRoute>} />
              <Route path="/admin/class-schedules" element={<ProtectedAdminRoute><ClassSchedules /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-roles" element={<ProtectedAdminRoute><StaffRoles /></ProtectedAdminRoute>} />
              <Route path="/admin/settings" element={<ProtectedAdminRoute><Settings /></ProtectedAdminRoute>} />
              <Route path="/admin/emails" element={<ProtectedAdminRoute><EmailManagement /></ProtectedAdminRoute>} />
              <Route path="/admin/freeze-requests" element={<ProtectedAdminRoute><FreezeRequests /></ProtectedAdminRoute>} />
              <Route path="/admin/equipment" element={<ProtectedAdminRoute><Equipment /></ProtectedAdminRoute>} />
              <Route path="/admin/agreements" element={<ProtectedAdminRoute><Agreements /></ProtectedAdminRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
