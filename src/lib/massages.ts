interface MassageVariant {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  is_active: boolean;
}

/** "Storm Signature Massage — 90" -> "Storm Signature Massage" */
export const massageName = (name: string) => name.replace(/\s*[—–-]\s*\d+\s*(min)?\s*$/i, "").trim();

export function massageVariants<T extends MassageVariant>(services: T[], service: T): T[] {
  return services
    .filter(s => s.is_active && s.category === "Massage" && massageName(s.name) === massageName(service.name))
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
}

/** Keeps one menu card per massage treatment (the shortest variant). */
export function compactMassageMenu<T extends MassageVariant>(services: T[]): T[] {
  return services.filter(s => s.category !== "Massage" || s.id === massageVariants(services, s)[0]?.id);
}

export const CUPPING_PRICE_PER_AREA = 20;

export const MASSAGE_INCLUSIONS = [
  "Full-body massage, unless you request focus areas on your intake form",
  "Trigger point therapy",
  "Hot towels",
  "Weighted Himalayan salt bags and warm cherry-pit pillows",
];

export interface MassageDetails { name: string; pressure: string; overview: string; extended: string }

export const MASSAGE_DETAILS: MassageDetails[] = [
  {
    name: "Storm Signature Massage", pressure: "Medium to deep pressure",
    overview: "The massage you'll keep coming back for. Medium to deep pressure meets every knot with trigger point therapy, while warm cherry-pit pillows and weighted Himalayan salt bags sink you deeper into stillness. It ends with hot towels and a body that finally feels like yours again.",
    extended: "Choose 90 minutes when one hour is never enough.",
  },
  {
    name: "Deep Relief Massage", pressure: "Firm, deep pressure",
    overview: "For the tension you've carried for months. Slow, firm pressure and trigger point work release the shoulders, back and hips layer by layer, never rushed. Warm salt bags and hot towels soften the body between the deep work, so you leave loose, light and grounded.",
    extended: "The 90 minutes gives your therapist time to truly undo it.",
  },
  {
    name: "Lymph & Flow Massage", pressure: "Light, rhythmic pressure",
    overview: "Light, rhythmic strokes that wake up circulation from head to toe, including gentle work on the stomach, to help ease puffiness and that heavy, bloated feeling. You'll leave feeling lighter, clearer and calm.",
    extended: "The 90 minutes slows everything down for more full-body work and a lymphatic facial massage to depuff and brighten the face.",
  },
  {
    name: "Prenatal Massage", pressure: "Gentle to medium pressure",
    overview: "An hour that's entirely for you and your changing body. Rest face down on our specially designed pregnancy pillow, or side-lying, whichever feels best, while your therapist eases the lower back, hips, legs and swollen feet. Warm cherry-pit pillows and hot towels add comfort you'll want to come back for.",
    extended: "The 90 minutes gives more time for the hips and lower body.",
  },
  {
    name: "Sports Performance Massage", pressure: "Deep, targeted pressure with stretching",
    overview: "Recovery for people who train. Deep compression, trigger point therapy and assisted stretching work through tight hips, hamstrings and shoulders, so you move freer and bounce back faster. Finished with hot towels and weighted salt bags.",
    extended: "The 90 minutes adds more stretching and mobility work.",
  },
];

export const massageDetails = (name: string) => MASSAGE_DETAILS.find(d => d.name === massageName(name));
