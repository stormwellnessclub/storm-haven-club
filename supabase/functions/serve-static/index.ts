import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { FULL_SITE_CONTENT_HTML } from "./full-site-content.ts";

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.stormwellnessclub.com/</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/classes</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/schedule</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/memberships</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/apply</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/spa</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/cafe</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/amenities</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/kids-care</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/class-passes</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/guest-pass</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/merch</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/faq</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/terms</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://www.stormwellnessclub.com/privacy</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;

const ROBOTS_TXT = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: https://www.stormwellnessclub.com/sitemap.xml`;

const SITE_AUDIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Audit — Storm Wellness Club</title>
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
<h1>Storm Wellness Club — Site Audit Document</h1>
<p><strong>Live URL:</strong> <a href="https://www.stormwellnessclub.com">https://www.stormwellnessclub.com</a></p>
<p><strong>Tech Stack:</strong> React (Vite), Tailwind CSS, TypeScript, Lovable Cloud (Supabase)</p>
<p><strong>Location:</strong> Dearborn, Michigan</p>
<p><strong>Type:</strong> Premium wellness &amp; fitness club</p>

<h2>Public Pages (15)</h2>
<table border="1" cellpadding="8" cellspacing="0">
<thead><tr><th>Path</th><th>Title</th><th>Meta Description</th></tr></thead>
<tbody>
<tr><td>/</td><td>Home — Storm Wellness Club</td><td>Premium wellness and fitness club in Dearborn, MI. Reformer Pilates, Cycling, Yoga, Recovery Spa, Café, Kids Care. Apply for membership today.</td></tr>
<tr><td>/classes</td><td>Classes — Storm Wellness Club</td><td>Explore our class offerings: Reformer Pilates (heated &amp; non-heated), Indoor Cycling, Yoga, Mat Pilates, HIIT, Barre, and more.</td></tr>
<tr><td>/schedule</td><td>Class Schedule — Storm Wellness Club</td><td>View and book upcoming class sessions. Real-time availability and waitlist support.</td></tr>
<tr><td>/memberships</td><td>Memberships — Storm Wellness Club</td><td>Membership tiers and pricing. Standard, Premium, and Executive options with wellness credits, guest passes, and spa access.</td></tr>
<tr><td>/apply</td><td>Apply for Membership — Storm Wellness Club</td><td>Submit your membership application. Choose your plan, provide your details, and join Storm Wellness Club.</td></tr>
<tr><td>/spa</td><td>Recovery Spa — Storm Wellness Club</td><td>Spa and recovery services including sauna, steam room, cold plunge, infrared therapy, therapeutic massage, and body treatments.</td></tr>
<tr><td>/cafe</td><td>Café — Storm Wellness Club</td><td>In-house café menu with smoothies, protein shakes, acai bowls, cold-pressed juices, coffee, and healthy snacks.</td></tr>
<tr><td>/amenities</td><td>Amenities — Storm Wellness Club</td><td>Club amenities: sauna, steam room, cold plunge, infrared sauna, outdoor terrace, premium locker rooms, towel service.</td></tr>
<tr><td>/kids-care</td><td>Kids Care — Storm Wellness Club</td><td>Supervised childcare while you work out. Safe, engaging environment for children of members.</td></tr>
<tr><td>/class-passes</td><td>Class Passes — Storm Wellness Club</td><td>Purchase class passes for non-members. Single class, 5-pack, and 10-pack options for Pilates, Cycling, Yoga, and more.</td></tr>
<tr><td>/guest-pass</td><td>Guest Pass — Storm Wellness Club</td><td>Purchase a day guest pass to experience Storm Wellness Club. Full facility access for one day.</td></tr>
<tr><td>/merch</td><td>Shop — Storm Wellness Club</td><td>Storm Wellness Club branded merchandise and wellness products.</td></tr>
<tr><td>/faq</td><td>FAQ — Storm Wellness Club</td><td>Frequently asked questions about memberships, classes, spa services, café, kids care, and facility policies.</td></tr>
<tr><td>/terms</td><td>Terms of Service — Storm Wellness Club</td><td>Terms and conditions for Storm Wellness Club membership and services.</td></tr>
<tr><td>/privacy</td><td>Privacy Policy — Storm Wellness Club</td><td>Privacy policy and data handling practices.</td></tr>
</tbody>
</table>

<h2>Protected Areas (require authentication)</h2>
<ul>
<li><strong>/member/*</strong> — Member dashboard, profile, bookings, credits, wellness tracking, payment methods, health score, achievements, workouts, habits, goals</li>
<li><strong>/portal/*</strong> — Non-member class portal: bookings, passes, payment methods, profile</li>
<li><strong>/admin/*</strong> — Staff admin panel: member management, check-in, classes, scheduling, payments, reports, café POS, spa appointments, equipment, marketing, email management</li>
</ul>

<h2>Key Features</h2>
<ol>
<li><strong>Class Booking System</strong> — Real-time enrollment, waitlists, multi-category (Pilates, Cycling, Yoga, HIIT, Barre, Mat Pilates)</li>
<li><strong>Membership Management</strong> — Application flow, tiered plans (Standard/Premium/Executive), founding member pricing</li>
<li><strong>Recovery Spa</strong> — Appointment booking with wellness credits, staff scheduling, conflict detection</li>
<li><strong>Café</strong> — Full POS system, menu management, member ordering</li>
<li><strong>Kids Care</strong> — Childcare booking for members during workouts</li>
<li><strong>Guest Passes</strong> — Purchase, check-in, feedback collection</li>
<li><strong>Class Passes</strong> — Non-member class access with multi-pack pricing</li>
<li><strong>Member Wellness</strong> — Health score, workout logging, habit tracking, goal setting, achievements</li>
<li><strong>Payment Processing</strong> — Stripe integration, payment tracking, revenue analytics</li>
<li><strong>Admin Dashboard</strong> — Full operational management, staff roles, email campaigns, reporting</li>
</ol>

<h2>SEO Notes</h2>
<ul>
<li>SPA (Single Page Application) — requires JS execution for rendering</li>
<li>Sitemap XML served via backend function</li>
<li>robots.txt allows all crawlers</li>
<li>Meta tags set per-page via react-helmet or component-level</li>
<li>No server-side rendering (SSR) — social previews depend on meta tags in index.html</li>
</ul>
</body>
</html>`;

serve(async (req) => {
  const url = new URL(req.url);
  const file = url.searchParams.get("file");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (file === "sitemap.xml") {
    return new Response(SITEMAP_XML, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  }

  if (file === "robots.txt") {
    return new Response(ROBOTS_TXT, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  }

  if (file === "site-audit") {
    return new Response(SITE_AUDIT_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  }

  if (file === "full-site-content") {
    return new Response(FULL_SITE_CONTENT_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
