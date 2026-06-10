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
      subhead="Private coaching built around your goals — strength, conditioning, fat loss, post-rehab, or sport-specific performance."
      body={[
        "Our 1:1 personal training program pairs you with a credentialed coach who programs every session around your body, your history, and what you actually want to feel like in six months.",
        "Sessions blend strength, conditioning, and mobility on premium equipment in a focused, no-nonsense environment. You'll have a written plan, real progressions, and someone in your corner.",
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
