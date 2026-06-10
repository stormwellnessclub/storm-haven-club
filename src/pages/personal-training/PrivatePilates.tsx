import PersonalTrainingPage from "./PersonalTrainingPage";

export default function PrivatePilates() {
  return (
    <PersonalTrainingPage
      title="Private Pilates (Reformer) in Livonia, MI"
      description="Private reformer Pilates with certified instructors at Storm Wellness Club in Livonia, MI."
      path="/personal-training/private-pilates"
      serviceName="Private Pilates"
      defaultService="private_pilates"
      h1="Private Pilates — Reformer"
      subhead="One-on-one reformer Pilates with a certified instructor. Precise, scalable, and tailored to your body."
      body={[
        "Private reformer sessions are the fastest way to build a strong, confident Pilates practice. Your instructor designs every spring, every transition, and every cue specifically for you.",
        "Ideal for true beginners who want to learn the apparatus, experienced practitioners working through a specific goal, and anyone managing an injury or post-natal return.",
      ]}
      whoFor={[
        "First-time reformer clients who want personal instruction",
        "Pre- and post-natal practitioners",
        "Returning from injury or chronic pain",
        "Experienced practitioners refining technique",
      ]}
      faqs={[
        {
          q: "How is this different from a reformer class?",
          a: "Classes run up to 8 reformers with one instructor. Private sessions are 1:1, so the entire hour is programmed and cued for you specifically.",
        },
        {
          q: "Do I need experience?",
          a: "No. Privates are an excellent first introduction to the reformer.",
        },
        {
          q: "Can I bring a friend?",
          a: "Yes — see Semi-Private for sessions of 2 to 4 people.",
        },
      ]}
    />
  );
}
