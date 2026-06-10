import PersonalTrainingPage from "./PersonalTrainingPage";

export default function SemiPrivate() {
  return (
    <PersonalTrainingPage
      title="Semi-Private Personal Training (Groups of 3–4) in Livonia, MI"
      description="Semi-private personal training in small groups of 3 to 4. Each workout is customized for the individual based on goal and level. Storm Wellness Club, Livonia, MI."
      path="/personal-training/semi-private"
      serviceName="Semi-Private Training"
      defaultService="semi_private"
      pricingFormat="semi_private"
      membersOnly
      h1="Semi-Private Training — Groups of 3–4"
      subhead="Small groups of 3 to 4. Each workout is customized for the individual based on their goal and level."
      body={[
        "Semi-private pairs you with two or three other members under one coach. Everyone trains at the same time, but the plan, the load, and the cues are programmed individually — for your goal, your level, and what your body needs that day.",
        "It's the accountability of personal training at a friendlier per-session price. Bring your own group, or let us match you with members who train at a similar level.",
      ]}
      whoFor={[
        "Members who want personal programming with a small-group price",
        "Couples, friends, or family training together",
        "Mixed-level groups — beginners and experienced train side by side",
        "Anyone who trains more consistently with company",
      ]}
      faqs={[
        {
          q: "Do I need to be a member?",
          a: "Yes — Semi-Private Training is reserved for active Storm Wellness Club members. Every participant in the group must be a member.",
        },
        {
          q: "How big is the group?",
          a: "Three to four members per session, plus the coach. The cap keeps every person individually coached.",
        },
        {
          q: "Is everyone doing the same workout?",
          a: "No. Each person gets their own plan based on their goal and level. The coach runs the group together but progresses each member individually.",
        },
        {
          q: "Does everyone pay separately?",
          a: "Yes — pricing is per person and confirmed when your coach reaches out. The per-session rate is meaningfully lower than 1:1.",
        },
      ]}
    />
  );
}
