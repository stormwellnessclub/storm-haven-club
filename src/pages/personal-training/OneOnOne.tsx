import PersonalTrainingPage from "./PersonalTrainingPage";

export default function OneOnOne() {
  return (
    <PersonalTrainingPage
      title="1:1 Personal Training in Livonia, MI"
      description="Private personal training at Storm Wellness Club in Livonia. Strength, conditioning, and accountability with a dedicated coach."
      path="/personal-training/one-on-one"
      serviceName="1:1 Personal Training"
      defaultService="one_on_one"
      pricingFormat="one_on_one"
      membersOnly
      h1="1:1 Personal Training"
      subhead="Private coaching programmed around your goal and your current level — strength, conditioning, fat loss, post-rehab, or sport-specific."
      body={[
        "Your coach builds a plan from where you are today, then progresses it week to week. Strength, conditioning, mobility, and recovery work — sequenced to your goal, scaled to your body.",
        "Sessions are private, focused, and tracked. You'll know what you did, why you did it, and what's coming next.",
      ]}
      whoFor={[
        "Brand-new to training and want to learn properly",
        "Returning after injury, surgery, or pregnancy",
        "Plateaued on your own and want real progress",
        "Athletes preparing for a season or event",
      ]}
      faqs={[
        {
          q: "How long are sessions?",
          a: "Standard sessions are 60 minutes. 30-minute follow-up formats are available once you're established.",
        },
        {
          q: "Do I need to be a member?",
          a: "Yes — 1:1 Personal Training is reserved for active Storm Wellness Club members. If you're not a member yet, you can apply for membership, or book Private Pilates on the Reformer, which is open to everyone.",
        },
        {
          q: "What if I cancel?",
          a: "We ask for 24 hours notice. Same-day cancellations are charged at full rate.",
        },
      ]}
    />
  );
}
