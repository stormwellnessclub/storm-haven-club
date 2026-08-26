import { Navigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

export default function Classes() {
  return (
    <>
      <SEOHead
        title="Reformer Pilates, Cycling & Yoga Classes in Livonia, MI"
        description="Reformer Pilates (heated & non-heated), Indoor Cycling, Yoga, Barre, HIIT and Sculpt classes at Storm Wellness Club in Livonia, MI. Book online — class passes available."
        path="/classes"
        image="/og/og-classes.jpg"
        imageAlt="Reformer Pilates studio at Storm Wellness Club in Livonia, Michigan"
      />
      <Navigate to="/schedule" replace />
    </>
  );
}
