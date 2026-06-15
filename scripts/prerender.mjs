// Build-time static prerender for SEO.
// Runs after `vite build`. Reads dist/index.html and writes route-specific
// dist/<route>/index.html files with unique <title>, <meta description>,
// <link rel="canonical">, og:* tags, JSON-LD, and crawlable body content
// rendered inside <div id="root">. React replaces the content on hydration,
// so users get the live app while crawlers (Googlebot, Bingbot, social
// scrapers) see real per-page content instead of an empty SPA shell.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const DIST = resolve("dist");
const SITE = "https://stormwellnessclub.com";
const BRAND = "Storm Wellness Club";
const ADDRESS = "18340 Middlebelt Rd, Livonia, MI 48152";

if (!existsSync(join(DIST, "index.html"))) {
  console.warn("[prerender] dist/index.html missing — skipping.");
  process.exit(0);
}

const shell = readFileSync(join(DIST, "index.html"), "utf8");

/** @typedef {{title:string,description:string,h1:string,body:string,schema?:object[],ogType?:string}} Page */

const localBusinessLd = {
  "@context": "https://schema.org",
  "@type": ["HealthClub", "LocalBusiness", "SportsActivityLocation"],
  "@id": `${SITE}/#localbusiness`,
  name: BRAND,
  url: SITE,
  telephone: "+1-313-286-5070",
  email: "contact@stormwellnessclub.com",
  image: `${SITE}/pwa-512x512.png`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "18340 Middlebelt Rd",
    addressLocality: "Livonia",
    addressRegion: "MI",
    postalCode: "48152",
    addressCountry: "US",
  },
  geo: { "@type": "GeoCoordinates", latitude: 42.4034, longitude: -83.3497 },
  areaServed: [
    "Livonia, MI", "Detroit, MI", "Dearborn, MI", "Farmington Hills, MI",
    "Redford, MI", "Garden City, MI", "Westland, MI", "Plymouth, MI",
    "Canton, MI", "Northville, MI", "Novi, MI", "Southfield, MI",
  ].map((name) => ({ "@type": "City", name })),
};

const breadcrumb = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE}${it.path}`,
  })),
});

const faq = (items) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const serviceLd = (name, description, path, type = "Service") => ({
  "@context": "https://schema.org",
  "@type": type,
  name,
  description,
  url: `${SITE}${path}`,
  provider: { "@id": `${SITE}/#localbusiness` },
  areaServed: localBusinessLd.areaServed,
});

const navLinks = `
  <nav aria-label="Main">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/spa">Recovery Spa</a></li>
      <li><a href="/spa/massage">Massage</a></li>
      <li><a href="/cafe">Café &amp; Smoothie Bar</a></li>
      <li><a href="/classes">Classes</a></li>
      <li><a href="/schedule">Schedule</a></li>
      <li><a href="/memberships">Memberships</a></li>
      <li><a href="/apply">Apply</a></li>
      <li><a href="/personal-training">Personal Training</a></li>
      <li><a href="/amenities">Amenities</a></li>
      <li><a href="/kids-care">Kids Care</a></li>
      <li><a href="/class-passes">Class Passes</a></li>
      <li><a href="/guest-pass">Guest Pass</a></li>
    </ul>
  </nav>`;

const footer = `
  <footer>
    <p><strong>${BRAND}</strong> &middot; ${ADDRESS} &middot; <a href="tel:+13132865070">(313) 286-5070</a></p>
    <p>Serving Livonia, Detroit, Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, Southfield, and Dearborn, MI.</p>
  </footer>`;

