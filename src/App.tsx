import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { SessionMonitor } from "@/components/SessionMonitor";
import { ProtectedAdminRoute } from "@/components/admin/ProtectedAdminRoute";
import { ProtectedMemberRoute } from "@/components/member/ProtectedMemberRoute";
import MemberDashboard from "@/pages/member/Dashboard";
import MemberBook from "@/pages/member/Book";
import MemberBookClass from "@/pages/member/BookClass";
import MemberProfile from "@/pages/member/Profile";
import MemberCredits from "@/pages/member/Credits";
import MemberMembership from "@/pages/member/Membership";
import MemberBookings from "@/pages/member/Bookings";
import MemberWaivers from "@/pages/member/Waivers";
import KidsCareServiceForm from "@/pages/member/KidsCareServiceForm";
import MemberKidsCare from "@/pages/member/KidsCare";
import KidsCareBookings from "@/pages/member/KidsCareBookings";
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

import MemberReferrals from "@/pages/member/Referrals";
import Index from "./pages/Index";
import Classes from "./pages/Classes";
import Schedule from "./pages/Schedule";
import PublicClassTypeDetail from "./pages/ClassTypeDetail";
import Spa from "./pages/Spa";
import SpaRedLightTherapy from "./pages/spa/RedLightTherapy";
import SpaCryotherapy from "./pages/spa/Cryotherapy";
import SpaInfraredSauna from "./pages/spa/InfraredSauna";
import SpaColdPlunge from "./pages/spa/ColdPlunge";
import SpaSaunaSteam from "./pages/spa/SaunaSteam";
import SpaSaltRoom from "./pages/spa/SaltRoom";
import SpaZerobody from "./pages/spa/Zerobody";
import SpaCategoryHub from "./pages/spa/SpaCategoryHub";
import SpaServicePage from "./pages/spa/SpaServicePage";
import GutReset from "./pages/GutReset";
import GutResetSuccess from "./pages/GutResetSuccess";
import GutResetAdmin from "./pages/admin/GutResetAdmin";
import MothersDay from "./pages/MothersDay";
import MothersDayRedeem from "./pages/MothersDayRedeem";
import MothersDayPackRedeem from "./pages/MothersDayPackRedeem";
import Cafe from "./pages/Cafe";
import MemberCafe from "./pages/member/Cafe";
import PortalCafe from "./pages/portal/Cafe";
import Amenities from "./pages/Amenities";
import KidsCare from "./pages/KidsCare";
import Reviews from "./pages/Reviews";
import ClassPasses from "./pages/ClassPasses";
import Memberships from "./pages/Memberships";
import Apply from "./pages/Apply";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";

import MyBookings from "./pages/MyBookings";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import SmsOptInProof from "./pages/SmsOptInProof";
import CardAdded from "./pages/CardAdded";

import FAQ from "./pages/FAQ";
import GuestPass from "./pages/GuestPass";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";
import RecoveryGuide from "./pages/RecoveryGuide";
import MilestoneMockup from "./pages/mockup/MilestoneMockup";
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
import FailedPaymentsHistory from "./pages/admin/FailedPaymentsHistory";
import BillingEmailLog from "./pages/admin/BillingEmailLog";
import BillingArrears from "./pages/admin/BillingArrears";
import MembershipHealth from "./pages/admin/MembershipHealth";
import RevenueAnalytics from "./pages/admin/RevenueAnalytics";
import Settings from "./pages/admin/Settings";
import GuestPasses from "./pages/admin/GuestPasses";
import GuestManagement from "./pages/admin/GuestManagement";
import CafePOS from "./pages/admin/CafePOS";
import CafeMenuManager from "./pages/admin/CafeMenuManager";
import CafeImageReview from "./pages/admin/CafeImageReview";

