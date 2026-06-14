import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function InfraredSauna() {
  return (
    <ServiceLandingPage
      title="Infrared Sauna Near Me — Livonia, MI"
      description="Infrared sauna near Livonia, MI. Far-infrared sessions at Storm Wellness Club for detox, recovery, cardiovascular health, and stress relief."
      path="/spa/infrared-sauna"
      serviceName="Infrared Sauna"
      h1="Infrared Sauna Near Livonia, MI"
      subhead="Deep, penetrating heat that warms your body from the inside — supporting cardiovascular health, detoxification, and post-training recovery in Livonia and the greater Detroit metro."
      body={[
        "Unlike traditional saunas that heat the air around you, infrared saunas use light to gently warm your body directly. The result is a deeper sweat at a more comfortable ambient temperature.",
        "Storm Wellness Club members and recovery guests use the infrared sauna for cardiovascular conditioning, relaxation, post-workout recovery, and as a quiet 30-minute reset in the middle of a busy day.",
        "Looking for an infrared sauna near you? Located inside our circular wellness building in Livonia, the infrared sauna is part of a full recovery circuit alongside cold plunge, red light therapy, cryotherapy, and the salt room — a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, and Southfield.",
      ]}
      benefits={[
        "Cardiovascular conditioning similar to light cardio",
        "Deep sweat at a more comfortable temperature",
        "Supports muscle recovery and relaxation",
        "Calming pre-sleep ritual",
        "Pairs beautifully with cold plunge for contrast therapy",
      ]}
      faqs={[
        {
          q: "How is infrared sauna different from a traditional sauna?",
          a: "Infrared saunas use light to heat your body directly rather than heating the surrounding air. You get a deeper sweat at lower ambient temperatures.",
        },
        {
          q: "How often should I use an infrared sauna?",
          a: "Many members use the infrared sauna 3–5 times per week for 30–45 minutes per session. Listen to your body, stay hydrated, and step out if you ever feel lightheaded.",
        },
        {
          q: "What should I wear in the infrared sauna?",
          a: "Wear minimal, breathable clothing so the infrared light can reach as much skin as possible. Bring water and a towel — both are provided at the club.",
        },
        {
          q: "How long is a session?",
          a: "Most sessions run 30–45 minutes. Hydrate well before and after.",
        },
        {
          q: "Can I use it daily?",
          a: "Many members use the infrared sauna 3–5 times per week. Listen to your body and stay well-hydrated.",
        },
      ]}
      related={[
        { to: "/spa/cold-plunge", label: "Cold Plunge" },
        { to: "/spa/sauna-steam", label: "Sauna & Steam Room" },
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
        { to: "/spa/salt-room", label: "Salt Room" },
        { to: "/cafe", label: "Refuel at Storm Café" },
      ]}
    />
  );
}