/** @type {Record<string, Page>} */
const PAGES = {
  "/": {
    title: `${BRAND} — Premium Fitness, Recovery Spa, Massage & Café in Livonia, MI`,
    description: `Storm Wellness Club in Livonia, MI: Reformer Pilates, cycling, yoga, therapeutic massage, recovery spa, juice & smoothie café, and supervised kids care. Serving the Detroit metro.`,
    h1: `${BRAND} — Livonia, Michigan`,
    body: `
      <p>Storm Wellness Club is a premium fitness, recovery, and wellness destination at ${ADDRESS}. Members and guests come to us for Reformer Pilates, indoor cycling, yoga, HIIT, barre, therapeutic massage, a full recovery spa, an in-house healthy café and juice bar, and supervised kids care.</p>
      <h2>Find what you came for</h2>
      <ul>
        <li><a href="/spa/massage">Massage near Livonia, MI</a> — Swedish, deep tissue, sports, prenatal. Licensed therapists, online booking.</li>
        <li><a href="/cafe">Café, juice bar &amp; smoothie bar</a> — smoothies, protein shakes, açaí bowls, cold-pressed juice, espresso, healthy snacks. Open to the public.</li>
        <li><a href="/spa">Recovery spa</a> — sauna, steam, cold plunge, infrared, red light therapy, salt room, Starpool ZeroBody dry float.</li>
        <li><a href="/classes">Classes &amp; schedule</a> — heated &amp; non-heated Reformer Pilates, cycling, yoga, mat Pilates, HIIT, barre, bootcamp, sculpt.</li>
        <li><a href="/personal-training">Personal training</a> — 1-on-1, semi-private, and private Pilates.</li>
        <li><a href="/kids-care">Kids care</a> — supervised childcare while you train (ages 4 months–8 years).</li>
      </ul>
      <h2>Visit us</h2>
      <p>${ADDRESS}. A short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, Southfield, Dearborn, and Detroit. <a href="/apply">Apply for membership</a> or <a href="/guest-pass">book a guest day pass</a>.</p>`,
    schema: [localBusinessLd],
  },

  "/spa/massage": {
    title: `Massage Near Me in Livonia, MI — Swedish, Deep Tissue, Sports, Prenatal | ${BRAND}`,
    description: `Therapeutic massage in Livonia, MI at Storm Wellness Club. Licensed therapists; Swedish, deep tissue, sports, and prenatal massage in 60 and 90-minute sessions. Book online.`,
    h1: `Massage Therapy Near Livonia, MI`,
    body: `
      <p>Looking for a massage near you in Livonia, Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, or Southfield? Storm Wellness Club's massage program is built around <strong>licensed therapists</strong>, premium private treatment rooms, and a quiet, considered environment. Both members and non-members can book.</p>
      <h2>Massage modalities we offer</h2>
      <ul>
        <li><strong>Swedish Massage</strong> — calming, full-body, slow rhythmic pressure (60 / 90 min).</li>
        <li><strong>Deep Tissue / Deep Relief Massage</strong> — deep pressure for muscular tension (60 / 90 min).</li>
        <li><strong>Sports Performance Massage</strong> — athletic focus with compression, stretching, and joint mobility (60 / 90 min).</li>
        <li><strong>Prenatal Massage</strong> — restorative prenatal-safe technique with hip support and decompression (60 / 90 min).</li>
        <li><strong>Lymph &amp; Flow</strong> — gentle rhythmic work to stimulate lymph movement.</li>
        <li><strong>Storm Signature Massage</strong> — our calming flagship treatment.</li>
      </ul>
      <h2>Why book massage at Storm</h2>
      <ul>
        <li>Licensed, experienced massage therapists</li>
        <li>Premium private treatment rooms</li>
        <li>60 and 90-minute sessions</li>
        <li>Member discounts of 5–12% by tier</li>
        <li>Pair with sauna, cold plunge, red light, or Starpool ZeroBody for a full recovery afternoon</li>
      </ul>
      <p><a href="/spa?category=Massage">Book a massage</a> &middot; <a href="/spa">View all spa services</a></p>
      <h2>Massage in Livonia, MI — service area</h2>
      <p>Storm Wellness Club is centrally located at ${ADDRESS} — a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, Southfield, Dearborn, and Detroit.</p>
      <h2>Massage FAQ</h2>
      <h3>How much does a massage cost in Livonia?</h3>
      <p>Pricing varies by modality and length. Storm Signature Massage starts at $120 (60 min) / $155 (90 min); Deep Relief from $145 / $185; Sports Performance from $150 / $195; Prenatal from $165 / $215. Members receive 5–12% off depending on tier.</p>
      <h3>Do I need to be a member to book a massage?</h3>
      <p>No. Both members and non-members can book. Non-members create a portal account and sign a waiver before the first appointment.</p>
      <h3>How do I book a massage near me?</h3>
      <p>Visit our <a href="/spa?category=Massage">spa booking page</a>, choose a service and therapist, and confirm online. You'll receive an email and text confirmation.</p>`,
    schema: [
      serviceLd("Therapeutic Massage", "Swedish, deep tissue, sports, and prenatal massage in Livonia, MI.", "/spa/massage", "MassageTherapy"),
      breadcrumb([
        { name: "Home", path: "/" },
        { name: "Recovery Spa", path: "/spa" },
        { name: "Therapeutic Massage", path: "/spa/massage" },
      ]),
      faq([
        { q: "How much does a massage cost in Livonia?", a: "Storm Signature from $120/$155 (60/90 min), Deep Relief from $145/$185, Sports Performance from $150/$195, Prenatal from $165/$215. Members 5–12% off." },
        { q: "Do I need to be a member to book a massage?", a: "No — both members and non-members can book. Non-members create a portal account and sign a waiver before the first appointment." },
        { q: "What modalities do you offer?", a: "Swedish, deep tissue, sports, prenatal, lymph & flow, and our Storm Signature massage, in 60 and 90-minute formats." },
        { q: "Where is Storm Wellness Club located?", a: "18340 Middlebelt Rd, Livonia, MI 48152 — serving Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, Southfield, and Detroit." },
      ]),
    ],
  },

  "/cafe": {
    title: `Café, Juice Bar & Smoothie Bar in Livonia, MI — Storm Café | ${BRAND}`,
    description: `Storm Café in Livonia, MI: smoothies, protein shakes, açaí bowls, cold-pressed juice, espresso, and healthy snacks. Open to the public — serving the Detroit metro.`,
    h1: `Café, Juice Bar &amp; Smoothie Bar in Livonia, MI`,
    body: `
      <p>The <strong>Storm Café</strong> is the in-house café, juice bar, and smoothie bar inside Storm Wellness Club at ${ADDRESS}. Fresh smoothies, protein shakes, açaí bowls, cold-pressed juice, espresso, and clean snacks — made daily and <strong>open to the public</strong>.</p>
      <h2>What we serve</h2>
      <ul>
        <li><strong>Smoothies</strong> — real-fruit smoothies with nut or oat milk, optional protein.</li>
        <li><strong>Protein Shakes</strong> — clean whey or plant-based protein, 25–35g per shake, no powdered fillers.</li>
        <li><strong>Açaí &amp; Pitaya Bowls</strong> — thick frozen-fruit bowls with granola, nut butter, and seasonal toppings.</li>
        <li><strong>Cold-Pressed Juice</strong> — rotating juices, wellness shots, and hydration blends.</li>
        <li><strong>Coffee &amp; Espresso</strong> — espresso drinks, drip coffee, matcha, and seasonal lattes; dairy and plant-milk options.</li>
        <li><strong>Healthy Snacks &amp; Light Meals</strong> — protein-forward bites and grab-and-go options.</li>
      </ul>
      <h2>Searching nearby for a healthy café?</h2>
      <p>Storm Café is a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, Southfield, Dearborn, and Detroit. If you're looking for a smoothie bar near you, a juice bar near you, a protein shake near you, or an açaí bowl near you — Storm Café fits.</p>
      <h2>Café FAQ</h2>
      <h3>Is the Storm Café open to non-members?</h3>
      <p>Yes — Storm Café is open to the public during club hours. Walk in, order at the kiosk, and we'll have it ready.</p>
      <h3>Do you offer dairy-free, vegan, or gluten-free options?</h3>
      <p>Yes. Most smoothies, bowls, and juices are dairy-free by default; plant-based protein and oat/almond milk are available.</p>
      <h3>Can I order ahead?</h3>
      <p>Yes — members can order ahead from the member portal, and walk-ins can order at the kiosk. Most drinks are ready in 5–8 minutes.</p>`,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CafeOrCoffeeShop",
        name: "Storm Café at Storm Wellness Club",
        image: `${SITE}/pwa-512x512.png`,
        url: `${SITE}/cafe`,
        servesCuisine: ["Smoothies", "Protein Shakes", "Açaí Bowls", "Cold-Pressed Juice", "Coffee", "Healthy Snacks"],
        priceRange: "$$",
        address: localBusinessLd.address,
        geo: localBusinessLd.geo,
        areaServed: localBusinessLd.areaServed,
        parentOrganization: { "@type": "HealthClub", name: BRAND, url: SITE },
      },
      breadcrumb([{ name: "Home", path: "/" }, { name: "Café", path: "/cafe" }]),
      faq([
        { q: "Is the Storm Café open to non-members?", a: "Yes — Storm Café is open to the public during club hours." },
        { q: "Where can I get the best protein shake near me in Livonia?", a: "Storm Café blends protein shakes with clean whey or plant-based protein and 25–35g of protein per shake." },
        { q: "Where can I get an açaí bowl near Livonia?", a: "Storm Café serves fresh açaí and pitaya bowls daily." },
        { q: "Do you offer dairy-free, vegan, or gluten-free options?", a: "Yes — most smoothies, bowls, and juices are dairy-free; plant-based protein and oat/almond milk are available." },
      ]),
    ],
  },

  "/spa": {
    title: `Recovery Spa in Livonia, MI — Massage, Sauna, Cold Plunge, Red Light | ${BRAND}`,
    description: `Recovery spa in Livonia, MI: therapeutic massage, sauna, steam, cold plunge, infrared sauna, red light therapy, salt room, and Starpool ZeroBody dry float at Storm Wellness Club.`,
    h1: `Recovery Spa in Livonia, MI`,
    body: `
      <p>Storm Wellness Club's recovery spa pairs <a href="/spa/massage">therapeutic massage</a> with a full suite of recovery modalities under one roof in Livonia, Michigan.</p>
      <ul>
        <li><a href="/spa/massage">Therapeutic Massage</a> — Swedish, deep tissue, sports, prenatal</li>
        <li><a href="/spa/red-light-therapy">Red Light Therapy</a></li>
        <li><a href="/spa/cryotherapy">Cryotherapy</a></li>
        <li><a href="/spa/infrared-sauna">Infrared Sauna</a></li>
        <li><a href="/spa/cold-plunge">Cold Plunge</a></li>
        <li><a href="/spa/sauna-steam">Sauna &amp; Steam Room</a></li>
        <li><a href="/spa/salt-room">Salt Room (Halotherapy)</a></li>
        <li><a href="/spa/zerobody">Starpool ZeroBody Dry Float</a></li>
      </ul>
      <p>Located at ${ADDRESS}. Open to members and non-members.</p>`,
    schema: [
      breadcrumb([{ name: "Home", path: "/" }, { name: "Recovery Spa", path: "/spa" }]),
      { ...localBusinessLd, "@type": ["HealthClub", "DaySpa", "LocalBusiness"] },
    ],
  },

  "/memberships": {
    title: `Memberships in Livonia, MI — Gym, Pilates, Recovery & Café | ${BRAND}`,
    description: `Storm Wellness Club membership plans in Livonia, MI. All-inclusive access to classes, gym floor, recovery spa, amenities, and member pricing on massage and café.`,
    h1: `Memberships`,
    body: `<p>Membership at Storm Wellness Club includes unlimited classes, the fitness floor, locker rooms, towel service, and access to the recovery spa amenities. Tier upgrades add wellness credits, guest passes, and priority booking. <a href="/apply">Apply now</a>.</p>`,
  },

  "/apply": {
    title: `Apply for Membership — Storm Wellness Club, Livonia MI`,
    description: `Submit your Storm Wellness Club membership application. Choose your plan, provide details, and join Livonia's premium fitness, recovery, and wellness community.`,
    h1: `Apply for Membership`,
    body: `<p>Ready to join Storm? Submit your application online — choose your tier, complete your profile, and start training, recovering, and refueling at ${ADDRESS}.</p>`,
  },

  "/classes": {
    title: `Fitness Classes in Livonia, MI — Reformer Pilates, Cycling, Yoga | ${BRAND}`,
    description: `Reformer Pilates (heated & non-heated), indoor cycling, yoga, mat Pilates, HIIT, barre, bootcamp, and sculpt at Storm Wellness Club in Livonia, MI.`,
    h1: `Classes at Storm Wellness Club`,
    body: `<p>Heated and non-heated <strong>Reformer Pilates</strong>, immersive <strong>indoor cycling</strong>, flow and restorative <strong>yoga</strong>, <strong>mat Pilates</strong>, <strong>HIIT</strong>, <strong>barre</strong>, <strong>bootcamp</strong>, and <strong>sculpt</strong>. <a href="/schedule">View the schedule</a> or <a href="/class-passes">buy a class pass</a>.</p>`,
  },

  "/schedule": {
    title: `Class Schedule — Storm Wellness Club, Livonia MI`,
    description: `Real-time class schedule and online booking for Reformer Pilates, cycling, yoga, HIIT, barre, and more at Storm Wellness Club in Livonia, MI.`,
    h1: `Class Schedule`,
    body: `<p>View the weekly class schedule and book your spot. Real-time availability and waitlist support for all classes.</p>`,
  },

  "/class-passes": {
    title: `Class Passes — Pilates, Cycling, Yoga in Livonia, MI | ${BRAND}`,
    description: `Drop-in and multi-class passes for Storm Wellness Club. Try Reformer Pilates, cycling, yoga, and more without a full membership.`,
    h1: `Class Passes`,
    body: `<p>No membership required. Buy a single class pass or a multi-pack and book any open spot in our schedule.</p>`,
  },

  "/personal-training": {
    title: `Personal Training in Livonia, MI — 1-on-1, Semi-Private, Private Pilates | ${BRAND}`,
    description: `Personal training at Storm Wellness Club in Livonia, MI. Certified coaches for 1-on-1, semi-private, and private Reformer Pilates sessions.`,
    h1: `Personal Training in Livonia, MI`,
    body: `<p>Train one-on-one with a certified coach, or share a session in a <a href="/personal-training/semi-private">semi-private</a> or <a href="/personal-training/private-pilates">private Reformer Pilates</a> format. <a href="/personal-training/one-on-one">Explore 1-on-1 training</a>.</p>`,
  },

  "/personal-training/one-on-one": {
    title: `1-on-1 Personal Training in Livonia, MI | ${BRAND}`,
    description: `Dedicated 1-on-1 personal training with certified coaches at Storm Wellness Club in Livonia, MI.`,
    h1: `1-on-1 Personal Training`,
    body: `<p>One coach, one focus, one programmed result. Sessions are built around your goals — strength, hypertrophy, mobility, fat loss, or sport-specific.</p>`,
  },

  "/personal-training/private-pilates": {
    title: `Private Reformer Pilates in Livonia, MI | ${BRAND}`,
    description: `Private Reformer Pilates sessions at Storm Wellness Club in Livonia, MI — one instructor, one reformer, fully tailored to you.`,
    h1: `Private Reformer Pilates`,
    body: `<p>One reformer, one instructor, fully tailored programming — ideal for beginners, post-rehab work, or athletes refining technique.</p>`,
  },

  "/personal-training/semi-private": {
    title: `Semi-Private Training in Livonia, MI | ${BRAND}`,
    description: `Semi-private training — small-group strength and Pilates sessions with personalized coaching at Storm Wellness Club in Livonia, MI.`,
    h1: `Semi-Private Training`,
    body: `<p>Train with a coach and a small group. Personalized programming with the energy and accountability of a group setting.</p>`,
  },

  "/amenities": {
    title: `Luxury Gym Amenities in Livonia, MI — Sauna, Steam, Cold Plunge | ${BRAND}`,
    description: `Sauna, steam room, cold plunge, infrared sauna, salt room, Starpool ZeroBody, outdoor terrace, premium locker rooms, and towel service at Storm Wellness Club.`,
    h1: `Luxury Gym Amenities in Livonia, MI`,
    body: `<p>Premium amenities under one roof: dry sauna, steam room, cold plunge, infrared sauna, <a href="/spa/salt-room">salt room</a>, <a href="/spa/zerobody">Starpool ZeroBody</a>, premium locker rooms with towel service, outdoor terrace, and an in-house <a href="/cafe">healthy café</a>.</p>`,
  },

  "/kids-care": {
    title: `Kids Care & Childcare in Livonia, MI — Ages 4 months to 8 years | ${BRAND}`,
    description: `Supervised childcare while you train at Storm Wellness Club in Livonia, MI. Little Stars (4 mo–1 yr) and Big Stars (5–8 yr) rooms with experienced staff.`,
    h1: `Kids Care in Livonia, MI`,
    body: `<p>Supervised childcare for members' kids ages 4 months to 8 years. Two age-appropriate rooms — Little Stars and Big Stars — staffed by experienced caregivers.</p>`,
  },

  "/guest-pass": {
    title: `Day Guest Pass in Livonia, MI | ${BRAND}`,
    description: `Try Storm Wellness Club with a day guest pass. Full facility access including classes (subject to availability), recovery amenities, and the café.`,
    h1: `Day Guest Pass`,
    body: `<p>Experience the club with a guest day pass: gym floor, classes (subject to availability), locker rooms, sauna, steam, and the café. <a href="/guest-pass">Book a guest pass</a>.</p>`,
  },
};