import Childcare from "./pages/admin/Childcare";
import AdminClasses from "./pages/admin/Classes";
import ClassStudio from "./pages/admin/ClassStudio";
import StaffRoles from "./pages/admin/StaffRoles";
import StaffDetail from "./pages/admin/StaffDetail";
import StaffPins from "./pages/admin/StaffPins";
import ClassTypes from "./pages/admin/ClassTypes";
import ClassTypeDetail from "./pages/admin/ClassTypeDetail";
import Instructors from "./pages/admin/Instructors";
import ClassSchedules from "./pages/admin/ClassSchedules";
import ClassPassPricing from "./pages/admin/ClassPassPricing";
import EmailManagement from "./pages/admin/EmailManagement";
import FreezeRequests from "./pages/admin/FreezeRequests";
import Equipment from "./pages/admin/Equipment";
import Agreements from "./pages/admin/Agreements";
import SignatureCertificates from "./pages/admin/SignatureCertificates";
import Reports from "./pages/admin/Reports";
import FrontDeskPOS from "./pages/admin/FrontDeskPOS";
import ClassRoster from "./pages/admin/ClassRoster";
import Marketing from "./pages/admin/Marketing";
import EventVoteTracking from "./pages/admin/EventVoteTracking";
import EventsHub from "./pages/admin/EventsHub";
import EventDetail from "./pages/admin/EventDetail";
import EventPage from "./pages/EventPage";
import EventsIndex from "./pages/EventsIndex";
import EventSuccess from "./pages/EventSuccess";
import NonMemberAccounts from "./pages/admin/NonMemberAccounts";
import NonMemberDetail from "./pages/admin/NonMemberDetail";
import People from "./pages/admin/People";
import BlockedPersons from "./pages/admin/BlockedPersons";
import PaymentFailedEmailPreview from "./pages/admin/PaymentFailedEmailPreview";
import CardDeclinedEmailPreview from "./pages/admin/CardDeclinedEmailPreview";
import EmailTemplatesIndex from "./pages/admin/EmailTemplatesIndex";
import StaffHub from "./pages/admin/StaffHub";
import StaffSchedule from "./pages/admin/StaffSchedule";
import MerchManager from "./pages/admin/MerchManager";
import SpaManagement from "./pages/admin/SpaManagement";
import MothersDayAdmin from "./pages/admin/MothersDayAdmin";
import MothersDayClassPacks from "./pages/admin/MothersDayClassPacks";
import AbandonedClassPassCheckouts from "./pages/admin/AbandonedClassPassCheckouts";
import Merch from "./pages/Merch";
import StormShop from "./pages/StormShop";
import DesignSystem from "./pages/DesignSystem";
import SiteAudit from "./pages/SiteAudit";
import GuestFeedback from "./pages/GuestFeedback";
import SpaReview from "./pages/SpaReview";
import FrontDeskKiosk from "./pages/FrontDesk";
import FrontDeskReception from "./pages/frontdesk/Reception";
import FrontDeskPOSPage from "./pages/frontdesk/POS";
import FrontDeskSchedule from "./pages/frontdesk/Schedule";
import FrontDeskShiftPage from "./pages/frontdesk/Shift";
import FrontDeskMembersPage from "./pages/frontdesk/Members";
import FrontDeskNonMembersPage from "./pages/frontdesk/NonMembers";
import FrontDeskGuestPassesPage from "./pages/frontdesk/GuestPassesPage";
import FrontDeskSpaPage from "./pages/frontdesk/Spa";
import FrontDeskCafePage from "./pages/frontdesk/Cafe";
import FrontDeskClassRosterPage from "./pages/frontdesk/ClassRoster";
import FrontDeskMessagesPage from "./pages/frontdesk/Messages";
import FrontDeskEventsPage from "./pages/frontdesk/Events";
import { ProtectedFrontDeskRoute } from "./components/frontdesk/ProtectedFrontDeskRoute";
import { ProtectedInstructorRoute } from "./components/instructor/ProtectedInstructorRoute";
import InstructorToday from "./pages/instructor/Today";
import {
  InstructorSchedule,
  InstructorRosters,
  InstructorAvailability,
  InstructorTimeOff,
  InstructorSubs,
  InstructorNotes,
  InstructorPay,
  InstructorMessages,
  InstructorDocuments,
} from "./pages/instructor/Stubs";
import InstructorLogin from "./pages/InstructorLogin";
import KioskReception from "./pages/kiosk/Reception";
import KioskCafe from "./pages/kiosk/Cafe";
import KioskSpa from "./pages/kiosk/Spa";
import KioskClasses from "./pages/kiosk/Classes";
import { SitemapRedirect, RobotsRedirect } from "@/components/StaticFileRedirect";
import { ProtectedPortalRoute } from "@/components/portal/ProtectedPortalRoute";
import PortalDashboard from "@/pages/portal/Dashboard";
import PortalBook from "@/pages/portal/Book";
import PortalBookClass from "@/pages/portal/BookClass";
import PortalBookings from "@/pages/portal/Bookings";
import PortalPasses from "@/pages/portal/Passes";
import PortalPaymentMethods from "@/pages/portal/PaymentMethods";
import PortalPaymentHistory from "@/pages/portal/PaymentHistory";
import PortalProfile from "@/pages/portal/Profile";
import PortalSupport from "@/pages/portal/Support";
import PortalRecovery from "@/pages/portal/Recovery";
import PortalMyEventTickets from "@/pages/portal/MyEventTickets";
import PortalGiftCards from "@/pages/portal/GiftCards";
import GiftCardStore from "@/pages/GiftCardStore";
import AdminGiftCardHub from "@/pages/admin/GiftCardHub";

