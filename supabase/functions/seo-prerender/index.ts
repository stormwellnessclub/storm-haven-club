import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SITE_URL = "https://stormwellnessclub.com";
const SITE_NAME = "Storm Wellness Club";
const OG_IMAGE = `${SITE_URL}/og/og-default.jpg`;

// Per-path 1200x630 social share cards (fall back to OG_IMAGE)
const OG_IMAGES: Record<string, string> = {
  '/spa': `${SITE_URL}/og/og-spa.jpg`,
  '/cafe': `${SITE_URL}/og/og-cafe.jpg`,
  '/classes': `${SITE_URL}/og/og-classes.jpg`,
  '/schedule': `${SITE_URL}/og/og-classes.jpg`,
  '/class-passes': `${SITE_URL}/og/og-classes.jpg`,
  '/memberships': `${SITE_URL}/og/og-memberships.jpg`,
  '/apply': `${SITE_URL}/og/og-memberships.jpg`,
};

const CRAWLER_USER_AGENTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'facebookexternalhit', 'twitterbot',
  'rogerbot', 'linkedinbot', 'embedly', 'quora link preview',
  'showyoubot', 'outbrain', 'pinterest', 'applebot', 'semrushbot',
  'ahrefsbot', 'mj12bot', 'petalbot'
];

interface PageMeta {
  title: string;
  description: string;
  h1: string;
  bodyContent: string;
}

