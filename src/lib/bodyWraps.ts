import { isSeaweedRitual } from "./seaweedRitual";

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
const evidence = "Benefits depend on the products used and your skin. Ingredient research does not guarantee the same results from one body wrap.";

export const BODY_WRAP_DETAILS: WrapDetails[] = [
  {
    slug: "anti-aging-collagen", name: "Anti-Aging Collagen Wrap",
    overview: "A moisture-focused collagen body wrap for dry-feeling skin, with a soft, supple finish. Choose the 75-minute wrap or the 90-minute extended treatment with a full-body scrub and short massage.",
    body: [
      "This wrap focuses on skin comfort and conditioning rather than changing the structure of your skin. Collagen-containing topical products can help hold moisture at the surface, leaving dry-feeling skin softer and temporarily more supple.",
      "Choose 75 minutes for the collagen wrap, or 90 minutes for the extended treatment with a full-body scrub and short massage. The scrub helps smooth surface texture, while the massage adds time to unwind.",
      "Topical collagen is not the same as collagen produced within the skin: a wrap is not proven to rebuild deeper collagen or permanently tighten skin. " + evidence,
    ],
    benefits: [
      { title: "Moisture-focused care", detail: "Collagen-containing skincare may help retain surface moisture. The immediate benefit is conditioned skin, not replacement of the collagen beneath it." },
      { title: "Soft, supple skin feel", detail: "Hydrated skin can feel more comfortable and appear temporarily smoother. Results vary with the formula and your skin's starting condition." },
      { title: "Extended skin polishing", detail: "The 90-minute option includes a full-body scrub to lift away surface buildup and improve the feel of rough texture." },
      { title: "Time to unwind", detail: "The extended option includes a short massage, pairing skin care with a relaxing pause." },
    ],
    faqs: [
      { q: "What is the difference between 75 and 90 minutes?", a: "The 75-minute choice is the collagen wrap. The 90-minute extended treatment includes a full-body scrub and short massage." },
      { q: "Does this rebuild collagen or permanently tighten skin?", a: "No such result is guaranteed. Topical collagen is primarily used for surface conditioning; it has not been shown to replace deeper skin collagen through a body wrap." }, safety,
    ], durations: ["75 min", "90 min"],
    sources: [{ title: "Review of collagen in cosmetics and skin care", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10968853/" }],
  },
  {
    slug: "brightening-vitamin-c", name: "Brightening Vitamin C Wrap",
    overview: "A vitamin C body wrap for dull-looking skin, focused on a fresher, more radiant appearance and a conditioned finish—not an instant correction for pigmentation.",
    body: [
      "This 60-minute vitamin C wrap is a skin-care choice for guests whose skin looks dull or uneven. Depending on the formulation, topical vitamin C can support a brighter-looking complexion over time.",
      "Vitamin C has been studied in formulated skincare for antioxidant activity and the appearance of pigmentation. Those findings depend on concentration, stability and regular use; they do not establish that a single wrap fades dark spots.",
      "Expect a cosmetic skin-care experience, not a treatment for melasma or a substitute for sun protection. Continue your usual sunscreen routine on exposed skin. " + evidence,
    ],
    benefits: [
      { title: "Radiance-focused care", detail: "A vitamin C formulation may support a brighter-looking appearance. Visible change depends on formulation and use, so one wrap should not be expected to erase discoloration." },
      { title: "Even-looking tone", detail: "Studies of topical vitamin C suggest potential benefits for uneven pigmentation with ongoing skincare use. Evidence is not specific to this body wrap." },
      { title: "Antioxidant skin care", detail: "Vitamin C is studied for antioxidant activity in the skin. A wrap does not provide sunscreen protection or reverse sun damage on its own." },
    ],
    faqs: [
      { q: "Will one appointment remove dark spots?", a: "No. Research relates mainly to repeated use of specific skincare formulas; a single body wrap is not proven to remove dark spots or treat melasma." },
      { q: "Can sensitive skin tolerate vitamin C?", a: "Some formulas can irritate. Tell your practitioner about previous reactions so they can review suitability before applying the product." }, safety,
    ], durations: ["60 min"],
    sources: [{ title: "Systematic review of topical vitamin C for skin appearance", url: "https://pubmed.ncbi.nlm.nih.gov/34559950/" }],
  },
  {
    slug: "mud-therapy", name: "Mud Therapy Wrap",
    overview: "A mineral-mud body wrap for a cleansing, refreshed skin feel and a quiet moment to relax. A skin-care ritual, not a detox or medical treatment.",
    body: [
      "This 60-minute treatment uses a mineral-mud preparation for a full-body skin-care experience. Mud and clay products can absorb surface oil and leave skin feeling cleansed; the effect depends on the particular product and your skin type.",
      "The appeal is a refreshed skin feel and time to settle into relaxation. Some mud formulas can feel drying, so tell your practitioner if your skin is already dry, reactive or irritated.",
      "Studies of particular therapeutic mud products cannot be applied automatically to every spa wrap. This treatment is not proven to draw toxins from the body, deliver minerals into joints or treat arthritis. " + evidence,
    ],
    benefits: [
      { title: "Refreshed skin feel", detail: "Mud or clay preparations may absorb excess surface oil and help skin feel cleansed. This is surface skin care, not removal of toxins from the body." },
      { title: "Texture-focused care", detail: "Specific mud products have been studied for cosmetic skin feel and appearance, but results are mixed and do not guarantee firming or hydration from one wrap." },
      { title: "Restful body care", detail: "A quiet wrap appointment offers time to slow down. It is not a medical treatment for muscle injury, inflammation or joint disease." },
    ],
    faqs: [
      { q: "Does the mud detoxify my body?", a: "No evidence establishes that a spa mud wrap removes internal toxins. Its role here is cosmetic skin care and relaxation." },
      { q: "Is it suitable for dry or sensitive skin?", a: "Some mud preparations can dry or irritate skin. Discuss your skin and any past reactions with the practitioner before treatment." }, safety,
    ], durations: ["60 min"],
    sources: [{ title: "Study of cosmetic effects of specific Dead Sea mud preparations", url: "https://pubmed.ncbi.nlm.nih.gov/33283890/" }],
  },
  {
    slug: "body-sculpting", name: "Body Sculpting Wrap",
    overview: "A 90-minute caffeine-infused body wrap focused on smoother-looking skin and a conditioned feel. Cosmetic changes, if noticed, are temporary—not fat loss or permanent body reshaping.",
    body: [
      "Body Sculpting is a caffeine-infused body wrap for guests interested in the appearance and feel of their skin. The focus is cosmetic conditioning rather than changing body size or muscle tone.",
      "Caffeine-containing skincare may temporarily make cellulite less noticeable by affecting skin hydration. Evidence varies by product, and studies of creams do not establish the same benefit from one wrap.",
      "This 90-minute appointment is not a weight-loss treatment and is not proven to remove fat, permanently reduce cellulite or improve muscle definition. " + evidence,
    ],
    benefits: [
      { title: "Smoother-looking skin", detail: "Some caffeine-containing topical products may temporarily reduce the visibility of cellulite. The effect may be subtle, varies by formula and is not guaranteed for this wrap." },
      { title: "Conditioned skin feel", detail: "The cosmetic aim is a refreshed, cared-for skin feel rather than a measurable or lasting reduction in body size." },
      { title: "A relaxing pause", detail: "Set aside 90 minutes for body care and rest, without treating the appointment as an alternative to exercise, nutrition or medical care." },
    ],
    faqs: [
      { q: "Will this reduce fat or make me lose weight?", a: "No. A body wrap is not a fat-removal or weight-loss procedure. Any cosmetic change in appearance is temporary." },
      { q: "Does it permanently remove cellulite?", a: "No. Some topical caffeine products may offer temporary appearance changes, but results depend on the formula and are not established for a single wrap." }, safety,
    ], durations: ["90 min"],
    sources: [
      { title: "American Academy of Dermatology: cellulite treatments and evidence", url: "https://www.aad.org/public/cosmetic/fat-removal/cellulite-treatments-what-really-works/" },
      { title: "Review of topical caffeine in cosmetics", url: "https://pubmed.ncbi.nlm.nih.gov/26004004/" },
    ],
  },
];

export function bodyWrapDetails(name: string) {
  return BODY_WRAP_DETAILS.find(d => d.name === bodyWrapName(name));
}