import PTPortalDashboard from "@/pages/admin/pt/PTDashboard";
import PTPortalSchedule from "@/pages/admin/pt/PTSchedule";
import PTPortalClients from "@/pages/admin/pt/PTClients";
import PTPortalClientDetail from "@/pages/admin/pt/PTClientDetail";
import PTPortalPrograms from "@/pages/admin/pt/PTPrograms";
import PTPortalLibrary from "@/pages/admin/pt/PTLibrary";
import PTPortalReassessments from "@/pages/admin/pt/PTReassessments";
import PTPortalSessionNotes from "@/pages/admin/pt/PTSessionNotes";
import PTPortalProgress from "@/pages/admin/pt/PTProgress";
import PTPortalPackages from "@/pages/admin/pt/PTPackages";
import PTPortalBilling from "@/pages/admin/pt/PTBilling";
import PTPortalTrainers from "@/pages/admin/pt/PTTrainers";
import PTPortalTasks from "@/pages/admin/pt/PTTasks";
import PTPortalMessages from "@/pages/admin/pt/PTMessages";
import PTPortalReports from "@/pages/admin/pt/PTReports";
import PTPortalSettings from "@/pages/admin/pt/PTSettings";
import PTMToday from "@/pages/admin/pt/mobile/PTMToday";
import PTMClients from "@/pages/admin/pt/mobile/PTMClients";
import PTMClientProfile from "@/pages/admin/pt/mobile/PTMClientProfile";
import PTMProgress from "@/pages/admin/pt/mobile/PTMProgress";
import PTMMore from "@/pages/admin/pt/mobile/PTMMore";
import PTMNextSession from "@/pages/admin/pt/mobile/PTMNextSession";
import PTMActionList from "@/pages/admin/pt/mobile/PTMActionList";
import PTMPreSession from "@/pages/admin/pt/mobile/PTMPreSession";
import PTMPostSession from "@/pages/admin/pt/mobile/PTMPostSession";
import PTMLiveSession from "@/pages/admin/pt/mobile/PTMLiveSession";
import PersonalTrainingOverview from "@/pages/personal-training/Overview";
import PTOneOnOne from "@/pages/personal-training/OneOnOne";
import PTPrivatePilates from "@/pages/personal-training/PrivatePilates";