const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: `${SITE_NAME} | Premium Fitness & Wellness in Livonia, MI`,
    description: 'Storm Wellness Club — luxury fitness and wellness destination in Livonia, Michigan. Reformer Pilates, Indoor Cycling, Yoga, Recovery Spa, Café, and Kids Care. Serving Livonia, Detroit, Dearborn, Farmington Hills, and surrounding areas. Apply for membership today.',
    h1: 'Storm Wellness Club',
    bodyContent: `
      <h2>Premium Wellness Destination in Livonia, Michigan</h2>
      <p>Storm Wellness Club is a luxury fitness and wellness club located at 18340 Middlebelt Rd, Livonia, MI 48152. We offer a comprehensive wellness experience including Reformer Pilates (heated and non-heated), Indoor Cycling, Yoga, HIIT, Barre, Mat Pilates, and more. Serving Livonia, Detroit, Dearborn, Farmington Hills, Redford, Garden City, Westland, Plymouth, Canton, Northville, Novi, and Southfield.</p>
      <h2>Our Studios</h2>
      <ul>
        <li><strong>Reformer Pilates Studio</strong> — A mixture of reformer classes, both heated and non-heated options</li>
        <li><strong>Cycling Studio</strong> — High-energy rides with immersive lighting and cinematic sound</li>
        <li><strong>Aerobics Room</strong> — Bootcamp, Sculpt, Yoga, HIIT and more in our versatile studio</li>
      </ul>
      <h2>Recovery & Wellness</h2>
      <p>Our Recovery Spa features sauna, steam room, cold plunge, infrared therapy, therapeutic massage, and body treatments.</p>
      <h2>Café</h2>
      <p>Fuel your wellness journey with smoothies, protein shakes, acai bowls, cold-pressed juices, and healthy snacks from our in-house café.</p>
      <h2>Kids Care</h2>
      <p>Supervised childcare for members while they work out in a safe, engaging environment.</p>
      <p><a href="${SITE_URL}/apply">Apply for Membership</a> | <a href="${SITE_URL}/classes">View Classes</a> | <a href="${SITE_URL}/schedule">Class Schedule</a></p>
    `
  },
  '/classes': {
    title: `Reformer Pilates, Cycling & Yoga Classes in Livonia, MI | ${SITE_NAME}`,
    description: 'Reformer Pilates (heated & non-heated), Indoor Cycling, Yoga, Barre, HIIT and Sculpt classes at Storm Wellness Club in Livonia, MI. Book online — class passes available.',
    h1: 'Classes at Storm Wellness Club',
    bodyContent: `
      <h2>Class Categories</h2>
      <ul>
        <li><strong>Reformer Pilates</strong> — Heated and non-heated reformer Pilates classes for all levels</li>
        <li><strong>Indoor Cycling</strong> — High-energy rides with immersive lighting and sound</li>
        <li><strong>Yoga</strong> — Flow, restorative, and power yoga sessions</li>
        <li><strong>Mat Pilates</strong> — Core-focused mat work for strength and flexibility</li>
        <li><strong>HIIT</strong> — High-intensity interval training for maximum results</li>
        <li><strong>Barre</strong> — Ballet-inspired workout combining strength, balance, and flexibility</li>
        <li><strong>Bootcamp</strong> — Full-body functional training</li>
        <li><strong>Sculpt</strong> — Targeted strength training with light weights</li>
      </ul>
      <p><a href="${SITE_URL}/schedule">View Class Schedule</a> | <a href="${SITE_URL}/class-passes">Purchase Class Passes</a></p>
    `
  },
  '/schedule': {
    title: `Reformer Pilates & Cycling Class Schedule in Livonia, MI | ${SITE_NAME}`,
    description: "See this week's Reformer Pilates, Indoor Cycling, Yoga and aerobics classes in Livonia, MI. Small groups, book online — class passes available, no membership required.",
    h1: 'Class Schedule',
    bodyContent: `<p>View our weekly class schedule and book your spot. Real-time availability and waitlist support for all classes including Reformer Pilates, Cycling, Yoga, HIIT, Barre, and more.</p>`
  },
  '/memberships': {
    title: `Gym & Wellness Memberships in Livonia, MI | ${SITE_NAME}`,
    description: 'Compare Silver, Gold, Platinum & Diamond memberships in Livonia, MI — Reformer Pilates, cycling, recovery spa credits, sauna, café and kids care included. Apply online.',
    h1: 'Membership Plans',
    bodyContent: `
      <h2>Membership Tiers</h2>
      <ul>
        <li><strong>Standard Membership</strong> — Access to all classes, gym floor, and basic amenities</li>
        <li><strong>Premium Membership</strong> — Everything in Standard plus wellness credits for spa services and guest passes</li>
        <li><strong>Executive Membership</strong> — The complete experience with enhanced credits, priority booking, and exclusive perks</li>
      </ul>
      <p>All memberships include unlimited access to classes, the fitness floor, locker rooms, and towel service.</p>
      <p><a href="${SITE_URL}/apply">Apply for Membership</a></p>
    `
  },
  '/apply': {
    title: `Apply for Membership | ${SITE_NAME}`,
    description: 'Submit your membership application to Storm Wellness Club. Choose your plan, provide your details, and join our premium fitness community in Livonia, MI.',
    h1: 'Apply for Membership',
    bodyContent: `<p>Ready to join Storm Wellness Club? Submit your membership application online. Choose your preferred membership tier, provide your details, and start your wellness journey.</p>`
  },
  '/spa': {
    title: `Aella Massage & Recovery Spa Livonia | ${SITE_NAME}`,
    description: 'Book a massage, red light therapy, cold plunge, infrared sauna or cryotherapy at Aella Recovery Spa in Livonia, MI. Open to the public — no membership needed.',
    h1: 'Aella Massage & Recovery Spa',
    bodyContent: `
      <h2>Spa & Recovery Services</h2>
      <ul>
        <li><strong>Sauna</strong> — Traditional dry heat sauna for relaxation and detox</li>
        <li><strong>Steam Room</strong> — Moist heat therapy for respiratory and skin benefits</li>
        <li><strong>Cold Plunge</strong> — Cold water immersion for recovery and inflammation reduction</li>
        <li><strong>Infrared Therapy</strong> — Deep-penetrating infrared heat for muscle recovery</li>
        <li><strong>Therapeutic Massage</strong> — Professional massage therapy services</li>
        <li><strong>Body Treatments</strong> — Specialized body treatment services</li>
      </ul>
      <p>Spa services are available to members with wellness credits or by appointment.</p>
    `
  },
  '/cafe': {
    title: `Café, Juice & Smoothie Bar in Livonia | ${SITE_NAME}`,
    description: 'Healthy café in Livonia, MI — smoothies, protein shakes, açaí bowls, cold-pressed juice & espresso. Open to the public at Storm Wellness Club.',
    h1: 'Storm Wellness Café',
    bodyContent: `<p>Fuel your workout with our in-house café featuring smoothies, protein shakes, acai bowls, cold-pressed juices, premium coffee, and healthy snacks. Available to members and guests.</p>`
  },
  '/amenities': {
    title: `Amenities | ${SITE_NAME}`,
    description: 'Club amenities: sauna, steam room, cold plunge, infrared sauna, outdoor terrace, premium locker rooms, and towel service at Storm Wellness Club.',
    h1: 'Club Amenities',
    bodyContent: `
      <h2>Facility Amenities</h2>
      <ul>
        <li>Sauna</li><li>Steam Room</li><li>Cold Plunge</li><li>Infrared Sauna</li>
        <li>Outdoor Terrace</li><li>Premium Locker Rooms</li><li>Towel Service</li>
        <li>Parking</li><li>Café</li><li>Kids Care</li>
      </ul>
    `
  },
  '/kids-care': {
    title: `Kids Care | ${SITE_NAME}`,
    description: 'Supervised childcare while you work out at Storm Wellness Club. Safe, engaging environment for children of members in Livonia, MI.',
    h1: 'Kids Care',
    bodyContent: `<p>Our Kids Care program provides supervised childcare for members during workouts. A safe, fun, and engaging environment for your children while you focus on your fitness.</p>`
  },
  '/class-passes': {
    title: `Class Passes | ${SITE_NAME}`,
    description: 'Purchase class passes for non-members at Storm Wellness Club. Single class, 5-pack, and 10-pack options for Pilates, Cycling, Yoga, and more.',
    h1: 'Class Passes',
    bodyContent: `
      <p>Don't have a membership? Purchase class passes to attend individual classes at Storm Wellness Club. Available in single class, 5-pack, and 10-pack options.</p>
      <p>Class categories: Reformer Pilates, Indoor Cycling, Yoga, Mat Pilates, HIIT, Barre, and more.</p>
    `
  },
  '/guest-pass': {
    title: `Guest Pass | ${SITE_NAME}`,
    description: 'Purchase a day guest pass to experience Storm Wellness Club in Livonia, MI. Full facility access for one day.',
    h1: 'Guest Day Pass',
    bodyContent: `<p>Experience Storm Wellness Club with a day guest pass. Enjoy full facility access including the fitness floor, classes (subject to availability), locker rooms, and amenities for one day.</p>`
  },
  '/merch': {
    title: `Shop | ${SITE_NAME}`,
    description: 'Storm Wellness Club branded merchandise and wellness products. Shop apparel, accessories, and more.',
    h1: 'Storm Wellness Shop',
    bodyContent: `<p>Shop Storm Wellness Club branded merchandise including apparel, accessories, and wellness products.</p>`
  },
  '/faq': {
    title: `FAQ | ${SITE_NAME}`,
    description: 'Frequently asked questions about memberships, classes, spa services, café, kids care, and facility policies at Storm Wellness Club.',
    h1: 'Frequently Asked Questions',
    bodyContent: `<p>Find answers to common questions about Storm Wellness Club memberships, classes, spa services, café, kids care, guest passes, and facility policies.</p>`
  },
  '/terms': {
    title: `Terms of Service | ${SITE_NAME}`,
    description: 'Terms and conditions for Storm Wellness Club membership and services.',
    h1: 'Terms of Service',
    bodyContent: `<p>Terms and conditions governing membership and use of Storm Wellness Club facilities and services.</p>`
  },
  '/privacy': {
    title: `Privacy Policy | ${SITE_NAME}`,
    description: 'Privacy policy and data handling practices for Storm Wellness Club.',
    h1: 'Privacy Policy',
    bodyContent: `<p>Learn about how Storm Wellness Club collects, uses, and protects your personal information.</p>`
  },
  '/spa/red-light-therapy': {
    title: `Red Light Therapy in Livonia, MI | ${SITE_NAME}`,
    description: 'Full-body red light and near-infrared therapy at Storm Wellness Club in Livonia, MI. Recovery, skin health, sleep, inflammation support.',
    h1: 'Red Light Therapy in Livonia, MI',
    bodyContent: `<p>Full-body red and near-infrared light therapy at Storm Wellness Club. Sessions deliver clinical-grade 630–850nm wavelengths to support muscle recovery, skin health, and cellular energy.</p><h2>Benefits</h2><ul><li>Post-workout muscle recovery</li><li>Skin tone and collagen support</li><li>May support better sleep</li><li>Non-invasive, no UV</li></ul><p>Located in Livonia, MI — serving Detroit, Farmington Hills, Plymouth, Northville, and Novi. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/spa/cryotherapy': {
    title: `Cryotherapy in Livonia, MI | ${SITE_NAME}`,
    description: 'Whole-body cryotherapy at Storm Wellness Club in Livonia, MI. 3-minute cold exposure for recovery, inflammation, energy.',
    h1: 'Cryotherapy in Livonia, MI',
    bodyContent: `<p>Whole-body cryotherapy at Storm Wellness Club. A 3-minute session in air between -200°F and -240°F triggers a powerful recovery response with endorphin and norepinephrine release.</p><h2>Benefits</h2><ul><li>Faster recovery from training</li><li>Reduced inflammation and joint discomfort</li><li>Energy, focus, and mood lift</li><li>Short — just 3 minutes</li></ul><p>Serving Livonia, Detroit, Farmington Hills, Plymouth, and Northville. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/spa/infrared-sauna': {
    title: `Infrared Sauna in Livonia, MI | ${SITE_NAME}`,
    description: 'Far-infrared sauna sessions at Storm Wellness Club in Livonia, MI. Deep heat for cardiovascular health, detox, and recovery.',
    h1: 'Infrared Sauna in Livonia, MI',
    bodyContent: `<p>Far-infrared sauna at Storm Wellness Club. Light-based heat warms your body directly for a deeper sweat at a more comfortable temperature.</p><h2>Benefits</h2><ul><li>Cardiovascular conditioning</li><li>Deep sweat at lower ambient temperature</li><li>Muscle recovery and relaxation</li><li>Pairs with cold plunge for contrast therapy</li></ul><p>Located in Livonia, MI. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/spa/cold-plunge': {
    title: `Cold Plunge in Livonia, MI | ${SITE_NAME}`,
    description: 'Cold plunge therapy at Storm Wellness Club in Livonia, MI. Cold-water immersion for recovery, inflammation, focus, and resilience.',
    h1: 'Cold Plunge in Livonia, MI',
    bodyContent: `<p>Controlled cold-water immersion at Storm Wellness Club. 2–3 minutes in cold water reduces muscle inflammation, sharpens focus, and triggers a sustained dopamine release.</p><h2>Benefits</h2><ul><li>Muscle recovery and reduced soreness</li><li>Sustained mood and focus boost</li><li>Trains nervous-system resilience</li><li>Pairs with sauna for contrast therapy</li></ul><p>Serving Livonia and the greater Detroit metro. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/spa/sauna-steam': {
    title: `Sauna & Steam Room in Livonia, MI | ${SITE_NAME}`,
    description: 'Traditional dry sauna and steam room at Storm Wellness Club in Livonia, MI. Relaxation, recovery, respiratory wellness.',
    h1: 'Sauna & Steam Room in Livonia, MI',
    bodyContent: `<p>Traditional dry sauna and eucalyptus steam room at Storm Wellness Club. Built for quiet, restorative recovery between workouts and meetings.</p><h2>Benefits</h2><ul><li>Muscle relaxation after training</li><li>Respiratory wellness (steam room)</li><li>Screen-free downtime</li><li>Pairs with cold plunge</li></ul><p>Located in Livonia, MI. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/spa/massage': {
    title: `Therapeutic Massage in Livonia, MI | ${SITE_NAME}`,
    description: 'Swedish, deep tissue, sports, and prenatal massage at Storm Wellness Club in Livonia, MI. Licensed therapists, online booking.',
    h1: 'Therapeutic Massage in Livonia, MI',
    bodyContent: `<p>Licensed massage therapists, premium private treatment rooms, and online booking at Storm Wellness Club. Modalities include Swedish, deep tissue, sports, and prenatal in 60 and 90-minute formats.</p><h2>Benefits</h2><ul><li>Experienced licensed therapists</li><li>Multiple modalities</li><li>Member discounts 5–12%</li><li>Open to members and non-members</li></ul><p>Serving Livonia, Detroit, Farmington Hills, Plymouth, and Northville. <a href="${SITE_URL}/spa?category=Massage">Book a massage</a>.</p>`
  },
  '/spa/salt-room': {
    title: `Salt Room Halotherapy in Livonia, MI | ${SITE_NAME}`,
    description: 'Halotherapy salt room at Storm Wellness Club in Livonia, MI. Dry salt therapy for respiratory wellness, skin health, deep relaxation.',
    h1: 'Salt Room Halotherapy in Livonia, MI',
    bodyContent: `<p>Dedicated salt room at Storm Wellness Club delivering micronized pharmaceutical-grade salt for respiratory wellness and skin support.</p><h2>Benefits</h2><ul><li>Clear breathing and respiratory wellness</li><li>Skin condition support</li><li>Meditative, screen-free environment</li><li>25-minute sessions</li></ul><p>Located in Livonia, MI. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/spa/zerobody': {
    title: `Starpool ZeroBody Dry Float in Livonia, MI | ${SITE_NAME}`,
    description: 'Starpool ZeroBody dry-float recovery pod at Storm Wellness Club in Livonia, MI. Weightless relaxation for stress, sleep, recovery.',
    h1: 'Starpool ZeroBody Dry Float in Livonia, MI',
    bodyContent: `<p>Italian-engineered Starpool ZeroBody dry-float pod at Storm Wellness Club. Lie on a warm body-conforming membrane for a 30-minute deep nervous-system reset — no water, no shower, fully clothed.</p><h2>Benefits</h2><ul><li>Float-therapy benefits without water</li><li>Stress recovery and sleep support</li><li>Warm, weightless 30 minutes</li><li>One of few in Michigan</li></ul><p>Located in Livonia, MI. <a href="${SITE_URL}/spa">View all spa services</a>.</p>`
  },
  '/cafe': {
    title: `Healthy Café in Livonia, MI | ${SITE_NAME}`,
    description: 'In-house café at Storm Wellness Club: smoothies, protein shakes, acai bowls, cold-pressed juices, coffee, and healthy snacks in Livonia, MI.',
    h1: 'Healthy Café in Livonia, MI',
    bodyContent: `<p>Storm Wellness Club's in-house café serves smoothies, protein shakes, acai bowls, cold-pressed juices, coffee, and healthy snacks daily. Open to members and recovery guests.</p><p>Located at 18340 Middlebelt Rd, Livonia, MI 48152.</p>`
  },
  '/amenities': {
    title: `Luxury Gym Amenities in Livonia, MI | ${SITE_NAME}`,
    description: 'Amenities at Storm Wellness Club: sauna, steam room, cold plunge, infrared sauna, salt room, outdoor terrace, premium locker rooms in Livonia, MI.',
    h1: 'Luxury Gym Amenities in Livonia, MI',
    bodyContent: `<p>Storm Wellness Club is built around premium amenities: dry sauna, steam room, cold plunge, infrared sauna, salt room, Starpool ZeroBody, premium locker rooms with towel service, outdoor terrace, and an in-house healthy café.</p>`
  },
  '/kids-care': {
    title: `Kids Care & Childcare in Livonia, MI | ${SITE_NAME}`,
    description: 'Supervised childcare for ages 4 months to 8 years at Storm Wellness Club in Livonia, MI. Safe, engaging, member-only.',
    h1: 'Kids Care in Livonia, MI',
    bodyContent: `<p>Storm Wellness Club offers supervised childcare for members' children from 4 months to 8 years old. Little Stars (4 months–1 year) and Big Stars (5–8 years) rooms with experienced staff.</p>`
  },
};

