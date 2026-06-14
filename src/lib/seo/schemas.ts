/**
 * Schema.org JSON-LD builders.
 * All functions return plain objects. Render via <JsonLd> component or
 * directly inside <Helmet><script type="application/ld+json">.
 */

import { BUSINESS, BASE_URL } from "./business";

const ORG_ID = `${BASE_URL}/#organization`;
const PLACE_ID = `${BASE_URL}/#localbusiness`;
const WEBSITE_ID = `${BASE_URL}/#website`;

const dayMap: Record<string, string> = {
  Monday: "Monday",
  Tuesday: "Tuesday",
  Wednesday: "Wednesday",
  Thursday: "Thursday",
  Friday: "Friday",
  Saturday: "Saturday",
  Sunday: "Sunday",
};

export function buildOrganizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    url: BUSINESS.url,
    logo: BUSINESS.logo,
    image: BUSINESS.image,
    description: BUSINESS.description,
    email: BUSINESS.email,
    telephone: BUSINESS.telephone,
    foundingDate: BUSINESS.foundingDate,
    sameAs: BUSINESS.sameAs,
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: BUSINESS.telephone,
        contactType: "customer service",
        email: BUSINESS.email,
        areaServed: "US",
        availableLanguage: ["English"],
      },
    ],
    address: {
      "@type": "PostalAddress",
      ...BUSINESS.address,
    },
  };
}

export function buildLocalBusinessLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["HealthClub", "LocalBusiness", "SportsActivityLocation"],
    "@id": PLACE_ID,
    name: BUSINESS.name,
    description: BUSINESS.description,
    url: BUSINESS.url,
    logo: BUSINESS.logo,
    image: BUSINESS.image,
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    priceRange: BUSINESS.priceRange,
    currenciesAccepted: BUSINESS.currenciesAccepted,
    paymentAccepted: BUSINESS.paymentAccepted.join(", "),
    address: { "@type": "PostalAddress", ...BUSINESS.address },
    geo: { "@type": "GeoCoordinates", ...BUSINESS.geo },
    hasMap: `https://www.google.com/maps/search/?api=1&query=${BUSINESS.geo.latitude},${BUSINESS.geo.longitude}`,
    openingHoursSpecification: BUSINESS.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days.map((d) => dayMap[d]),
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: BUSINESS.areaServed.map((name) => ({ "@type": "City", name })),
    sameAs: BUSINESS.sameAs,
    parentOrganization: { "@id": ORG_ID },
  };
}

export function buildWebSiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: BUSINESS.url,
    name: BUSINESS.name,
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BUSINESS.url}/schedule?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: "en-US",
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string; // absolute path starting with /
}

export function buildBreadcrumbLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${BASE_URL}${it.path}`,
    })),
  };
}

export interface FAQ {
  q: string;
  a: string;
}

export function buildFAQLd(faqs: FAQ[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export interface ServiceLd {
  name: string;
  description: string;
  path: string;
  serviceType?: string;
}

export function buildServiceLd(s: ServiceLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    serviceType: s.serviceType ?? s.name,
    description: s.description,
    url: `${BASE_URL}${s.path}`,
    provider: { "@id": PLACE_ID },
    areaServed: BUSINESS.areaServed,
  };
}

export interface ProductOffer {
  name: string;
  description: string;
  path: string;
  price: number;
  priceCurrency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  image?: string;
  brand?: string;
  sku?: string;
  category?: string;
  aggregateRating?: { ratingValue: number; reviewCount: number };
}

export function buildProductLd(p: ProductOffer) {
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.image ?? BUSINESS.image,
    brand: { "@type": "Brand", name: p.brand ?? BUSINESS.name },
    sku: p.sku,
    category: p.category,
    offers: {
      "@type": "Offer",
      url: `${BASE_URL}${p.path}`,
      priceCurrency: p.priceCurrency ?? "USD",
      price: p.price.toFixed(2),
      availability: `https://schema.org/${p.availability ?? "InStock"}`,
      seller: { "@id": ORG_ID },
    },
  };
  if (p.aggregateRating) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.aggregateRating.ratingValue,
      reviewCount: p.aggregateRating.reviewCount,
    };
  }
  return obj;
}

export interface EventLd {
  name: string;
  startDate: string; // ISO
  endDate: string; // ISO
  description?: string;
  path: string;
  instructorName?: string;
  maxAttendees?: number;
  remainingAttendees?: number;
  price?: number;
  status?: "EventScheduled" | "EventCancelled" | "EventPostponed" | "EventRescheduled";
}

export function buildEventLd(e: EventLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.name,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
    eventStatus: `https://schema.org/${e.status ?? "EventScheduled"}`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: BUSINESS.name,
      address: { "@type": "PostalAddress", ...BUSINESS.address },
    },
    image: BUSINESS.image,
    url: `${BASE_URL}${e.path}`,
    organizer: { "@id": ORG_ID },
    ...(e.instructorName && {
      performer: { "@type": "Person", name: e.instructorName },
    }),
    ...(e.maxAttendees && { maximumAttendeeCapacity: e.maxAttendees }),
    ...(typeof e.remainingAttendees === "number" && {
      remainingAttendeeCapacity: e.remainingAttendees,
    }),
    ...(typeof e.price === "number" && {
      offers: {
        "@type": "Offer",
        price: e.price.toFixed(2),
        priceCurrency: "USD",
        availability:
          e.remainingAttendees && e.remainingAttendees > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
        url: `${BASE_URL}${e.path}`,
        validFrom: new Date().toISOString(),
      },
    }),
  };
}

export interface ArticleLd {
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  path: string;
}

export function buildArticleLd(a: ArticleLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.headline,
    description: a.description,
    image: [a.image],
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    author: { "@type": "Person", name: a.authorName },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}${a.path}` },
  };
}

export interface MenuItemLd {
  name: string;
  description?: string;
  price?: number;
  calories?: number;
  suitableForDiet?: string[];
}
export interface MenuSectionLd {
  name: string;
  items: MenuItemLd[];
}

export function buildMenuLd(sections: MenuSectionLd[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${BUSINESS.name} Café Menu`,
    hasMenuSection: sections.map((s) => ({
      "@type": "MenuSection",
      name: s.name,
      hasMenuItem: s.items.map((it) => ({
        "@type": "MenuItem",
        name: it.name,
        description: it.description,
        ...(typeof it.price === "number" && {
          offers: {
            "@type": "Offer",
            price: it.price.toFixed(2),
            priceCurrency: "USD",
          },
        }),
        ...(it.calories && {
          nutrition: {
            "@type": "NutritionInformation",
            calories: `${it.calories} calories`,
          },
        }),
        ...(it.suitableForDiet && { suitableForDiet: it.suitableForDiet }),
      })),
    })),
  };
}

export function buildAggregateRatingLd(ratingValue: number, reviewCount: number) {
  return {
    "@type": "AggregateRating",
    ratingValue: Number(ratingValue.toFixed(2)),
    reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}

export interface HowToStep {
  name: string;
  text: string;
}
export function buildHowToLd(name: string, steps: HowToStep[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}
