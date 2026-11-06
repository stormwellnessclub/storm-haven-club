import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";

const BASE_URL = "https://stormwellnessclub.com";

const cafeFaqs = [
  {
    q: "Is the Storm Café open to non-members?",
    a: "Yes — the café is open to the public during club hours. Walk in, order at the kiosk, and we'll have it ready.",
  },
  {
    q: "Is the café open for breakfast?",
    a: "Yes — we open with the club each morning and serve breakfast smoothies, açaí bowls, espresso, and grab-and-go bites.",
  },
  {
    q: "Do you offer dairy-free, vegan, or gluten-free options?",
    a: "Yes. Most smoothies, açaí bowls, and cold-pressed juices are dairy-free by default, with plant-based protein and oat or almond milk swaps on request. Many bowls and snacks are gluten-free — check the menu tags.",
  },
  {
    q: "What's in the protein shakes?",
    a: "Clean whey or plant-based protein, real fruit, nut or oat milk, and optional add-ins like nut butter, greens, or collagen — 25–35g of protein per shake, no powdered fillers.",
  },
  {
    q: "Can I order ahead?",
    a: "Yes — members can order ahead from the member portal, and walk-ins can order at the kiosk. Most drinks are ready in 5–8 minutes.",
  },
];


export default function Cafe() {
  const restaurantLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: "Storm Wellness Café",
    hasMenu: `${BASE_URL}/cafe#cafe-menu`,
    image: `${BASE_URL}/pwa-512x512.png`,
    url: `${BASE_URL}/cafe`,
        servesCuisine: [
      "Smoothies",
      "Protein Shakes",
      "Açaí Bowls",
      "Cold-Pressed Juice",
      "Coffee",
      "Café food",
    ],
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "18340 Middlebelt Rd",
      addressLocality: "Livonia",
      addressRegion: "MI",
      postalCode: "48152",
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 42.4034,
      longitude: -83.3497,
    },
    acceptsReservations: false,
    parentOrganization: {
      "@type": "HealthClub",
      name: "Storm Wellness Club",
      url: BASE_URL,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Café", item: `${BASE_URL}/cafe` },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cafeFaqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Layout>
      <SEOHead
        title="Storm Wellness Café | Coffee, Smoothies & Café in Livonia, MI"
        description="Visit Storm Wellness Café in Livonia for espresso, functional smoothies, chia pudding, toast and café bites. Open to members and the public."
        path="/cafe"
        image="/og/og-cafe.jpg"
        imageAlt="Smoothies and café food at Storm Wellness Café"
      />

      <Helmet>
        <script type="application/ld+json">{JSON.stringify(restaurantLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      <div className="pt-20">
        <CafeOrderContent variant="public" showHero />
      </div>
    </Layout>
  );
}
