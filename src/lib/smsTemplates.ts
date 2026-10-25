/**
 * SMS Template Registry — single source of truth for the admin viewer.
 *
 * IMPORTANT: This must mirror TEMPLATES in `supabase/functions/send-sms/index.ts`.
 * When you change a template body in the edge function, update it here too so
 * the admin "SMS Templates" tab shows what's actually being sent.
 *
 * The registry is read-only by design: SMS bodies are code-controlled for
 * deliverability and A2P 10DLC compliance.
 */

export interface SmsTemplate {
  key: string;
  label: string;
  category: "Classes" | "Spa" | "Kids Care" | "Cafe" | "Billing" | "Admin" | "System";
  body: string;
  triggers: string;
  sampleVariables: Record<string, string>;
  audience: "members" | "non_members" | "both";
}

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    key: "cafe-order-ready",
    label: "Café order ready",
    category: "Cafe",
    body: "Storm Cafe at Storm Wellness Club: {{name}}, your café order is ready for pickup.",
    triggers: "Sent once when staff mark a café order Ready or Completed (opted-in customers only).",
    sampleVariables: { name: "Jane" },
    audience: "both",
  },
  {
    key: "cafe-order-delay",
    label: "Café order running late",
    category: "Cafe",
    body: "Storm Wellness Club: {{name}}, your order needs a few more minutes. New ready time: {{time}}.",
    triggers: "Optional, once per order, when staff push back the ready time and choose to notify.",
    sampleVariables: { name: "Jane", time: "3:45 PM" },
    audience: "both",
  },
  {
    key: "class-booking-confirmation",
    label: "Class booking confirmation",
    category: "Classes",
    body: "Storm Wellness Club: You're booked for {{className}} on {{date}} at {{time}}. See you soon!",
    triggers: "Sent immediately when a member or non-member books a class.",
    sampleVariables: { className: "Reformer Pilates", date: "Mon Jun 9", time: "9:00 AM" },
    audience: "both",
  },
  {
    key: "class-booking-cancellation",
    label: "Class booking cancellation",
    category: "Classes",
    body: "Storm Wellness Club: Your {{className}} on {{date}} at {{time}} was cancelled.{{refundNote}}",
    triggers: "Sent when a member cancels their own class booking.",
    sampleVariables: {
      className: "Cycling 45",
      date: "Mon Jun 9",
      time: "6:00 AM",
      refundNote: " Credit refunded.",
    },
    audience: "both",
  },
  {
    key: "class-reminder-24h",
    label: "Class reminder — 24 hours before",
    category: "Classes",
    body: "Storm Wellness Club: Reminder — {{className}} tomorrow at {{time}}. Reply STOP to opt out.",
    triggers: "Cron: sent ~24 hours before a confirmed class booking.",
    sampleVariables: { className: "Reformer Pilates", time: "9:00 AM" },
    audience: "both",
  },
  {
    key: "class-reminder-2h",
    label: "Class reminder — 2 hours before",
    category: "Classes",
    body: "Storm Wellness Club: {{className}} starts in 2 hrs at {{time}}. See you soon!",
    triggers: "Cron: sent ~2 hours before a confirmed class booking.",
    sampleVariables: { className: "Cycling 45", time: "5:30 PM" },
    audience: "both",
  },
  {
    key: "class-cancelled",
    label: "Class cancelled by club",
    category: "Classes",
    body: "Storm Wellness Club: Your {{className}} on {{date}} at {{time}} has been cancelled by the studio.{{creditNote}}",
    triggers: "Sent when staff cancel a class or remove someone from it. Credit line only when a credit or pass was returned.",
    sampleVariables: { className: "Reformer Pilates", date: "Tue Jun 10", time: "8:00 AM", creditNote: " Your credit was returned." },
    audience: "both",
  },
  {
    key: "spa-appointment-cancellation",
    label: "Spa appointment cancelled",
    category: "Spa",
    body: "Storm Wellness Club: Your {{service}} appointment on {{date}} at {{time}} has been cancelled.",
    triggers: "Sent with the spa cancellation email.",
    sampleVariables: { service: "Storm Signature Massage", date: "Tue Jun 10", time: "11:00 AM" },
    audience: "both",
  },
  {
    key: "pt-session-cancelled",
    label: "Personal Training session cancelled",
    category: "Personal Training",
    body: "Storm Wellness Club: Your Personal Training session on {{date}} at {{time}} has been cancelled.{{sessionNote}}",
    triggers: "Sent with the PT cancellation email.",
    sampleVariables: { date: "Tue Jun 10", time: "7:00 AM", sessionNote: " The session was returned to your pack." },
    audience: "both",
  },
  {
    key: "waitlist-joined",
    label: "Waitlist — you're on the list",
    category: "Classes",
    body: "Storm Wellness Club: You're on the waitlist for {{className}} on {{date}} at {{time}}. We'll text if a spot opens.",
    triggers: "Sent when a member or non-member joins a class waitlist.",
    sampleVariables: { className: "Reformer Pilates", date: "Mon Jun 9", time: "9:00 AM" },
    audience: "both",
  },
  {
    key: "waitlist-promoted",
    label: "Waitlist — spot opened",
    category: "Classes",
    body: "Storm Wellness Club: A spot opened for {{className}} on {{date}} at {{time}}. You're booked.",
    triggers: "Sent when a class spot opens and the next waitlisted person is auto-booked.",
    sampleVariables: { className: "Cycling 45", date: "Wed Jun 11", time: "6:00 AM" },
    audience: "both",
  },
  {
    key: "guest-pass-invite",
    label: "Guest pass invitation",
    category: "Admin",
    audience: "non_members",
    body: "Storm Wellness Club: {{memberName}} invited you as their guest on {{date}}. 18340 Middlebelt Rd, Livonia. Check in at the front desk. Details in your email.",
    triggers: "Sent to the guest when a member registers them with a complimentary guest pass (only if that phone has agreed to texts).",
    sampleVariables: { memberName: "Sarah", date: "Oct 24" },
  },
  {
    key: "appointment-confirmation",
    label: "Spa appointment confirmation",
    category: "Spa",
    body: "Storm Wellness Club: {{service}} confirmed for {{date}} at {{time}} with {{provider}}.",
    triggers: "Sent immediately when a spa appointment is booked.",
    sampleVariables: {
      service: "60-min Swedish Massage",
      date: "Fri Jun 13",
      time: "2:00 PM",
      provider: "Sarah",
    },
    audience: "both",
  },
  {
    key: "appointment-reminder-24h",
    label: "Spa appointment reminder — 24 hours",
    category: "Spa",
    body: "Storm Wellness Club: Reminder — {{service}} tomorrow at {{time}} with {{provider}}.",
    triggers: "Cron: sent ~24 hours before a confirmed spa appointment.",
    sampleVariables: {
      service: "Red Light Therapy",
      time: "10:30 AM",
      provider: "Storm Wellness",
    },
    audience: "both",
  },
  {
    key: "appointment-reminder-2h",
    label: "Spa appointment reminder — 2 hours",
    category: "Spa",
    body: "Storm Wellness Club: {{service}} in 2 hrs at {{time}}. See you soon!",
    triggers: "Cron: sent ~2 hours before a confirmed spa appointment.",
    sampleVariables: { service: "Dry Cryo Session", time: "3:00 PM" },
    audience: "both",
  },
  {
    key: "kids-care-confirmation",
    label: "Kids Care booking confirmation",
    category: "Kids Care",
    body: "Storm Kids Care: {{childName}} booked for {{date}} at {{time}}.",
    triggers: "Sent when a Kids Care session is booked.",
    sampleVariables: { childName: "Emma", date: "Mon Jun 9", time: "9:00 AM" },
    audience: "both",
  },
  {
    key: "kids-care-reminder",
    label: "Kids Care reminder",
    category: "Kids Care",
    body: "Storm Kids Care: Reminder — {{childName}} {{date}} at {{time}}.",
    triggers: "Cron: sent before a Kids Care session.",
    sampleVariables: { childName: "Emma", date: "Mon Jun 9", time: "9:00 AM" },
    audience: "both",
  },
  {
    key: "payment-failed",
    label: "Payment failed",
    category: "Billing",
    body: "Storm Wellness Club: Payment failed for {{description}}. Please update your card to keep your benefits active: stormwellnessclub.com/portal/billing",
    triggers: "Sent when a Stripe payment fails (dues, fees, charges).",
    sampleVariables: { description: "Monthly Dues — June" },
    audience: "both",
  },
  {
    key: "arrears-balance",
    label: "Outstanding balance reminder",
    category: "Billing",
    body: "Storm Wellness Club: You have an outstanding balance of {{amount}}. Please resolve to restore full access: stormwellnessclub.com/portal/billing",
    triggers: "Sent during dunning when a member has unpaid dues or arrears.",
    sampleVariables: { amount: "$219.00" },
    audience: "members",
  },
  {
    key: "card-expiring",
    label: "Card expiring",
    category: "Billing",
    body: "Storm Wellness Club: Your card ending {{last4}} expires {{expMonth}}/{{expYear}}. Update at stormwellnessclub.com/member/payment-methods to avoid interrupted billing. Reply STOP to opt out.",
    triggers: "Cron: sent ~30 days before a saved card expires.",
    sampleVariables: { last4: "4242", expMonth: "07", expYear: "2026" },
    audience: "members",
  },
  {
    key: "admin-custom",
    label: "Admin custom / blast",
    category: "Admin",
    body: "{{customBody}}",
    triggers: "Used by the SMS Blast tool and admin-initiated freeform messages. The body is whatever you type.",
    sampleVariables: { customBody: "(your message)" },
    audience: "both",
  },
  {
    key: "opt-in-confirmation",
    label: "Opt-in confirmation",
    category: "System",
    body: "Storm Wellness Club: You're subscribed to account & class alerts (reminders, waitlist, billing, appointments). Save this number as Storm Wellness Club so our texts show our name. These are automated alerts and replies aren't read; for questions call (248) 232-8487 or message us in your portal. Msg freq varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.",
    triggers: "Sent immediately after a user checks the SMS consent box on /apply or texts START/JOIN.",
    sampleVariables: {},
    audience: "both",
  },
  {
    key: "test-message",
    label: "Test message",
    category: "System",
    body: "Storm Wellness Club: test message{{note}}. Reply STOP to opt out.",
    triggers: 'Used by the "Send Test SMS" button in the admin panel.',
    sampleVariables: { note: " — hello" },
    audience: "both",
  },
];

/** Naive renderer mirroring the edge-function `tmpl` helper for previewing. */
export function renderSmsBody(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/** GSM-7 vs UCS-2 segment estimator (approximation). */
export function smsSegments(body: string): number {
  if (!body) return 0;
  // eslint-disable-next-line no-control-regex
  const isUnicode = /[^\u0000-\u007F]/.test(body);
  if (isUnicode) {
    if (body.length <= 70) return 1;
    return Math.ceil(body.length / 67);
  }
  if (body.length <= 160) return 1;
  return Math.ceil(body.length / 153);
}
