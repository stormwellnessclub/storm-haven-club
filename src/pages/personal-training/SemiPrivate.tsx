import PersonalTrainingPage from "./PersonalTrainingPage";

export default function SemiPrivate() {
  return (
    <PersonalTrainingPage
      title="Semi-Private Training (Up to 4) in Livonia, MI"
      description="Semi-private personal training and Pilates sessions for groups of 2 to 4 at Storm Wellness Club in Livonia, MI."
      path="/personal-training/semi-private"
      serviceName="Semi-Private Training"
      defaultService="semi_private"
      h1="Semi-Private Training — Up to 4"
      subhead="Train with friends or family in a focused small-group setting. Capped at 4 so every rep still gets coached."
      body={[
        "Semi-private sessions blend the accountability of personal training with the energy of a small group. You and up to three guests work with one coach who programs each session for the group's goals and abilities.",
        "Bring an existing crew or let us help match you with compatible training partners. Available for strength, Pilates, and cycling formats.",
      ]}
      whoFor={[
        "Couples, friends, or family members training together",
        "Small workplace groups",
        "Members who want a more affordable coaching option",
        "Anyone who trains better with company",
      ]}
      faqs={[
        {
          q: "What's the maximum group size?",
          a: "Four people per session, plus the coach. Capping at four keeps cueing personal and the energy tight.",
        },
        {
          q: "Do all four people pay separately?",
          a: "Pricing is per person and confirmed when your coach reaches out. Group rates are significantly less per person than private sessions.",
        },
        {
          q: "Can we mix experience levels?",
          a: "Yes. Your coach scales each exercise so newer and more experienced participants both get a great session.",
        },
      ]}
    />
  );
}
