import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function ColdPlunge() {
  return (
    <ServiceLandingPage
      title="Cold Plunge in Livonia, MI"
      description="Cold plunge therapy at Storm Wellness Club in Livonia, MI. Cold-water immersion for recovery, inflammation, focus, and resilience."
      path="/spa/cold-plunge"
      serviceName="Cold Plunge"
      h1="Cold Plunge in Livonia, MI"
      subhead="Controlled cold-water immersion to sharpen focus, reduce inflammation, and accelerate recovery — every visit, on your schedule."
      body={[
        "A cold plunge is one of the most effective recovery tools available. Two to three minutes in cold water triggers a cascade of physiological benefits: reduced muscle inflammation, sharper focus, and a sustained release of dopamine and norepinephrine.",
        "At Storm Wellness Club, our cold plunge is maintained at recovery-grade temperatures and integrated into the same recovery suite as our infrared sauna, red light therapy, and cryotherapy.",
        "Members across Livonia, Plymouth, Northville, Farmington Hills, and the greater Detroit metro use the cold plunge daily — many alternating with the sauna for contrast therapy.",
      ]}
      benefits={[
        "Supports muscle recovery and reduces soreness",
        "Boosts mood and focus for hours after",
        "May reduce inflammation and joint discomfort",
        "Trains stress resilience and nervous system control",
        "Excellent paired with sauna for contrast therapy",
      ]}
      faqs={[
        {
          q: "How cold is the plunge?",
          a: "Our cold plunge is kept in the standard recovery range — cold enough to deliver the benefits without being unsafe. Start with 1–2 minutes and build up.",
        },
        {
          q: "How long should I stay in?",
          a: "Most members do 2–3 minutes per session. Even 60 seconds delivers meaningful benefits.",
        },
        {
          q: "Can I combine it with the sauna?",
          a: "Yes — alternating between hot (sauna) and cold (plunge) is called contrast therapy and is one of the most effective recovery protocols.",
        },
      ]}
      related={[
        { to: "/spa/cryotherapy", label: "Cryotherapy" },
        { to: "/spa/sauna-steam", label: "Sauna & Steam Room" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
      ]}
    />
  );
}
