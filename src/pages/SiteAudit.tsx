import { useEffect, useState } from "react";

const SITE_PAGES = [
  { path: "/", title: "Home — Storm Wellness Club", description: "Premium wellness and fitness club in Dearborn, MI. Reformer Pilates, Cycling, Yoga, Recovery Spa, Café, Kids Care. Apply for membership today." },
  { path: "/classes", title: "Classes — Storm Wellness Club", description: "Explore our class offerings: Reformer Pilates (heated & non-heated), Indoor Cycling, Yoga, Mat Pilates, HIIT, Barre, and more." },
  { path: "/schedule", title: "Class Schedule — Storm Wellness Club", description: "View and book upcoming class sessions. Real-time availability and waitlist support." },
  { path: "/memberships", title: "Memberships — Storm Wellness Club", description: "Membership tiers and pricing. Standard, Premium, and Executive options with wellness credits, guest passes, and spa access." },
  { path: "/apply", title: "Apply for Membership — Storm Wellness Club", description: "Submit your membership application. Choose your plan, provide your details, and join Storm Wellness Club." },
  { path: "/spa", title: "Recovery Spa — Storm Wellness Club", description: "Spa and recovery services including sauna, steam room, cold plunge, infrared therapy, therapeutic massage, and body treatments." },
  { path: "/cafe", title: "Café — Storm Wellness Club", description: "In-house café menu with smoothies, protein shakes, acai bowls, cold-pressed juices, coffee, and healthy snacks." },
  { path: "/amenities", title: "Amenities — Storm Wellness Club", description: "Club amenities: sauna, steam room, cold plunge, infrared sauna, outdoor terrace, premium locker rooms, towel service." },
  { path: "/kids-care", title: "Kids Care — Storm Wellness Club", description: "Supervised childcare while you work out. Safe, engaging environment for children of members." },
  { path: "/class-passes", title: "Class Passes — Storm Wellness Club", description: "Purchase class passes for non-members. Single class, 5-pack, and 10-pack options for Pilates, Cycling, Yoga, and more." },
  { path: "/guest-pass", title: "Guest Pass — Storm Wellness Club", description: "Purchase a day guest pass to experience Storm Wellness Club. Full facility access for one day." },
  { path: "/merch", title: "Shop — Storm Wellness Club", description: "Storm Wellness Club branded merchandise and wellness products." },
  { path: "/faq", title: "FAQ — Storm Wellness Club", description: "Frequently asked questions about memberships, classes, spa services, café, kids care, and facility policies." },
  { path: "/terms", title: "Terms of Service — Storm Wellness Club", description: "Terms and conditions for Storm Wellness Club membership and services." },
  { path: "/privacy", title: "Privacy Policy — Storm Wellness Club", description: "Privacy policy and data handling practices." },
  { path: "/auth", title: "Sign In — Storm Wellness Club", description: "Sign in or create an account to access your member dashboard, book classes, and manage your membership." },
];

const SiteAudit = () => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const directUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/serve-static?file=site-audit`;

  const auditText = `
=== STORM WELLNESS CLUB — SITE AUDIT DOCUMENT ===
Generated: ${new Date().toISOString()}
Live URL: https://www.stormwellnessclub.com
Tech Stack: React (Vite), Tailwind CSS, TypeScript, Lovable Cloud (Supabase)

=== SITEMAP (${SITE_PAGES.length} public pages) ===
${SITE_PAGES.map(p => `
--- ${p.path} ---
Title: ${p.title}
Meta Description: ${p.description}
Full URL: https://www.stormwellnessclub.com${p.path === "/" ? "" : p.path}
`).join("")}

=== PROTECTED AREAS (require authentication) ===
- /member/* — Member dashboard, profile, bookings, credits, wellness tracking, payment methods, health score, achievements, workouts, habits, goals
- /portal/* — Non-member class portal: bookings, passes, payment methods, profile
- /admin/* — Staff admin panel: member management, check-in, classes, scheduling, payments, reports, café POS, spa appointments, equipment, marketing, email management

=== KEY FEATURES ===
1. Class Booking System — Real-time enrollment, waitlists, multi-category (Pilates, Cycling, Yoga, HIIT, Barre, Mat Pilates)
2. Membership Management — Application flow, tiered plans (Standard/Premium/Executive), founding member pricing
3. Recovery Spa — Appointment booking with wellness credits, staff scheduling, conflict detection
4. Café — Full POS system, menu management, member ordering
5. Kids Care — Childcare booking for members during workouts
6. Guest Passes — Purchase, check-in, feedback collection
7. Class Passes — Non-member class access with multi-pack pricing
8. Member Wellness — Health score, workout logging, habit tracking, goal setting, achievements
9. Payment Processing — Stripe integration, payment tracking, revenue analytics
10. Admin Dashboard — Full operational management, staff roles, email campaigns, reporting

=== SEO NOTES ===
- SPA (Single Page Application) — requires JS execution for rendering
- Sitemap XML served via backend function
- robots.txt allows all crawlers
- Meta tags set per-page via react-helmet or component-level
- No server-side rendering (SSR) — social previews depend on meta tags in index.html

=== BUSINESS INFO ===
- Name: Storm Wellness Club
- Location: Dearborn, Michigan
- Type: Premium wellness & fitness club
- Website: https://www.stormwellnessclub.com
`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(auditText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-mono">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Site Audit Document</h1>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-primary text-primary-foreground rounded font-sans font-medium hover:bg-primary/90 transition-colors"
            >
              {linkCopied ? "✓ Link Copied!" : "Copy Link for AI"}
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded font-sans font-medium hover:bg-secondary/80 transition-colors"
            >
              {copied ? "✓ Copied!" : "Copy All Text"}
            </button>
          </div>
        </div>
        <p className="text-muted-foreground mb-2 font-sans text-sm">
          <strong>For Claude/AI tools:</strong> Click "Copy Link for AI" and paste the URL directly into Claude. It will fetch the static HTML version.
        </p>
        <p className="text-muted-foreground mb-4 font-sans text-xs break-all">
          Direct URL: <a href={directUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{directUrl}</a>
        </p>
        <pre className="whitespace-pre-wrap text-sm text-green-400 bg-muted p-6 rounded-lg border border-border overflow-auto">
          {auditText}
        </pre>
      </div>
    </div>
  );
};

export default SiteAudit;