const JSON_LD_LOCAL_BUSINESS = {
  "@context": "https://schema.org",
  "@type": "HealthClub",
  "name": "Storm Wellness Club",
  "description": "Premium fitness and wellness club in Livonia, Michigan offering Reformer Pilates, Indoor Cycling, Yoga, Recovery Spa, Café, and Kids Care.",
  "url": SITE_URL,
  "logo": OG_IMAGE,
  "image": OG_IMAGE,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "18340 Middlebelt Rd",
    "addressLocality": "Livonia",
    "addressRegion": "MI",
    "postalCode": "48152",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 42.4034,
    "longitude": -83.3497
  },
  "areaServed": [
    { "@type": "City", "name": "Livonia, MI" },
    { "@type": "City", "name": "Detroit, MI" },
    { "@type": "City", "name": "Dearborn, MI" },
    { "@type": "City", "name": "Farmington Hills, MI" },
    { "@type": "City", "name": "Redford, MI" },
    { "@type": "City", "name": "Garden City, MI" },
    { "@type": "City", "name": "Westland, MI" },
    { "@type": "City", "name": "Plymouth, MI" },
    { "@type": "City", "name": "Canton, MI" },
    { "@type": "City", "name": "Northville, MI" },
    { "@type": "City", "name": "Novi, MI" },
    { "@type": "City", "name": "Southfield, MI" }
  ],
  "sameAs": [
    "https://www.instagram.com/stormwellnessclub",
    "https://www.facebook.com/stormwellnessclub"
  ]
};

