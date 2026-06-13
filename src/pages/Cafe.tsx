import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";

export default function Cafe() {
  return (
    <Layout>
      <SEOHead
        title="Healthy Café in Livonia, MI"
        description="Smoothies, protein shakes, acai bowls, cold-pressed juices, and coffee at Storm Wellness Club's in-house café in Livonia, MI."
        path="/cafe"
      />
      <CafeOrderContent variant="public" showHero />
    </Layout>
  );
}
