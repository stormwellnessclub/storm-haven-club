import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyMembership from "./tools/get-my-membership";
import listMyClassBookings from "./tools/list-my-class-bookings";
import listUpcomingClasses from "./tools/list-upcoming-classes";
import listMyCredits from "./tools/list-my-credits";
import listMySpaAppointments from "./tools/list-my-spa-appointments";
import listSpaServices from "./tools/list-spa-services";

// Issuer must be the direct Supabase host, built from the project ref literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "storm-wellness-hub",
  title: "Storm Wellness Hub",
  version: "0.1.0",
  instructions:
    "Tools for Storm Wellness Club members. Read the signed-in member's membership status, credits, class bookings and spa appointments, plus the upcoming class schedule and spa service menu. All times are America/Detroit (Michigan Eastern). Class booking opens 4 weeks out.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyMembership,
    listMyCredits,
    listMyClassBookings,
    listUpcomingClasses,
    listMySpaAppointments,
    listSpaServices,
  ],
});
