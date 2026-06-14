import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function SaunaSteam() {
  return (
    <ServiceLandingPage
      title="Sauna & Steam Room Near Me — Livonia, MI"
      description="Traditional dry sauna and eucalyptus steam room near Livonia, MI. Recovery, relaxation, and respiratory wellness at Storm Wellness Club."
      path="/spa/sauna-steam"
      serviceName="Sauna and Steam Room"
      h1="Sauna & Steam Room Near Livonia, MI"
      subhead="Traditional dry sauna and eucalyptus steam room — quiet, restorative, and built into the rhythm of every Storm Wellness Club visit in Livonia, MI."
      body={[
        "There's a reason the sauna has been a recovery ritual for centuries. Heat dilates blood vessels, relaxes muscle tissue, and gives your nervous system a chance to fully downshift.",
        "Storm Wellness Club features both a traditional dry sauna and a moist steam room — each with thoughtful lighting, premium materials, and the quiet our members come back for.",
        "Looking for a sauna or steam room near you? Storm is centrally located in Livonia, MI — a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, and Southfield. Use them after class, between meetings, or as the closing act of a full recovery circuit with cold plunge, red light, and the salt room.",
      ]}
      benefits={[
        "Relaxes muscles after training",
        "Supports respiratory wellness (steam room)",
        "Encourages quiet, screen-free downtime",
        "Pairs perfectly with cold plunge",
        "Open during all member hours",
      ]}
      faqs={[
        {
          q: "What's the difference between the sauna and steam room?",
          a: "The dry sauna uses high-temperature dry heat (around 180°F). The steam room uses lower-temperature moist heat (around 110°F) with near-100% humidity — better for sinuses and respiratory wellness.",
        },
        {
          q: "How long should I stay in?",
          a: "10–20 minutes is typical. Listen to your body, hydrate, and step out if you ever feel lightheaded.",
        },
        {
          q: "Do I need a membership to use the sauna and steam room?",
          a: "The sauna and steam room are included with active Storm Wellness Club membership. Day passes and guest passes also include sauna and steam access.",
        },
      ]}
      related={[
        { to: "/spa/cold-plunge", label: "Cold Plunge" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/salt-room", label: "Salt Room" },
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
        { to: "/cafe", label: "Refuel at Storm Café" },
      ]}
    />
  );
}
