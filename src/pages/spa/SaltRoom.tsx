import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function SaltRoom() {
  return (
    <ServiceLandingPage
      title="Salt Room (Halotherapy) Near Me — Livonia, MI"
      description="Salt room halotherapy near Livonia, MI. Dry salt therapy at Storm Wellness Club for respiratory wellness, skin health, and deep relaxation."
      path="/spa/salt-room"
      serviceName="Salt Room Halotherapy"
      h1="Salt Room Halotherapy Near Livonia, MI"
      subhead="A dedicated salt room delivering micronized pharmaceutical-grade salt into the air — supporting respiratory wellness, skin health, and deep nervous-system rest in Livonia, MI."
      body={[
        "Halotherapy — dry salt therapy — has been used for over a century to support respiratory wellness and skin clarity. Our salt room delivers ultra-fine salt particles into the air, where they're inhaled and absorbed during a quiet 25-minute session.",
        "Storm members visit the salt room for seasonal allergies, sinus support, post-illness recovery, and as a meditative way to recover after a busy week.",
        "Looking for a salt room near you? Storm Wellness Club is one of the few dedicated halotherapy rooms in the western Detroit metro — a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, and Southfield. Combine the salt room with red light therapy or infrared sauna for an even more layered recovery experience.",
      ]}
      benefits={[
        "Supports clear breathing and respiratory wellness",
        "May help skin conditions like eczema and acne",
        "Quiet, meditative, screen-free environment",
        "Gentle enough for most members",
        "Pairs well with sauna and red light therapy",
      ]}
      faqs={[
        {
          q: "What is halotherapy?",
          a: "Halotherapy is the practice of breathing micronized dry salt particles in a controlled environment. It has roots in central European salt-cave traditions.",
        },
        {
          q: "What are the benefits of a salt room?",
          a: "Members report easier breathing during allergy season, calmer sinuses, improved skin tone, and a deep sense of relaxation. Halotherapy is gentle enough for most adults and children.",
        },
        {
          q: "How long is a session?",
          a: "Sessions are typically 25 minutes — long enough to relax fully and benefit from the salt-rich air.",
        },
      ]}
      related={[
        { to: "/spa/sauna-steam", label: "Sauna & Steam Room" },
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/zerobody", label: "Starpool ZeroBody" },
        { to: "/cafe", label: "Refuel at Storm Café" },
      ]}
    />
  );
}
