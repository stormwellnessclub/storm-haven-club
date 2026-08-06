import Merch from "@/pages/Merch";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";

/**
 * Storm Shop — branded merch (merch_products) plus retail goods
 * (skincare, supplements, KITSCH, socks…) sold from the shop menu section.
 */
export default function StormShop() {
  return (
    <>
      <Merch />
      <CafeOrderContent variant="public" section="shop" showHero />
    </>
  );
}