import PTSemiPrivate from "@/pages/personal-training/SemiPrivate";
import AdminTrainingRequests from "@/pages/admin/TrainingRequests";
import AdminPersonalTrainingPacks from "@/pages/admin/PersonalTrainingPacks";
import AdminPersonalTrainingPasses from "@/pages/admin/PersonalTrainingPasses";
import AdminPersonalTrainingSchedule from "@/pages/admin/PersonalTrainingSchedule";
import AdminPersonalTrainingTrainers from "@/pages/admin/PersonalTrainingTrainers";
import AdminPersonalTrainingUnpaid from "@/pages/admin/PersonalTrainingUnpaid";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Returning to a tab/window must not re-run every active query, which
      // was wiping in-progress screens (e.g. long report generation).
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <HelmetProvider>
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
              {/* Static file redirects for crawlers */}
              <Route path="/sitemap.xml" element={<SitemapRedirect />} />
              <Route path="/robots.txt" element={<RobotsRedirect />} />
              
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/mockup/milestones" element={<MilestoneMockup />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/classes/:classTypeId" element={<PublicClassTypeDetail />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/book" element={<Schedule />} />
              <Route path="/spa" element={<Spa />} />
              {/* Recovery standalone modality pages */}
              <Route path="/spa/red-light-therapy" element={<SpaRedLightTherapy />} />
              <Route path="/spa/cryotherapy" element={<SpaCryotherapy />} />
              <Route path="/spa/infrared-sauna" element={<SpaInfraredSauna />} />
              <Route path="/spa/cold-plunge" element={<SpaColdPlunge />} />
              <Route path="/spa/sauna-steam" element={<SpaSaunaSteam />} />
              <Route path="/spa/salt-room" element={<SpaSaltRoom />} />
              <Route path="/spa/zerobody" element={<SpaZerobody />} />
              {/* Category hubs */}
              <Route path="/spa/massage" element={<SpaCategoryHub category="massage" />} />
              <Route path="/spa/facials" element={<SpaCategoryHub category="facials" />} />
              <Route path="/spa/body-wraps" element={<SpaCategoryHub category="body-wraps" />} />
              <Route path="/spa/body-rituals" element={<SpaCategoryHub category="body-rituals" />} />
              <Route path="/spa/recovery" element={<SpaCategoryHub category="recovery" />} />
              {/* Individual service pages */}
              <Route path="/spa/massage/:slug" element={<SpaServicePage category="massage" />} />
              <Route path="/spa/facials/:slug" element={<SpaServicePage category="facials" />} />
              <Route path="/spa/body-wraps/:slug" element={<SpaServicePage category="body-wraps" />} />
              <Route path="/spa/body-rituals/:slug" element={<SpaServicePage category="body-rituals" />} />
              <Route path="/spa/recovery/:slug" element={<SpaServicePage category="recovery" />} />
              <Route path="/mothers-day" element={<MothersDay />} />
              <Route path="/mothers-day/success" element={<MothersDay />} />
              <Route path="/mothers-day/redeem" element={<MothersDayRedeem />} />
              <Route path="/mothers-day-pack-redeem" element={<MothersDayPackRedeem />} />
              <Route path="/gut-reset" element={<GutReset />} />
              <Route path="/gut-reset/success" element={<GutResetSuccess />} />
              <Route path="/cafe" element={<Cafe />} />
              <Route path="/gift-cards" element={<GiftCardStore />} />
              <Route path="/amenities" element={<Amenities />} />
              <Route path="/recovery-guide" element={<RecoveryGuide />} />
              <Route path="/kids-care" element={<KidsCare />} />
              <Route path="/personal-training" element={<PersonalTrainingOverview />} />
              <Route path="/personal-training/one-on-one" element={<PTOneOnOne />} />
              <Route path="/personal-training/private-pilates" element={<PTPrivatePilates />} />
              
              <Route path="/personal-training/semi-private" element={<PTSemiPrivate />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/class-passes" element={<ClassPasses />} />
              <Route path="/memberships" element={<Memberships />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/sms-terms" element={<Navigate to="/terms#sms" replace />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/sms-opt-in-proof" element={<SmsOptInProof />} />
              <Route path="/card-added" element={<CardAdded />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/guest-pass" element={<GuestPass />} />
              <Route path="/guest-feedback" element={<GuestFeedback />} />
              <Route path="/review/spa/:token" element={<SpaReview />} />
              <Route path="/design-system" element={<DesignSystem />} />
              <Route path="/site-audit" element={<SiteAudit />} />
              <Route path="/merch" element={<StormShop />} />
              <Route path="/shop" element={<StormShop />} />

              <Route path="/front-desk" element={<Navigate to="/frontdesk" replace />} />
              <Route path="/front-desk-login" element={<Navigate to="/auth" replace />} />
              <Route path="/kiosk" element={<KioskReception />} />
              <Route path="/kiosk/reception" element={<KioskReception />} />
              <Route path="/kiosk/cafe" element={<KioskCafe />} />
              <Route path="/kiosk/spa" element={<KioskSpa />} />
              <Route path="/kiosk/classes" element={<KioskClasses />} />

              {/* Front Desk staff dashboard — walled off from /admin */}
              <Route path="/frontdesk" element={<ProtectedFrontDeskRoute><FrontDeskReception /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/pos" element={<ProtectedFrontDeskRoute><FrontDeskPOSPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/schedule" element={<ProtectedFrontDeskRoute><FrontDeskSchedule /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/shift" element={<ProtectedFrontDeskRoute><FrontDeskShiftPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/members" element={<ProtectedFrontDeskRoute><FrontDeskMembersPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/non-members" element={<ProtectedFrontDeskRoute><FrontDeskNonMembersPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/guest-passes" element={<ProtectedFrontDeskRoute><FrontDeskGuestPassesPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/spa" element={<ProtectedFrontDeskRoute><FrontDeskSpaPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/cafe" element={<ProtectedFrontDeskRoute><FrontDeskCafePage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/class-roster/:sessionId" element={<ProtectedFrontDeskRoute><FrontDeskClassRosterPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/messages" element={<ProtectedFrontDeskRoute><FrontDeskMessagesPage /></ProtectedFrontDeskRoute>} />
              <Route path="/frontdesk/events" element={<ProtectedFrontDeskRoute><FrontDeskEventsPage /></ProtectedFrontDeskRoute>} />

              {/* Instructor Portal */}
              <Route path="/instructor-login" element={<InstructorLogin />} />
              <Route path="/instructor" element={<ProtectedInstructorRoute><InstructorToday /></ProtectedInstructorRoute>} />
              <Route path="/instructor/schedule" element={<ProtectedInstructorRoute><InstructorSchedule /></ProtectedInstructorRoute>} />
              <Route path="/instructor/rosters" element={<ProtectedInstructorRoute><InstructorRosters /></ProtectedInstructorRoute>} />
              <Route path="/instructor/availability" element={<ProtectedInstructorRoute><InstructorAvailability /></ProtectedInstructorRoute>} />
              <Route path="/instructor/time-off" element={<ProtectedInstructorRoute><InstructorTimeOff /></ProtectedInstructorRoute>} />
              <Route path="/instructor/subs" element={<ProtectedInstructorRoute><InstructorSubs /></ProtectedInstructorRoute>} />
              <Route path="/instructor/notes" element={<ProtectedInstructorRoute><InstructorNotes /></ProtectedInstructorRoute>} />
              <Route path="/instructor/pay" element={<ProtectedInstructorRoute><InstructorPay /></ProtectedInstructorRoute>} />
              <Route path="/instructor/messages" element={<ProtectedInstructorRoute><InstructorMessages /></ProtectedInstructorRoute>} />
              <Route path="/instructor/documents" element={<ProtectedInstructorRoute><InstructorDocuments /></ProtectedInstructorRoute>} />


              
              
              {/* Member Portal Routes - Protected */}
              <Route path="/member" element={<ProtectedMemberRoute><MemberDashboard /></ProtectedMemberRoute>} />
              <Route path="/member/book" element={<ProtectedMemberRoute><MemberBook /></ProtectedMemberRoute>} />
              <Route path="/member/book/class" element={<ProtectedMemberRoute><MemberBookClass /></ProtectedMemberRoute>} />
              <Route path="/member/profile" element={<ProtectedMemberRoute><MemberProfile /></ProtectedMemberRoute>} />
              <Route path="/member/credits" element={<ProtectedMemberRoute><MemberCredits /></ProtectedMemberRoute>} />
              <Route path="/member/membership" element={<ProtectedMemberRoute><MemberMembership /></ProtectedMemberRoute>} />
              <Route path="/member/payment-methods" element={<ProtectedMemberRoute><MemberPaymentMethods /></ProtectedMemberRoute>} />
              <Route path="/member/payment-history" element={<ProtectedMemberRoute><PaymentHistory /></ProtectedMemberRoute>} />
              <Route path="/member/entry" element={<ProtectedMemberRoute><MemberEntry /></ProtectedMemberRoute>} />
              <Route path="/member/bookings" element={<ProtectedMemberRoute><MemberBookings /></ProtectedMemberRoute>} />
              <Route path="/member/waivers" element={<ProtectedMemberRoute><MemberWaivers /></ProtectedMemberRoute>} />
              <Route path="/member/kids-care" element={<ProtectedMemberRoute><MemberKidsCare /></ProtectedMemberRoute>} />
              <Route path="/member/kids-care-service-form" element={<ProtectedMemberRoute><KidsCareServiceForm /></ProtectedMemberRoute>} />
              <Route path="/member/kids-care-bookings" element={<ProtectedMemberRoute><KidsCareBookings /></ProtectedMemberRoute>} />
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
              
              <Route path="/member/referrals" element={<ProtectedMemberRoute><MemberReferrals /></ProtectedMemberRoute>} />
              <Route path="/member/cafe" element={<ProtectedMemberRoute><MemberCafe /></ProtectedMemberRoute>} />
              <Route path="/member/tickets" element={<ProtectedMemberRoute><PortalMyEventTickets /></ProtectedMemberRoute>} />
              
              {/* Portal Routes - Non-Member Class Portal */}
              <Route path="/portal" element={<ProtectedPortalRoute><PortalDashboard /></ProtectedPortalRoute>} />
              <Route path="/portal/book" element={<ProtectedPortalRoute><PortalBook /></ProtectedPortalRoute>} />
              <Route path="/portal/book/class" element={<ProtectedPortalRoute><PortalBookClass /></ProtectedPortalRoute>} />
              <Route path="/portal/bookings" element={<ProtectedPortalRoute><PortalBookings /></ProtectedPortalRoute>} />
              <Route path="/portal/passes" element={<ProtectedPortalRoute><PortalPasses /></ProtectedPortalRoute>} />
              <Route path="/portal/payment-methods" element={<ProtectedPortalRoute><PortalPaymentMethods /></ProtectedPortalRoute>} />
              <Route path="/portal/payment-history" element={<ProtectedPortalRoute><PortalPaymentHistory /></ProtectedPortalRoute>} />
              <Route path="/portal/profile" element={<ProtectedPortalRoute><PortalProfile /></ProtectedPortalRoute>} />
              <Route path="/portal/support" element={<ProtectedPortalRoute><PortalSupport /></ProtectedPortalRoute>} />
              <Route path="/portal/wellness" element={<ProtectedPortalRoute><PortalRecovery /></ProtectedPortalRoute>} />
              <Route path="/portal/cafe" element={<ProtectedPortalRoute><PortalCafe /></ProtectedPortalRoute>} />
              <Route path="/portal/my-tickets" element={<ProtectedPortalRoute><PortalMyEventTickets /></ProtectedPortalRoute>} />
              <Route path="/portal/gift-cards" element={<ProtectedPortalRoute><PortalGiftCards /></ProtectedPortalRoute>} />

              
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
              <Route path="/admin/payments/failed-history" element={<ProtectedAdminRoute><FailedPaymentsHistory /></ProtectedAdminRoute>} />
              <Route path="/admin/billing-emails" element={<ProtectedAdminRoute><BillingEmailLog /></ProtectedAdminRoute>} />
              <Route path="/admin/billing-arrears" element={<ProtectedAdminRoute><BillingArrears /></ProtectedAdminRoute>} />
              <Route path="/admin/membership-health" element={<ProtectedAdminRoute><MembershipHealth /></ProtectedAdminRoute>} />
              <Route path="/admin/revenue-analytics" element={<ProtectedAdminRoute><RevenueAnalytics /></ProtectedAdminRoute>} />
              <Route path="/admin/guest-passes" element={<ProtectedAdminRoute><GuestPasses /></ProtectedAdminRoute>} />
              <Route path="/admin/guests" element={<ProtectedAdminRoute><GuestManagement /></ProtectedAdminRoute>} />
              <Route path="/admin/cafe" element={<ProtectedAdminRoute><CafePOS /></ProtectedAdminRoute>} />
              <Route path="/admin/cafe-menu" element={<ProtectedAdminRoute><CafeMenuManager /></ProtectedAdminRoute>} />
              <Route path="/admin/cafe-image-review" element={<ProtectedAdminRoute><CafeImageReview /></ProtectedAdminRoute>} />
              
              <Route path="/admin/childcare" element={<ProtectedAdminRoute><Childcare /></ProtectedAdminRoute>} />
              <Route path="/admin/class-studio" element={<ProtectedAdminRoute><ClassStudio /></ProtectedAdminRoute>} />
              <Route path="/admin/classes" element={<ProtectedAdminRoute><AdminClasses /></ProtectedAdminRoute>} />
              <Route path="/admin/class-types" element={<ProtectedAdminRoute><ClassTypes /></ProtectedAdminRoute>} />
              <Route path="/admin/class-types/:id" element={<ProtectedAdminRoute><ClassTypeDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/instructors" element={<ProtectedAdminRoute><Instructors /></ProtectedAdminRoute>} />
              <Route path="/admin/class-schedules" element={<ProtectedAdminRoute><ClassSchedules /></ProtectedAdminRoute>} />
              <Route path="/admin/class-pass-pricing" element={<ProtectedAdminRoute><ClassPassPricing /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-roles" element={<ProtectedAdminRoute><StaffRoles /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-roles/:userId" element={<ProtectedAdminRoute><StaffDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-pins" element={<ProtectedAdminRoute><StaffPins /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-schedule" element={<ProtectedAdminRoute><StaffSchedule /></ProtectedAdminRoute>} />
              <Route path="/admin/settings" element={<ProtectedAdminRoute><Settings /></ProtectedAdminRoute>} />
              <Route path="/admin/emails" element={<ProtectedAdminRoute><EmailManagement /></ProtectedAdminRoute>} />
              <Route path="/admin/freeze-requests" element={<ProtectedAdminRoute><FreezeRequests /></ProtectedAdminRoute>} />
              <Route path="/admin/equipment" element={<ProtectedAdminRoute><Equipment /></ProtectedAdminRoute>} />
              <Route path="/admin/agreements" element={<ProtectedAdminRoute><Agreements /></ProtectedAdminRoute>} />
              <Route path="/admin/signature-certificates" element={<ProtectedAdminRoute><SignatureCertificates /></ProtectedAdminRoute>} />
              <Route path="/admin/reports" element={<ProtectedAdminRoute><Reports /></ProtectedAdminRoute>} />
              <Route path="/admin/front-desk" element={<ProtectedAdminRoute><FrontDeskPOS /></ProtectedAdminRoute>} />
              <Route path="/admin/class-roster/:sessionId" element={<ProtectedAdminRoute><ClassRoster /></ProtectedAdminRoute>} />
              <Route path="/admin/marketing" element={<ProtectedAdminRoute><Marketing /></ProtectedAdminRoute>} />
              <Route path="/admin/events" element={<ProtectedAdminRoute><EventsHub /></ProtectedAdminRoute>} />
              <Route path="/admin/events/:slug" element={<ProtectedAdminRoute><EventDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/event-votes" element={<ProtectedAdminRoute><EventVoteTracking /></ProtectedAdminRoute>} />
              <Route path="/admin/event-votes/:slug" element={<ProtectedAdminRoute><EventVoteTracking /></ProtectedAdminRoute>} />
              <Route path="/events/:slug" element={<EventPage />} />
              <Route path="/events" element={<EventsIndex />} />
              <Route path="/events/:slug/success" element={<EventSuccess />} />
              <Route path="/admin/non-member-accounts" element={<ProtectedAdminRoute><NonMemberAccounts /></ProtectedAdminRoute>} />
              <Route path="/admin/non-member-accounts/:userId" element={<ProtectedAdminRoute><NonMemberDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/people" element={<ProtectedAdminRoute><People /></ProtectedAdminRoute>} />
              <Route path="/admin/blocked" element={<ProtectedAdminRoute><BlockedPersons /></ProtectedAdminRoute>} />
              <Route path="/admin/email-templates" element={<ProtectedAdminRoute><EmailTemplatesIndex /></ProtectedAdminRoute>} />
              <Route path="/admin/email-templates/payment-failed" element={<ProtectedAdminRoute><PaymentFailedEmailPreview /></ProtectedAdminRoute>} />
              <Route path="/admin/email-templates/card-declined" element={<ProtectedAdminRoute><CardDeclinedEmailPreview /></ProtectedAdminRoute>} />
              <Route path="/admin/merch" element={<ProtectedAdminRoute><MerchManager /></ProtectedAdminRoute>} />
              <Route path="/admin/staff-hub" element={<ProtectedAdminRoute><StaffHub /></ProtectedAdminRoute>} />
              <Route path="/admin/spa-management" element={<ProtectedAdminRoute><SpaManagement /></ProtectedAdminRoute>} />
              <Route path="/admin/gut-reset" element={<ProtectedAdminRoute><GutResetAdmin /></ProtectedAdminRoute>} />
              <Route path="/admin/mothers-day" element={<ProtectedAdminRoute><MothersDayAdmin /></ProtectedAdminRoute>} />
              <Route path="/admin/gift-cards" element={<ProtectedAdminRoute><AdminGiftCardHub /></ProtectedAdminRoute>} />
              <Route path="/admin/mothers-day-class-packs" element={<ProtectedAdminRoute><MothersDayClassPacks /></ProtectedAdminRoute>} />
              <Route path="/admin/abandoned-class-pass-checkouts" element={<ProtectedAdminRoute><AbandonedClassPassCheckouts /></ProtectedAdminRoute>} />
              <Route path="/admin/training-requests" element={<ProtectedAdminRoute><AdminTrainingRequests /></ProtectedAdminRoute>} />
              <Route path="/admin/personal-training/packs" element={<ProtectedAdminRoute><AdminPersonalTrainingPacks /></ProtectedAdminRoute>} />
              <Route path="/admin/personal-training/passes" element={<ProtectedAdminRoute><AdminPersonalTrainingPasses /></ProtectedAdminRoute>} />
              <Route path="/admin/personal-training/schedule" element={<ProtectedAdminRoute><AdminPersonalTrainingSchedule /></ProtectedAdminRoute>} />
              <Route path="/admin/personal-training/trainers" element={<ProtectedAdminRoute><AdminPersonalTrainingTrainers /></ProtectedAdminRoute>} />
              <Route path="/admin/personal-training/payments" element={<ProtectedAdminRoute><AdminPersonalTrainingUnpaid /></ProtectedAdminRoute>} />
              <Route path="/admin/pt" element={<ProtectedAdminRoute><PTPortalDashboard /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m" element={<ProtectedAdminRoute><PTMToday /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/today" element={<ProtectedAdminRoute><PTMToday /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/list/:listKey" element={<ProtectedAdminRoute><PTMActionList /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/clients" element={<ProtectedAdminRoute><PTMClients /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/clients/:userId" element={<ProtectedAdminRoute><PTMClientProfile /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/progress" element={<ProtectedAdminRoute><PTMProgress /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/more" element={<ProtectedAdminRoute><PTMMore /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/next" element={<ProtectedAdminRoute><PTMNextSession /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/session/:appointmentId" element={<ProtectedAdminRoute><PTMNextSession /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/session/:appointmentId/live" element={<ProtectedAdminRoute><PTMLiveSession /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/session/:appointmentId/post" element={<ProtectedAdminRoute><PTMPostSession /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/m/session/:appointmentId/pre" element={<ProtectedAdminRoute><PTMPreSession /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/schedule" element={<ProtectedAdminRoute><PTPortalSchedule /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/clients" element={<ProtectedAdminRoute><PTPortalClients /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/clients/:userId" element={<ProtectedAdminRoute><PTPortalClientDetail /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/programs" element={<ProtectedAdminRoute><PTPortalPrograms /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/library" element={<ProtectedAdminRoute><PTPortalLibrary /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/reassessments" element={<ProtectedAdminRoute><PTPortalReassessments /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/session-notes" element={<ProtectedAdminRoute><PTPortalSessionNotes /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/progress" element={<ProtectedAdminRoute><PTPortalProgress /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/packages" element={<ProtectedAdminRoute><PTPortalPackages /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/billing" element={<ProtectedAdminRoute><PTPortalBilling /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/trainers" element={<ProtectedAdminRoute><PTPortalTrainers /></ProtectedAdminRoute>} />

              <Route path="/admin/pt/tasks" element={<ProtectedAdminRoute><PTPortalTasks /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/messages" element={<ProtectedAdminRoute><PTPortalMessages /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/reports" element={<ProtectedAdminRoute><PTPortalReports /></ProtectedAdminRoute>} />
              <Route path="/admin/pt/settings" element={<ProtectedAdminRoute><PTPortalSettings /></ProtectedAdminRoute>} />
              
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
