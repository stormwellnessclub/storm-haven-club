import PersonalTrainingPage from "./PersonalTrainingPage";

export default function PrivateCycling() {
  return (
    <PersonalTrainingPage
      title="Private Cycling Coaching in Livonia, MI"
      description="Private indoor cycling coaching at Storm Wellness Club in Livonia, MI. Form, power, and pacing with a certified instructor."
      path="/personal-training/private-cycling"
      serviceName="Private Cycling"
      defaultService="private_cycling"
      h1="Private Cycling"
      subhead="Indoor cycling, coached one-on-one. Build form, power, and pacing without the pressure of a class."
      body={[
        "Private cycling sessions are perfect for riders who want personalized instruction on bike setup, cadence, resistance, and pacing — or for first-timers who'd rather learn the studio before joining a group ride.",
        "Sessions can be programmed for endurance, intervals, climb work, or general conditioning. Bring your goals; we'll bring the playlist.",
      ]}
      whoFor={[
        "New riders who want to learn proper setup and form",
        "Outdoor cyclists training through the winter",
        "Members building toward joining group rides",
        "Anyone who prefers focused, individual coaching",
      ]}
      faqs={[
        {
          q: "What should I wear?",
          a: "Athletic gear and supportive sneakers. Cycling shoes are welcome — our bikes accept both SPD clips and standard cages.",
        },
        {
          q: "How long are sessions?",
          a: "45 or 60 minutes. We can also blend cycling with strength work if you'd like.",
        },
      ]}
    />
  );
}