let count = 0;
for (const [path, page] of Object.entries(PAGES)) {
  const url = `${SITE}${path}`;
  const fullTitle = page.title;
  const desc = page.description;
  const ogType = page.ogType || "website";
  const schemas = page.schema || [];

  // Replace <title>
  let html = shell.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);

  // Replace meta description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(desc)}" />`,
  );

  // Replace og:title / og:description / og:url (keep og:image as-is)
  html = html
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeAttr(fullTitle)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeAttr(desc)}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${ogType}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeAttr(fullTitle)}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeAttr(desc)}" />`);

  // Inject canonical + per-page JSON-LD before </head>
  const extras = [
    `<link rel="canonical" href="${url}" />`,
    ...schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`),
  ].join("\n    ");
  html = html.replace("</head>", `    ${extras}\n  </head>`);

  // Inject crawlable body content INSIDE #root so crawlers see it before
  // React hydrates and replaces it. We hide it visually to avoid a flash
  // before hydration, but keep it readable by crawlers.
  const seoBody = `
      <div id="seo-prerender" style="position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
        <h1>${page.h1}</h1>
        ${page.body}
        ${navLinks}
        ${footer}
      </div>`;
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${seoBody}</div>`,
  );

  // Write to dist/<path>/index.html (root writes to dist/index.html — already there, overwrite)
  const outDir = path === "/" ? DIST : join(DIST, path.replace(/^\//, ""));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
  count++;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));
}

console.log(`[prerender] wrote ${count} route HTML files into dist/`);