const JSON_LD_WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Storm Wellness Club",
  "url": SITE_URL
};

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some(bot => ua.includes(bot));
}

function renderPage(path: string): string {
  const meta = PAGE_META[path] || PAGE_META['/'];
  const ogImage = OG_IMAGES[path] || OG_IMAGE;
  const canonicalUrl = `${SITE_URL}${path === '/' ? '' : path}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="geo.region" content="US-MI">
  <meta name="geo.placename" content="Livonia, Michigan">

  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="en_US">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.description}">
  <meta name="twitter:image" content="${ogImage}">

  <script type="application/ld+json">${JSON.stringify(JSON_LD_LOCAL_BUSINESS)}</script>
  <script type="application/ld+json">${JSON.stringify(JSON_LD_WEBSITE)}</script>
</head>
<body>
  <h1>${meta.h1}</h1>
  ${meta.bodyContent}
  <nav>
    <ul>
      <li><a href="${SITE_URL}/">Home</a></li>
      <li><a href="${SITE_URL}/classes">Classes</a></li>
      <li><a href="${SITE_URL}/schedule">Schedule</a></li>
      <li><a href="${SITE_URL}/memberships">Memberships</a></li>
      <li><a href="${SITE_URL}/apply">Apply</a></li>
      <li><a href="${SITE_URL}/spa">Recovery Spa</a></li>
      <li><a href="${SITE_URL}/cafe">Café</a></li>
      <li><a href="${SITE_URL}/amenities">Amenities</a></li>
      <li><a href="${SITE_URL}/kids-care">Kids Care</a></li>
      <li><a href="${SITE_URL}/class-passes">Class Passes</a></li>
      <li><a href="${SITE_URL}/guest-pass">Guest Pass</a></li>
      <li><a href="${SITE_URL}/merch">Shop</a></li>
      <li><a href="${SITE_URL}/faq">FAQ</a></li>
    </ul>
  </nav>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Storm Wellness Club. 18340 Middlebelt Rd, Livonia, MI 48152.</p>
    <a href="${SITE_URL}/terms">Terms of Service</a> | <a href="${SITE_URL}/privacy">Privacy Policy</a>
  </footer>
</body>
</html>`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const userAgent = req.headers.get('user-agent') || '';

  // If not a crawler, redirect to the actual site
  if (!isCrawler(userAgent)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${SITE_URL}${path}`,
        ...corsHeaders,
      },
    });
  }

  // Serve pre-rendered HTML for crawlers
  const html = renderPage(path);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      ...corsHeaders,
    },
  });
});
