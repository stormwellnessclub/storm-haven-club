import ServiceLandingPage from "@/components/seo/ServiceLandingPage";

export default function Massage() {
  return (
    <ServiceLandingPage
      title="Massage Near Me — Livonia, MI"
      description="Massage near Livonia, MI. Swedish, deep tissue, sports, and prenatal massage at Storm Wellness Club — licensed therapists, book online."
      path="/spa/massage"
      serviceName="Therapeutic Massage"
      h1="Massage Therapy Near Livonia, MI"
      subhead="Licensed therapists, premium treatment rooms, and a booking flow that takes 60 seconds — open to members and guests in Livonia, MI and the greater Detroit metro."
      body={[
        "Storm Wellness Club's massage program is built around licensed therapists, premium treatment rooms, and a quiet, considered environment. We offer Swedish, deep tissue, sports, and prenatal modalities at 60 and 90-minute lengths.",
        "Members receive tier-based discounts (5–12% off) on every massage. Non-members are warmly welcome — simply create a portal account, sign the waiver, and book.",
        "Searching for a massage near you? Storm is centrally located at 18340 Middlebelt Rd in Livonia — a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Garden City, and Southfield. Pair your massage with the sauna, cold plunge, or red light therapy for a complete recovery afternoon.",
      ]}
      benefits={[
        "Licensed, experienced therapists",
        "Swedish, deep tissue, sports, and prenatal modalities",
        "60 and 90-minute sessions",
        "Member discounts of 5–12% by tier",
        "Premium private treatment rooms",
      ]}
      faqs={[
        {
          q: "How much does a massage cost in Livonia?",
          a: "Pricing varies by modality and length (60 vs 90 minutes). Current rates are shown at booking, and Storm members receive 5–12% off depending on tier.",
        },
        {
          q: "Do I need to be a member to book a massage?",
          a: "No — both members and non-members can book. Non-members create a portal account and sign a waiver before the first appointment.",
        },
        {
          q: "What modalities do you offer?",
          a: "Swedish, deep tissue, sports, and prenatal massage in 60 and 90-minute formats. Special add-ons are available at booking.",
        },
        {
          q: "How do I book a massage near me?",
          a: "Visit our spa booking page, select a service and therapist, and complete the booking online. You'll receive a confirmation by email and text.",
        },
        {
          q: "Are gift cards or vouchers accepted?",
          a: "Yes — vouchers from our seasonal promotions and gifted certificates redeem at checkout with the voucher code.",
        },
      ]}
      ctaHref="/spa?category=Massage"
      ctaLabel="Book a Massage"
      related={[
        { to: "/spa/zerobody", label: "Starpool ZeroBody" },
        { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
        { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
        { to: "/spa/sauna-steam", label: "Sauna & Steam Room" },
        { to: "/cafe", label: "Refuel at Storm Café" },
      ]}
    />
  );
}
