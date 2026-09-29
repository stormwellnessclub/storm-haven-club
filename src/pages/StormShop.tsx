import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Merch from "@/pages/Merch";
import GiftCardStore from "@/pages/GiftCardStore";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";
import { SEOHead } from "@/components/SEOHead";
import { buildBreadcrumbLd, buildServiceLd } from "@/lib/seo/schemas";

const SECTIONS = [
  { id: "gift-cards", label: "Gift Cards" },
  { id: "apparel", label: "Apparel" },
  { id: "wellness", label: "Wellness & Skincare" },
];

export function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => clearTimeout(t);
  }, [hash]);
}

/** Storm Shop — gift cards, branded apparel and retail wellness goods on one page. */
export default function StormShop() {
  useScrollToHash();

  return (
    <Layout>
      <SEOHead
        title="Storm Shop — Gift Cards, Activewear & Skincare in Livonia"
        description="Send a Storm Wellness Club gift card, or shop our apparel, recovery skincare and supplements. Order online for pickup in Livonia, MI."
        path="/shop"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Storm Shop", path: "/shop" },
          ]),
          buildServiceLd({
            name: "Storm Shop",
            serviceType: "Retail Store",
            description:
              "Gift cards, branded activewear, recovery skincare, supplements, and wellness essentials at Storm Wellness Club in Livonia, Michigan.",
            path: "/shop",
          }),
        ]}
      />

      <section className="bg-primary text-primary-foreground pt-36 pb-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-4">Storm Wellness Club</p>
          <h1 className="font-serif text-5xl md:text-6xl">The Storm Shop</h1>
          <p className="mx-auto mt-5 max-w-xl text-primary-foreground/70 leading-relaxed">
            Gifts for someone you love, pieces we wear every day, and the essentials we trust.
          </p>
        </div>
      </section>

      <nav className="sticky top-20 sm:top-24 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex justify-center gap-6 sm:gap-10 px-6 py-4 overflow-x-auto">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div id="gift-cards" className="scroll-mt-40">
        <GiftCardStore embedded />
      </div>

      <div id="apparel" className="scroll-mt-40 border-t border-border">
        <Merch embedded />
      </div>

      <div id="wellness" className="scroll-mt-40 border-t border-border">
        <CafeOrderContent variant="public" section="shop" />
      </div>
    </Layout>
  );
}
