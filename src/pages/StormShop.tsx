import Merch from "@/pages/Merch";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";
import { SEOHead } from "@/components/SEOHead";
import { buildBreadcrumbLd, buildServiceLd } from "@/lib/seo/schemas";

/**
 * Storm Shop — branded merch (merch_products) plus retail goods
 * (skincare, supplements, KITSCH, socks…) sold from the shop menu section.
 */
export default function StormShop() {
  return (
    <>
      <SEOHead
        title="Storm Shop — Activewear, Skincare & Supplements in Livonia"
        description="Shop Storm Wellness Club apparel, recovery skincare, supplements, and studio essentials. Order online for pickup in Livonia, MI — open to the public."
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
              "Branded activewear, recovery skincare, supplements, and wellness essentials available for pickup at Storm Wellness Club in Livonia, Michigan.",
            path: "/shop",
          }),
        ]}
      />
      <Merch />
      <CafeOrderContent variant="public" section="shop" showHero />
    </>
  );
}
