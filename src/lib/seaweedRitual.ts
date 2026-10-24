export const SEAWEED_RITUAL_NAME = "Seaweed Body Wrap Ritual";
export const SEAWEED_RITUAL_PATH = "/spa/body-wraps/detox-seaweed-charcoal";
export const SEAWEED_RITUAL_OVERVIEW = "A restorative experience that brings together real seaweed, herbal botanicals, full-body exfoliation, facial care, and massage—leaving your skin replenished and your body deeply relaxed.";
export const SEAWEED_RITUAL_PREPARATION = "Both options include a preparatory vibration therapy and red light session, provided in addition to your selected treatment time.";
export const SEAWEED_RITUAL_BODY = [
  "Your ritual begins with full-body exfoliation to lift away dullness and reveal smoother skin. Following a shower, you’re enveloped in real seaweed, with a complementary seaweed and herbal body mask applied to selected areas. Rich in naturally moisture-binding compounds, this marine treatment helps replenish hydration and soften dry skin for a supple, refreshed finish.",
  "As you rest cocooned for 30–40 minutes, a gentle facial lymphatic massage and face mask extend the experience to your complexion. After a second shower, a massage with natural seaweed body butter nourishes the skin while easing muscular tension.",
  "Choose 70 minutes for the complete ritual or 90 minutes for an extended massage, allowing more time to release tension and fully settle into relaxation.",
  SEAWEED_RITUAL_PREPARATION,
];
export const SEAWEED_RITUAL_BENEFITS = [
  { title: "Replenishing hydration", detail: "Helps retain moisture and leaves skin feeling soft, supple, and conditioned." },
  { title: "Smoother skin texture", detail: "Full-body exfoliation removes dead skin buildup and restores a fresh, polished feel." },
  { title: "Skin-soothing care", detail: "Seaweed contains compounds studied for their anti-inflammatory properties and potential to calm skin irritation." },
  { title: "Cellulite-focused care", detail: "Topical seaweed formulations have shown potential to improve the appearance of cellulite with repeated treatments." },
  { title: "Facial puffiness relief", detail: "Gentle lymphatic massage helps ease the appearance of facial fluid retention." },
  { title: "Muscle tension relief", detail: "Massage encourages physical release and deep relaxation." },
];

interface RitualVariant {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  is_active: boolean;
}

export function isSeaweedRitual(service: Pick<RitualVariant, "name" | "category">) {
  return service.category === "Body Wraps" && /^(detox seaweed & charcoal wrap(?: \(extended\))?|seaweed body wrap ritual(?: \(extended\))?)$/i.test(service.name);
}

export function seaweedRitualVariants<T extends RitualVariant>(services: T[]): T[] {
  return services.filter(s => s.is_active && isSeaweedRitual(s) && [70, 90].includes(s.duration_minutes))
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
}

export function compactSeaweedMenu<T extends RitualVariant>(services: T[]): T[] {
  const first = seaweedRitualVariants(services)[0];
  return services.filter(s => !isSeaweedRitual(s) || s.id === first?.id);
}