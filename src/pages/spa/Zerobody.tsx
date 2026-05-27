import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function Zerobody() {
  return (
    <ServiceLandingPage
      title="Starpool ZeroBody Dry Float in Livonia, MI"
      description="Starpool ZeroBody dry-float recovery pod at Storm Wellness Club in Livonia, MI. Weightless relaxation for stress, sleep, and recovery."
      path="/spa/zerobody"
      serviceName="Starpool ZeroBody Dry Float"
      h1="Starpool ZeroBody Dry Float in Livonia, MI"
      subhead="An Italian-engineered dry-float pod that suspends you on a warm membrane — delivering the benefits of float therapy without water, suits, or showering."
      body={[
        "Starpool ZeroBody is dry-float technology: you lie on a heated, body-conforming membrane that distributes pressure so evenly your body essentially stops sensing weight. The result is a 30-minute reset for your nervous system unlike anything else in the club.",
        "Members use it for stress recovery, sleep support, mental reset before a big day, and as a complement to massage or training. It's one of the most uniquely Storm experiences in our recovery suite.",
        "Storm Wellness Club is one of the few destinations in Michigan offering the Starpool ZeroBody — book ahead, it tends to fill quickly.",
      ]}
      benefits={[
        "Float-therapy benefits with no water and no showering",
        "30-minute deep nervous-system reset",
        "Supports stress recovery and sleep quality",
        "Warm, weightless, fully clothed",
        "Italian-engineered Starpool technology",
      ]}
      faqs={[
        {
          q: "Do I get wet?",
          a: "No — ZeroBody is a dry-float pod. You stay fully clothed and lie on a warm, body-conforming membrane.",
        },
        {
          q: "How long is the session?",
          a: "Standard sessions are 30 minutes. The first few minutes adjust the temperature; the rest is pure float.",
        },
        {
          q: "Can I book this as a non-member?",
          a: "Yes — recovery services are available to both members and guests. Members receive monthly recovery credits.",
        },
      ]}
      related={[
        { to: "/spa/massage", label: "Therapeutic Massage" },
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/salt-room", label: "Salt Room" },
      ]}
    />
  );
}
