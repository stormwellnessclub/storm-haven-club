/**
 * SINGLE SOURCE OF TRUTH for business info used in SEO schemas (JSON-LD)
 * and any other place that needs NAP (name, address, phone) data.
 *
 * Edit values here and they propagate everywhere — index.html schemas,
 * per-page schemas, breadcrumbs, og tags, etc.
 *
 * After editing, you also need to update index.html manually because
 * static HTML is rendered at build time (the React schema builders
 * import this file directly and stay in sync automatically).
 */

export const BUSINESS = {
  name: "Storm Wellness Club",
  legalName: "Storm Wellness Club", // DBA — update if formal LLC name differs
  url: "https://stormwellnessclub.com",
  logo: "https://stormwellnessclub.com/pwa-512x512.png",
  image: "https://stormwellnessclub.com/pwa-512x512.png",
  description:
    "Premium fitness and wellness club in Livonia, Michigan offering Reformer Pilates, Indoor Cycling, Yoga, Recovery Spa, Café, and Kids Care.",
  telephone: "+1-248-232-8487",
  email: "contact@stormwellnessclub.com",
  priceRange: "$$",
  foundingDate: "2024",
  address: {
    streetAddress: "18340 Middlebelt Rd",
    addressLocality: "Livonia",
    addressRegion: "MI",
    postalCode: "48152",
    addressCountry: "US",
  },
  geo: {
    latitude: 42.4034,
    longitude: -83.3497,
  },
  /** Mirrors src/components/Footer.tsx clubHours */
  openingHours: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday"], opens: "05:30", closes: "23:00" },
    { days: ["Friday"], opens: "05:30", closes: "20:00" },
    { days: ["Saturday", "Sunday"], opens: "07:00", closes: "19:00" },
  ],
  paymentAccepted: ["Cash", "Credit Card", "Debit Card", "Apple Pay", "Google Pay"],
  currenciesAccepted: "USD",
  areaServed: [
    "Livonia, MI",
    "Detroit, MI",
    "Dearborn, MI",
    "Farmington Hills, MI",
    "Redford, MI",
    "Garden City, MI",
    "Westland, MI",
    "Plymouth, MI",
    "Canton, MI",
    "Northville, MI",
    "Novi, MI",
    "Southfield, MI",
  ],
  sameAs: [
    "https://www.instagram.com/stormwellnessclub",
    "https://www.facebook.com/stormwellnessclub",
  ],
} as const;

export const BASE_URL = BUSINESS.url;
