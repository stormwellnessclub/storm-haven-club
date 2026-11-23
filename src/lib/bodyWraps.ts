import { isSeaweedRitual } from "./seaweedRitual";

/** Exact spa menu name for the Fire & Ice ritual; booking and service pages match on it. */
export const FIRE_AND_ICE_NAME = "Fire & Ice — The Contrast Sculpt Ritual";

interface WrapVariant {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  is_active: boolean;
}

export const bodyWrapName = (name: string) => name.replace(/\s*\(extended\)\s*$/i, "").trim();

export function bodyWrapVariants<T extends WrapVariant>(services: T[], service: T): T[] {
  return services.filter(s => s.is_active && s.category === "Body Wraps" && bodyWrapName(s.name) === bodyWrapName(service.name))
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
}

export function compactBodyWrapMenu<T extends WrapVariant>(services: T[]): T[] {
  return services.filter(s => s.category !== "Body Wraps" || isSeaweedRitual(s) || s.id === bodyWrapVariants(services, s)[0]?.id);
}

export interface WrapDetails {
  slug: string;
  name: string;
  overview: string;
  body: string[];
  benefits: { title: string; detail: string }[];
  faqs: { q: string; a: string }[];
  durations: string[];
  sources: { title: string; url: string }[];
}

const safety = { q: "What should I mention before treatment?", a: "Tell us about allergies, sensitive or irritated skin, pregnancy, medications and any condition affected by warmth. Your practitioner will review suitability and the products used; avoid a wrap over broken or inflamed skin." };

