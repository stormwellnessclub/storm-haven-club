import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function RedLightTherapy() {
  return (
    <ServiceLandingPage
      title="Red Light Therapy in Livonia, MI"
      description="Full-body red light and near-infrared therapy at Storm Wellness Club in Livonia, MI. Supports recovery, skin health, sleep, and inflammation."
      path="/spa/red-light-therapy"
      serviceName="Red Light Therapy"
      h1="Red Light Therapy in Livonia, MI"
      subhead="Full-body red and near-infrared light sessions designed to support recovery, skin health, and cellular energy — inside the Storm Wellness Club recovery suite."
      body={[
        "Red light therapy (photobiomodulation) uses specific wavelengths of red and near-infrared light to stimulate the mitochondria in your cells. Members and guests at Storm Wellness Club use it after training, before sleep, or as a standalone recovery ritual.",
        "Our panels deliver clinical-grade wavelengths in the 630–850nm range — the same band used in published research on muscle recovery, joint comfort, and skin appearance. Sessions are short, dry, and require no downtime.",
        "Storm is the most complete recovery destination in Livonia and the greater Detroit metro. Red light pairs naturally with our cold plunge, infrared sauna, and Starpool ZeroBody for a full recovery circuit.",
      ]}
      benefits={[
        "Supports post-workout muscle recovery",
        "Promotes skin tone and collagen production",
        "May support better sleep when used in the evening",
        "Comfortable, non-invasive, no UV exposure",
        "Pairs well with cryotherapy and infrared sauna",
      ]}
      faqs={[
        {
          q: "How long is a red light therapy session?",
          a: "Most sessions run 10–20 minutes. We recommend 2–3 sessions per week for consistent results.",
        },
        {
          q: "Do I need a membership to use red light therapy?",
          a: "Storm members receive monthly recovery credits that include red light therapy. Non-members can book single sessions through our recovery booking.",
        },
        {
          q: "Is red light therapy safe?",
          a: "Yes — red and near-infrared light therapy is non-invasive, contains no UV radiation, and is widely considered safe for daily use.",
        },
        {
          q: "What should I wear?",
          a: "Wear as little as you are comfortable with — the more skin exposed to the light, the more effective the session.",
        },
      ]}
      related={[
        { to: "/spa/cryotherapy", label: "Cryotherapy" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/cold-plunge", label: "Cold Plunge" },
        { to: "/spa/zerobody", label: "Starpool ZeroBody" },
      ]}
    />
  );
}
