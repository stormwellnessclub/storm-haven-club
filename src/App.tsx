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
import PaymentHistory from "@/pages/member/PaymentHistory";
import MemberEntry from "@/pages/member/Entry";
import HealthScore from "@/pages/member/HealthScore";
import Achievements from "@/pages/member/Achievements";
import Workouts from "@/pages/member/Workouts";
import Habits from "@/pages/member/Habits";
import Goals from "@/pages/member/Goals";
import FitnessProfile from "@/pages/member/FitnessProfile";
import MemberWellness from "@/pages/member/Wellness";
import CheckInHistory from "@/pages/member/CheckInHistory";
import MemberSchedule from "@/pages/member/Schedule";
import MemberReferrals from "@/pages/member/Referrals";
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
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import Schedule from "./pages/Schedule";
import MyBookings from "./pages/MyBookings";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import FAQ from "./pages/FAQ";
import GuestPass from "./pages/GuestPass";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/admin/Dashboard";
import Members from "./pages/admin/Members";
import MemberDetail from "./pages/admin/MemberDetail";
import MemberCreditsAdmin from "./pages/admin/MemberCredits";
import CheckIn from "./pages/admin/CheckIn";
import AdminCheckInHistory from "./pages/admin/CheckInHistory";
import Scanner from "./pages/admin/Scanner";
import Applications from "./pages/admin/Applications";
import Appointments from "./pages/admin/Appointments";
import Payments from "./pages/admin/Payments";
import PaymentReports from "./pages/admin/PaymentReports";
import PaymentTracking from "./pages/admin/PaymentTracking";
import RevenueAnalytics from "./pages/admin/RevenueAnalytics";
import Settings from "./pages/admin/Settings";
import GuestPasses from "./pages/admin/GuestPasses";
import GuestManagement from "./pages/admin/GuestManagement";
import CafePOS from "./pages/admin/CafePOS";
import CafeMenuManager from "./pages/admin/CafeMenuManager";
import Childcare from "./pages/admin/Childcare";
import AdminClasses from "./pages/admin/Classes";
import StaffRoles from "./pages/admin/StaffRoles";
import StaffDetail from "./pages/admin/StaffDetail";
import ClassTypes from "./pages/admin/ClassTypes";
import ClassTypeDetail from "./pages/admin/ClassTypeDetail";
import Instructors from "./pages/admin/Instructors";
import ClassSchedules from "./pages/admin/ClassSchedules";
import EmailManagement from "./pages/admin/EmailManagement";
import FreezeRequests from "./pages/admin/FreezeRequests";
import Equipment from "./pages/admin/Equipment";
import Agreements from "./pages/admin/Agreements";
import Reports from "./pages/admin/Reports";
import FrontDeskPOS from "./pages/admin/FrontDeskPOS";
import ClassRoster from "./pages/admin/ClassRoster";
import Marketing from "./pages/admin/Marketing";
import NonMemberAccounts from "./pages/admin/NonMemberAccounts";
import NonMemberDetail from "./pages/admin/NonMemberDetail";
import People from "./pages/admin/People";
import BlockedPersons from "./pages/admin/BlockedPersons";
import StaffHub from "./pages/admin/StaffHub";
import MerchManager from "./pages/admin/MerchManager";
import Merch from "./pages/Merch";
import DesignSystem from "./pages/DesignSystem";
import GuestFeedback from "./pages/GuestFeedback";
import { ProtectedPortalRoute } from "@/components/portal/ProtectedPortalRoute";
import PortalDashboard from "@/pages/portal/Dashboard";
import PortalBookings from "@/pages/portal/Bookings";
import PortalPasses from "@/pages/portal/Passes";
import PortalPaymentMethods from "@/pages/portal/PaymentMethods";
import PortalPaymentHistory from "@/pages/portal/PaymentHistory";
import PortalProfile from "@/pages/portal/Profile";
import PortalSupport from "@/pages/portal/Support";
import PortalRecovery from "@/pages/portal/Recovery";

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
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/guest-pass" element={<GuestPass />} />
              <Route path="/guest-feedback" element={<GuestFeedback />} />
              <Route path="/design-system" element={<DesignSystem />} />
              <Route path="/merch" element={<Merch />} />
              <Route path="/shop" element={<Merch />} />
              
              {/* Member Portal Routes - Protected */}
              <Route path="/member" element={<ProtectedMemberRoute><MemberDashboard /></ProtectedMemberRoute>} />
              <Route path="/member/profile" element={<ProtectedMemberRoute><MemberProfile /></ProtectedMemberRoute>} />
              <Route path="/member/credits" element={<ProtectedMemberRoute><MemberCredits /></ProtectedMemberRoute>} />
              <Route path="/member/membership" element={<ProtectedMemberRoute><MemberMembership /></ProtectedMemberRoute>} />
              <Route path="/member/payment-methods" element={<ProtectedMemberRoute><MemberPaymentMethods /></ProtectedMemberRoute>} />
              <Route path="/member/payment-history" element={<ProtectedMemberRoute><PaymentHistory /></ProtectedMemberRoute>} />
              <Route path="/member/entry" element={<ProtectedMemberRoute><MemberEntry /></ProtectedMemberRoute>} />
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
              <Route path="/member/wellness" element={<ProtectedMemberRoute><MemberWellness /></ProtectedMemberRoute>} />
              <Route path="/member/check-in-history" element={<ProtectedMemberRoute><CheckInHistory /></ProtectedMemberRoute>} />
              <Route path="/member/schedule" element={<ProtectedMemberRoute><MemberSchedule /></ProtectedMemberRoute>} />
              <Route path="/member/referrals" element={<ProtectedMemberRoute><MemberReferrals /></ProtectedMemberRoute>} />
              
              {/* Portal Routes - Non-Member Class Portal */}
              <Route path="/portal" element={<ProtectedPortalRoute><PortalDashboard /></ProtectedPortalRoute>} />
              <Route path="/portal/bookings" element={<ProtectedPortalRoute><PortalBookings /></ProtectedPortalRoute>} />
              <Route path="/portal/passes" element={<ProtectedPortalRoute><PortalPasses /></ProtectedPortalRoute>} />
              <Route path="/portal/payment-methods" element={<ProtectedPortalRoute><PortalPaymentMethods /></ProtectedPortalRoute>} />
              <Route path="/portal/payment-history" element={<ProtectedPortalRoute><PortalPaymentHistory /></ProtectedPortalRoute>} />
              <Route path="/portal/profile" element={<ProtectedPortalRoute><PortalProfile /></ProtectedPortalRoute>} />
              <Route path="/portal/support" element={<ProtectedPortalRoute><PortalSupport /></ProtectedPortalRoute>} />
              <Route path="/portal/wellness" element={<ProtectedPortalRoute><PortalRecovery /></ProtectedPortalRoute>} />
              
              {/* Admin Routes - Protected by Role */}
              <Route path="/admin" element={<ProtectedAdminRoute><Dashboard /></ProtectedAdminRoute>} />
              <Route path="/admin/check-in" element={<ProtectedAdminRoute><CheckIn /></ProtectedAdminRoute>} />
              <Route path="/admin/check-in-history" element={<ProtectedAdminRoute><AdminCheckInHistory /></ProtectedAdminRoute>} />
              <Route path="/admin/scanner" element={<ProtectedAdminRoute><Scanner /></ProtectedAdminRoute>} />
              <Route path="/admin/members" element={<ProtectedAdminRoute><Members /></ProtectedAdminRoute>} />
              <Route path="/admin/members/:id" element={<ProtectedAdminRoute><MemberDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/member-credits" element={<ProtectedAdminRoute><MemberCreditsAdmin /></ProtectedAdminRoute>} />
              <Route path="/admin/applications" element={<ProtectedAdminRoute><Applications /></ProtectedAdminRoute>} />
              <Route path="/admin/appointments" element={<ProtectedAdminRoute><Appointments /></ProtectedAdminRoute>} />
              <Route path="/admin/payments" element={<ProtectedAdminRoute><Payments /></ProtectedAdminRoute>} />
              <Route path="/admin/payment-reports" element={<ProtectedAdminRoute><PaymentReports /></ProtectedAdminRoute>} />
              <Route path="/admin/payment-tracking" element={<ProtectedAdminRoute><PaymentTracking /></ProtectedAdminRoute>} />
              <Route path="/admin/revenue-analytics" element={<ProtectedAdminRoute><RevenueAnalytics /></ProtectedAdminRoute>} />
              <Route path="/admin/guest-passes" element={<ProtectedAdminRoute><GuestPasses /></ProtectedAdminRoute>} />
              <Route path="/admin/guests" element={<ProtectedAdminRoute><GuestManagement /></ProtectedAdminRoute>} />
              <Route path="/admin/cafe" element={<ProtectedAdminRoute><CafePOS /></ProtectedAdminRoute>} />
              <Route path="/admin/cafe-menu" element={<ProtectedAdminRoute><CafeMenuManager /></ProtectedAdminRoute>} />
              <Route path="/admin/childcare" element={<ProtectedAdminRoute><Childcare /></ProtectedAdminRoute>} />
              <Route path="/admin/classes" element={<ProtectedAdminRoute><AdminClasses /></ProtectedAdminRoute>} />
              <Route path="/admin/class-types" element={<ProtectedAdminRoute><ClassTypes /></ProtectedAdminRoute>} />
              <Route path="/admin/class-types/:id" element={<ProtectedAdminRoute><ClassTypeDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/instructors" element={<ProtectedAdminRoute><Instructors /></ProtectedAdminRoute>} />
              <Route path="/admin/class-schedules" element={<ProtectedAdminRoute><ClassSchedules /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-roles" element={<ProtectedAdminRoute><StaffRoles /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-roles/:userId" element={<ProtectedAdminRoute><StaffDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/settings" element={<ProtectedAdminRoute><Settings /></ProtectedAdminRoute>} />
              <Route path="/admin/emails" element={<ProtectedAdminRoute><EmailManagement /></ProtectedAdminRoute>} />
              <Route path="/admin/freeze-requests" element={<ProtectedAdminRoute><FreezeRequests /></ProtectedAdminRoute>} />
              <Route path="/admin/equipment" element={<ProtectedAdminRoute><Equipment /></ProtectedAdminRoute>} />
              <Route path="/admin/agreements" element={<ProtectedAdminRoute><Agreements /></ProtectedAdminRoute>} />
              <Route path="/admin/reports" element={<ProtectedAdminRoute><Reports /></ProtectedAdminRoute>} />
              <Route path="/admin/front-desk" element={<ProtectedAdminRoute><FrontDeskPOS /></ProtectedAdminRoute>} />
              <Route path="/admin/class-roster/:sessionId" element={<ProtectedAdminRoute><ClassRoster /></ProtectedAdminRoute>} />
              <Route path="/admin/marketing" element={<ProtectedAdminRoute><Marketing /></ProtectedAdminRoute>} />
              <Route path="/admin/non-member-accounts" element={<ProtectedAdminRoute><NonMemberAccounts /></ProtectedAdminRoute>} />
              <Route path="/admin/non-member-accounts/:userId" element={<ProtectedAdminRoute><NonMemberDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/people" element={<ProtectedAdminRoute><People /></ProtectedAdminRoute>} />
              <Route path="/admin/blocked" element={<ProtectedAdminRoute><BlockedPersons /></ProtectedAdminRoute>} />
              <Route path="/admin/merch" element={<ProtectedAdminRoute><MerchManager /></ProtectedAdminRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
