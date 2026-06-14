import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function Cryotherapy() {
  return (
    <ServiceLandingPage
      title="Cryotherapy Near Me — Livonia, MI"
      description="Whole-body cryotherapy near Livonia, MI. 3-minute cold exposure at Storm Wellness Club for recovery, inflammation, energy, and resilience."
      path="/spa/cryotherapy"
      serviceName="Whole-Body Cryotherapy"
      h1="Cryotherapy Near Livonia, MI"
      subhead="A 3-minute whole-body cold exposure that supports recovery, reduces inflammation, and leaves you energized — at Storm Wellness Club in Livonia, Michigan, serving the greater Detroit metro."
      body={[
        "Whole-body cryotherapy briefly exposes your skin to extremely cold air, triggering a powerful recovery response: vasoconstriction, then vasodilation, with a release of endorphins and norepinephrine.",
        "Athletes, busy professionals, and members across the Detroit metro use cryo for faster post-workout recovery, joint comfort, mental clarity, and a noticeable mood lift that lasts for hours.",
        "Searching for cryotherapy near me? Storm Wellness Club is the most complete recovery destination in Livonia and is a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, and Southfield. We combine cryo with our full recovery suite — red light therapy, infrared sauna, cold plunge, salt room, and Starpool ZeroBody — for a complete contrast and recovery experience.",
      ]}
      benefits={[
        "Supports faster recovery from training and soreness",
        "May reduce inflammation and joint discomfort",
        "Boosts energy, focus, and mood after each session",
        "Sessions are short — just 3 minutes",
        "No water, no shower needed",
      ]}
      faqs={[
        {
          q: "How cold is the cryotherapy chamber?",
          a: "Sessions typically run between -200°F and -240°F using cold air. You stay dry and the session lasts only 3 minutes.",
        },
        {
          q: "How much does cryotherapy cost near Livonia?",
          a: "Storm members receive monthly recovery credits that can be used for cryotherapy. Non-members can book single sessions — pricing is shown at checkout.",
        },
        {
          q: "Is cryotherapy safe?",
          a: "Cryotherapy is generally considered safe for healthy adults. We screen everyone before their first session and a trained staff member is present for every appointment.",
        },
        {
          q: "How often should I do cryotherapy?",
          a: "For recovery and inflammation, 2–4 sessions per week is a common rhythm. Some members do it daily.",
        },
        {
          q: "Who should not use cryotherapy?",
          a: "Cryo is not recommended for individuals with uncontrolled hypertension, severe heart conditions, pregnancy, or cold allergies. We screen everyone before their first session.",
        },
        {
          q: "Is cryotherapy included in membership?",
          a: "Storm members receive monthly recovery credits that can be used for cryotherapy sessions. Single sessions are also available.",
        },
      ]}
      related={[
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
        { to: "/spa/cold-plunge", label: "Cold Plunge" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/zerobody", label: "Starpool ZeroBody" },
        { to: "/cafe", label: "Refuel at Storm Café" },
      ]}
    />
  );
}