export const BODY_WRAP_DETAILS: WrapDetails[] = [
  {
    slug: "anti-aging-collagen", name: "Anti-Aging Collagen Wrap",
    overview: "A nourishing collagen body wrap that drenches skin in moisture, leaving it soft, supple and beautifully smooth from head to toe.",
    body: [
      "Your treatment begins with your skin wrapped in a rich collagen formula, then cocooned in warmth while it sinks in. As you rest, the collagen draws moisture to the surface, replenishing dry, tired-feeling skin.",
      "Choose 75 minutes for the collagen wrap, or 90 minutes for the extended treatment, which begins with a full-body scrub to polish away dullness and closes with a short massage to melt away tension.",
      "You leave with skin that feels plump, silky and renewed, and a body that feels completely at ease.",
    ],
    benefits: [
      { title: "Deep moisture", detail: "Collagen draws and holds moisture in the skin, leaving it hydrated and comfortable." },
      { title: "Soft, supple skin", detail: "Skin feels smoother, plumper and more youthful to the touch." },
      { title: "Polished texture", detail: "The 90-minute option adds a full-body scrub that lifts away dullness for a fresh, glowing finish." },
      { title: "Total relaxation", detail: "The extended option closes with a short massage to ease tension and help you unwind." },
    ],
    faqs: [
      { q: "What is the difference between 75 and 90 minutes?", a: "The 75-minute choice is the collagen wrap. The 90-minute extended treatment adds a full-body scrub and a short massage." },
      { q: "How should I prepare?", a: "Eat a light meal, drink plenty of water and arrive a few minutes early to settle in." }, safety,
    ], durations: ["75 min", "90 min"],
    sources: [{ title: "Review of collagen in cosmetics and skin care", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10968853/" }],
  },
  {
    slug: "brightening-vitamin-c", name: "Brightening Vitamin C Wrap",
    overview: "A radiance-boosting vitamin C body wrap that wakes up dull skin and leaves it fresh, bright and glowing.",
    body: [
      "This 60-minute wrap envelops your skin in a vitamin C formula, then wraps you in warmth so the antioxidant-rich treatment can do its work while you rest.",
      "Vitamin C is one of skincare's most loved brightening ingredients, prized for helping skin look more even, luminous and refreshed.",
      "You leave with a healthy glow and skin that feels soft and conditioned. Pair it with your daily sunscreen to keep that radiance going.",
    ],
    benefits: [
      { title: "Radiant glow", detail: "Vitamin C brightens dull-looking skin for a fresh, luminous finish." },
      { title: "More even-looking tone", detail: "A favorite ingredient for helping skin look more even and refined." },
      { title: "Antioxidant care", detail: "Rich in antioxidants that help skin look healthy and revitalized." },
      { title: "Soft, conditioned skin", detail: "Skin is left smooth, comfortable and cared for." },
    ],
    faqs: [
      { q: "How often should I book?", a: "Many guests enjoy it as a regular glow treatment, especially before an event or as the seasons change." },
      { q: "Can sensitive skin enjoy vitamin C?", a: "Usually, yes. Tell your practitioner about any past reactions so they can tailor your treatment." }, safety,
    ], durations: ["60 min"],
    sources: [{ title: "Systematic review of topical vitamin C for skin appearance", url: "https://pubmed.ncbi.nlm.nih.gov/34559950/" }],
  },
  {
    slug: "mud-therapy", name: "Mud Therapy Wrap",
    overview: "A mineral-rich mud body wrap that purifies and refreshes your skin while you sink into deep, warm relaxation.",
    body: [
      "This 60-minute treatment covers your body in a mineral-rich mud, then wraps you in warmth as it works. Mud naturally draws away surface oil and impurities, leaving skin feeling clean and renewed.",
      "As you rest cocooned, the warmth helps your muscles soften and your mind quiet. It is a grounding, earthy ritual that has been enjoyed for centuries.",
      "You leave with skin that feels purified, smooth and refreshed, and a body that feels light and at ease.",
    ],
    benefits: [
      { title: "Purified skin", detail: "Mineral mud draws away surface oil and impurities for a clean, fresh feel." },
      { title: "Smoother texture", detail: "Skin is left softer, refined and refreshed." },
      { title: "Mineral-rich care", detail: "A time-honored mud treatment loved for its skin-renewing feel." },
      { title: "Deep relaxation", detail: "Warmth and stillness ease tension and help you fully unwind." },
    ],
    faqs: [
      { q: "What does it feel like?", a: "Warm, earthy and calming. The mud is applied, you are wrapped and left to rest, then you rinse away to fresh, soft skin." },
      { q: "How should I prepare?", a: "Eat a light meal, drink plenty of water and arrive a few minutes early to settle in." }, safety,
    ], durations: ["60 min"],
    sources: [{ title: "Study of cosmetic effects of specific Dead Sea mud preparations", url: "https://pubmed.ncbi.nlm.nih.gov/33283890/" }],
  },
  {
    slug: "body-sculpting", name: "Body Sculpting Wrap",
    overview: "A 90-minute caffeine-infused sculpting wrap that smooths, tones and refines the look of your skin, leaving you feeling lighter and more confident.",
    body: [
      "Body Sculpting envelops your body in a caffeine-infused formula, then wraps you snugly in warmth as it works. Caffeine is a skincare favorite for helping skin look firmer, smoother and more toned.",
      "As you rest, the wrap targets the look of dimpling and uneven texture, while the warmth helps you fully relax.",
      "You leave with skin that looks smoother and feels conditioned, and a lighter, refreshed feeling. Many guests enjoy it before an event or as part of a regular routine.",
    ],
    benefits: [
      { title: "Smoother-looking skin", detail: "Caffeine helps reduce the look of cellulite for a smoother, more even appearance." },
      { title: "Firmer, toned feel", detail: "Skin looks tighter and more refined after your wrap." },
      { title: "Lighter feeling", detail: "Leave feeling refreshed, light and confident." },
      { title: "A relaxing pause", detail: "Ninety minutes of warmth and stillness, just for you." },
    ],
    faqs: [
      { q: "When will I notice a difference?", a: "Many guests love how their skin looks and feels right after. A regular series gives the best results." },
      { q: "How should I prepare?", a: "Eat a light meal, drink plenty of water and arrive a few minutes early to settle in." }, safety,
    ], durations: ["90 min"],
    sources: [
      { title: "American Academy of Dermatology: cellulite treatments and evidence", url: "https://www.aad.org/public/cosmetic/fat-removal/cellulite-treatments-what-really-works/" },
      { title: "Review of topical caffeine in cosmetics", url: "https://pubmed.ncbi.nlm.nih.gov/26004004/" },
    ],
  },
  {
    slug: "fire-and-ice", name: FIRE_AND_ICE_NAME,
    overview: "A 90-minute contrast sculpting ritual: exfoliation, wood sculpting and lymphatic massage, a cooling herbal wrap for the legs, a warming thermal wrap for the abdomen, and a closing massage. Made to firm, tighten, slim and detox — one sensory experience from start to finish.",
    body: [
      "Fire & Ice begins like every Aella wrap, with a full-body exfoliation that smooths the skin and prepares it to receive what follows. Your practitioner then moves into wood sculpting and lymphatic massage, using contoured wooden tools and rhythmic drainage strokes to wake up circulation and encourage the body to release retained fluid.",
      "Ice comes first, on the lower body. A cooling cryo gel is applied to the legs, which are then wrapped in a lymphatic, circulation-promoting wrap soaked in herbs. It is designed to firm and tighten the skin, increase blood flow and leave the legs feeling lighter.",
      "Fire follows on the abdomen. A thermal gel is applied and wrapped in a warming thermal wrap that heats up as you rest. Warming botanicals and cooling actives like these have been studied for switching on the body's heat-producing processes, including turning white fat into beige and brown fat that the body burns, while the warmth draws blood flow to the area.",
      "Cold on the legs and warmth at the core make for a contrast you feel the whole time. The ritual closes with a short massage so you leave relaxed as well as sculpted. Results vary from person to person and are not guaranteed; most guests book a series for the best results.",
    ],
    benefits: [
      { title: "Sculpts and contours", detail: "Wood sculpting and lymphatic massage work the tissue and support the body's natural drainage, for a smoother, more contoured look." },
      { title: "Firms and tightens the legs", detail: "The cooling cryo gel and herbal lymphatic wrap are designed to firm and tighten the skin and leave the legs feeling lighter. Results vary." },
      { title: "Warming slimming wrap for the abdomen", detail: "The thermal gel and heating wrap target the abdomen, supporting the body's process of turning white fat into beige and brown fat. Results are not guaranteed." },
      { title: "Detox and circulation", detail: "Lymphatic massage, contrast temperatures and the wraps work together to boost blood flow and encourage the release of retained fluid." },
      { title: "A full sensory ritual", detail: "Exfoliation, hot and cold, and a closing massage, in one 90-minute treatment." },
    ],
    faqs: [
      { q: "What is included in the 90 minutes?", a: "Full-body exfoliation, wood sculpting, lymphatic massage, a cooling cryo gel with an herbal lymphatic wrap on the legs, a thermal gel with a warming wrap on the abdomen, and a short closing massage." },
      { q: "Why hot and cold together?", a: "Each area gets what suits it best: cooling and firming for the legs, warming and slimming for the abdomen. The contrast also boosts circulation and makes the ritual a sensory experience." },
      { q: "Will I see results after one session?", a: "Many guests notice their skin feels tighter and their body lighter after one visit. Results vary and are not guaranteed; a series gives the best results." },
      { q: "Does the wood sculpting hurt?", a: "It should feel firm, not painful. Tell your practitioner if you want lighter pressure at any point." },
      safety,
    ], durations: ["90 min"],
    sources: [
      { title: "Capsaicin and the browning of white fat (research study)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4945767/" },
      { title: "Menthol and the browning of white fat (research study)", url: "https://pubmed.ncbi.nlm.nih.gov/29088850/" },
      { title: "Review: factors that promote brown and beige fat", url: "https://pubmed.ncbi.nlm.nih.gov/28507012/" },
    ],
  },
];

export function bodyWrapDetails(name: string) {
  return BODY_WRAP_DETAILS.find(d => d.name === bodyWrapName(name));
}