// Content bank for every Aella Spa service page.
// Each entry powers a dedicated SEO-indexed URL.

export interface ServiceContent {
  slug: string;
  /** Display name (used as H1 base and Service schema name) */
  name: string;
  /** Brief one-liner (also used as og description fallback) */
  tagline: string;
  /** SEO title (no brand suffix — appended by SEOHead) */
  title: string;
  /** Meta description, < 160 chars */
  description: string;
  /** H1 */
  h1: string;
  /** Hero subhead */
  subhead: string;
  /** Body paragraphs (2-4) */
  body: string[];
  /** Bullet benefits */
  benefits: string[];
  /** FAQ entries — also rendered as FAQPage JSON-LD */
  faqs: { q: string; a: string }[];
  /** Durations available (e.g. ["60 min", "90 min"]) */
  durations: string[];
  /** Sibling slugs for related links */
  related?: string[];
}

export interface CategoryContent {
  slug: string;
  /** Display name */
  name: string;
  /** Page H1 */
  h1: string;
  /** Hero subhead */
  subhead: string;
  /** SEO title */
  title: string;
  /** Meta description */
  description: string;
  /** Intro paragraphs */
  intro: string[];
  /** Services in this category, by slug */
  services: ServiceContent[];
  /** DB category name as stored in spa_services.category */
  dbCategory: string;
}

// ────────────────────────────────────────────────────────────
// MASSAGE
// ────────────────────────────────────────────────────────────
const massage: ServiceContent[] = [
  {
    slug: "storm-signature",
    name: "Storm Signature Massage",
    tagline: "Our flagship full-body massage blending Swedish flow and targeted relief.",
    title: "Storm Signature Massage — Livonia, MI",
    description: "The Storm Signature Massage blends Swedish flow with targeted relief. 60 or 90 minutes at Storm Wellness Club in Livonia, Michigan.",
    h1: "Storm Signature Massage",
    subhead: "Our flagship treatment — a fully customized full-body massage that blends Swedish flow, targeted relief, and aromatherapy. Open to members and guests.",
    body: [
      "The Storm Signature Massage is the treatment we built our spa around. Your licensed therapist begins with a quiet intake, learning where you hold tension, what your week looked like, and how you want to feel when you leave. The session is then shaped around you — flowing Swedish strokes to settle the nervous system, deeper targeted work where you actually need it, and a closing sequence designed to leave the body fully integrated.",
      "Every Signature session includes warmed organic oil, hot towels, and your choice of essential oil. Treatment rooms are private, quiet, and temperature controlled. Members receive 5–12% off depending on tier, and the booking flow takes about 60 seconds — pick a length, a therapist, and a time that works.",
      "Choose 60 minutes for a focused reset or 90 minutes when you want unhurried, full-body work. The Signature is the right choice if you're new to Storm or you simply want the most complete version of what we do.",
    ],
    benefits: [
      "Fully customized — never a script",
      "Licensed Michigan-certified therapists",
      "Warmed organic massage oil included",
      "Hot towels and essential oil of your choice",
      "Private, quiet, temperature-controlled rooms",
      "Member discounts of 5–12% by tier",
    ],
    faqs: [
      { q: "What's the difference between 60 and 90 minutes?", a: "60 minutes is a focused full-body session. 90 minutes gives your therapist time to do unhurried full-body work plus extra time on the areas that need it most." },
      { q: "Is the Storm Signature deep tissue?", a: "It's a blended pressure massage — generally medium with deeper pressure on the areas you ask for. If you want consistent deep pressure throughout, book the Deep Relief Massage instead." },
      { q: "Do I need to be a member?", a: "No. Both members and guests can book. Guests create a quick portal account and sign a waiver before the first appointment." },
      { q: "What should I wear?", a: "Undress to your comfort level. You'll be professionally draped at all times." },
    ],
    durations: ["60 min", "90 min"],
    related: ["deep-relief", "sports-performance", "lymph-and-flow", "prenatal"],
  },
  {
    slug: "deep-relief",
    name: "Deep Relief Massage",
    tagline: "Sustained deep pressure for chronic tension and stubborn knots.",
    title: "Deep Tissue Massage — Livonia, MI",
    description: "Deep Relief Massage in Livonia, MI. Sustained deep-tissue pressure for chronic tension and trigger points. 60 or 90 minutes at Storm Wellness Club.",
    h1: "Deep Relief Massage",
    subhead: "Sustained deep pressure work for chronic tension, trigger points, and the knots that don't budge with lighter pressure. Licensed therapists, 60 or 90 minutes.",
    body: [
      "Deep Relief is the right massage when you carry your stress in your shoulders, your low back has been complaining for weeks, or a specific area just won't release. Your therapist uses slow, deliberate strokes with forearm and elbow techniques to access deeper layers of muscle and fascia — without the brutal pressure that makes you tense up and brace.",
      "We'll communicate throughout the session about pressure. The goal is therapeutic — not painful. Many guests describe Deep Relief as the most productive massage they've had in years, particularly when they pair it with our Sauna & Steam Room or Sports Stretching service on the same visit.",
      "Choose 90 minutes if you have multiple problem areas or if it's been a long time since your last deep tissue session. Drink plenty of water afterward — your muscles will thank you.",
    ],
    benefits: [
      "Releases chronic muscle tension and trigger points",
      "Improves range of motion and posture",
      "Reduces low-back and neck-shoulder pain",
      "Slow, deliberate technique — therapeutic, not brutal",
      "Member discounts of 5–12% by tier",
    ],
    faqs: [
      { q: "Will it hurt?", a: "Deep tissue work can feel intense, but it should never feel like sharp pain. Your therapist will check in on pressure throughout and adjust." },
      { q: "How is this different from the Signature Massage?", a: "Deep Relief stays at consistent deep pressure throughout the session and focuses on releasing chronic tension. The Signature is a blended-pressure customized session." },
      { q: "Will I be sore afterward?", a: "Mild soreness for 24-48 hours is normal, similar to a hard workout. Drink water, take a warm bath, and the soreness resolves quickly." },
      { q: "How often should I get deep tissue work?", a: "Every 2-4 weeks if you have chronic issues; every 4-6 weeks for maintenance." },
    ],
    durations: ["60 min", "90 min"],
    related: ["storm-signature", "sports-performance", "lymph-and-flow", "sports-stretching"],
  },
  {
    slug: "sports-performance",
    name: "Sports Performance Massage",
    tagline: "Pre- and post-training bodywork for athletes and active members.",
    title: "Sports Massage — Livonia, MI",
    description: "Sports Performance Massage in Livonia, MI. Pre- and post-training recovery for athletes. Stretching, compression, and targeted work. 60 or 90 minutes.",
    h1: "Sports Performance Massage",
    subhead: "Built for athletes, lifters, runners, and anyone training hard. Combines stretching, compression, and deep targeted work to accelerate recovery and prevent injury.",
    body: [
      "Sports Performance Massage is structured differently from a relaxation massage. Your therapist focuses on the specific muscle groups you train hardest — hips and quads for runners and cyclists, shoulders and lats for lifters, full posterior chain for CrossFit and HIIT athletes. The session combines assisted stretching, compression, friction, and targeted deep work.",
      "Book pre-event to feel loose and primed, or post-event to flush metabolic waste, reduce DOMS, and shorten your recovery window. Either timing works — just tell your therapist your training schedule at intake.",
      "Many of our endurance and strength members pair Sports Performance Massage with Red Light Therapy, the Cold Plunge, or Starpool ZeroBody Cryo on the same visit for a full recovery protocol.",
    ],
    benefits: [
      "Accelerates recovery from hard training",
      "Reduces delayed-onset muscle soreness (DOMS)",
      "Improves flexibility and joint range of motion",
      "Pre-event: primes muscles without leaving them sluggish",
      "Post-event: flushes lactic acid and metabolic waste",
    ],
    faqs: [
      { q: "When should I book — before or after a race or competition?", a: "Both work. Pre-event 2-3 days before, post-event within 48 hours. Avoid deep work the day of competition." },
      { q: "Is this only for competitive athletes?", a: "No — anyone who trains regularly benefits. Runners, lifters, cyclists, and group-class regulars all use it." },
      { q: "Can I combine this with cold plunge or red light?", a: "Yes. Many members stack massage + cold plunge + red light on one visit for a complete recovery session." },
      { q: "How often should I get a sports massage?", a: "Every 1-2 weeks in heavy training, every 3-4 weeks for maintenance." },
    ],
    durations: ["60 min", "90 min"],
    related: ["deep-relief", "lymph-and-flow", "sports-stretching", "storm-signature"],
  },
  {
    slug: "lymph-and-flow",
    name: "Lymph & Flow Massage",
    tagline: "Gentle rhythmic technique to reduce bloating, swelling, and water retention.",
    title: "Lymphatic Drainage Massage — Livonia, MI",
    description: "Lymph & Flow lymphatic drainage massage in Livonia, MI. Reduce bloating, swelling, and water retention. 60 or 90 minutes at Storm Wellness Club.",
    h1: "Lymph & Flow Massage",
    subhead: "A gentle, rhythmic technique that supports your lymphatic system — reducing bloating, swelling, water retention, and post-surgical inflammation.",
    body: [
      "Lymph & Flow is one of the most under-appreciated treatments in the spa. Unlike deep tissue work, lymphatic drainage uses extremely light, rhythmic strokes that move stagnant lymph fluid toward the lymph nodes where it's processed and eliminated. The pressure is gentle — almost feather-light — but the systemic effect is significant.",
      "Members book Lymph & Flow for post-surgical recovery, hormonal water retention, post-travel puffiness, allergy season, and after intense training blocks. It's also a favorite the week before a wedding or photoshoot for visible debloating.",
      "The treatment is calming, deeply relaxing, and pairs beautifully with the Sauna & Steam Room afterward to further support detoxification.",
    ],
    benefits: [
      "Reduces bloating and water retention",
      "Supports post-surgical recovery (clearance required)",
      "Eases sinus pressure and seasonal allergy symptoms",
      "Helps clear post-travel puffiness",
      "Deeply calming — supports nervous system regulation",
    ],
    faqs: [
      { q: "Is this safe after surgery?", a: "Yes, with surgeon clearance. Many post-op patients are referred to lymphatic massage. Bring documentation to your first appointment." },
      { q: "Why is the pressure so light?", a: "Lymph vessels sit just under the skin. Deep pressure actually closes them. Light rhythmic strokes are what move fluid effectively." },
      { q: "How quickly will I see results?", a: "Most guests notice visible debloating within 24-48 hours. Effects build with regular sessions." },
      { q: "How often can I get it?", a: "Weekly is fine — it's gentle enough for frequent treatment." },
    ],
    durations: ["60 min", "90 min"],
    related: ["storm-signature", "prenatal", "detox-seaweed-charcoal", "sauna-steam"],
  },
  {
    slug: "prenatal",
    name: "Prenatal Massage",
    tagline: "Safe, supportive massage for expecting mothers (2nd & 3rd trimester).",
    title: "Prenatal Massage — Livonia, MI",
    description: "Prenatal massage in Livonia, MI. Safe, supportive bodywork for expecting mothers. Side-lying position, certified therapists. 60 or 90 minutes.",
    h1: "Prenatal Massage",
    subhead: "Safe, supportive massage for expecting mothers. Side-lying position with bolstered cushioning, certified prenatal therapists, and gentle techniques tailored to your trimester.",
    body: [
      "Prenatal massage at Storm is performed by therapists with specific prenatal certification. You'll rest in a side-lying position with bolster cushioning that supports your belly, hips, and lower back — never face-down on a pregnancy cutout table, which we don't consider safe past the first trimester.",
      "The session focuses on the areas pregnancy tends to stress most: low back, hips, glutes, neck, shoulders, and swollen feet and ankles. Pressure stays moderate, certain pressure points are deliberately avoided, and aromatherapy oils are pregnancy-safe.",
      "Available from the second trimester onward (12 weeks+) with no complications. If you have any pregnancy concerns, bring a release note from your OB or midwife to your first visit.",
    ],
    benefits: [
      "Side-lying with bolster support — never prone",
      "Therapists with prenatal-specific training",
      "Relieves low-back, hip, and sciatic pain",
      "Reduces swelling in feet, ankles, and hands",
      "Pregnancy-safe oils and pressure points",
    ],
    faqs: [
      { q: "When can I start prenatal massage?", a: "Most providers recommend waiting until the second trimester (12+ weeks). We require a release note from your OB if you have any complications." },
      { q: "Is the pressure deep?", a: "No. Prenatal work stays at light-to-medium pressure. Certain reflex points on the legs and feet are avoided." },
      { q: "Can I lie on my stomach?", a: "No — we use side-lying with bolster cushioning, which is the safest position past the first trimester." },
      { q: "Are the oils safe?", a: "Yes. We use pregnancy-safe essential oils only and will confirm allergies and preferences at intake." },
    ],
    durations: ["60 min", "90 min"],
    related: ["lymph-and-flow", "storm-signature", "relaxing-chamomile", "hydration-aloe"],
  },
];

// ────────────────────────────────────────────────────────────
// FACIALS
// ────────────────────────────────────────────────────────────
const facials: ServiceContent[] = [
  {
    slug: "customized",
    name: "Customized Facial",
    tagline: "A facial built around your skin's needs on the day you visit.",
    title: "Customized Facial — Livonia, MI",
    description: "Customized facial in Livonia, MI. Esthetician analyzes your skin and builds the treatment around it. 60 or 90 minutes at Storm Wellness Club.",
    h1: "Customized Facial",
    subhead: "Every skin is different — and your skin today may not be your skin next month. Your esthetician analyzes your skin live and builds a treatment around exactly what it needs.",
    body: [
      "If you're not sure which facial to book, start here. Your esthetician begins with a thorough skin analysis under magnification — assessing hydration, congestion, sensitivity, pigmentation, and barrier health. From there, the treatment is built around you: cleanser, exfoliant, serum, mask, and massage selection are all chosen on the spot.",
      "The Customized Facial includes a double cleanse, exfoliation (enzymatic or mechanical depending on skin), extractions if appropriate, two custom masks, targeted serums, facial massage, eye treatment, lip treatment, and SPF. You leave with a written recommendation of products and your next treatment plan.",
      "Available as 60 minutes (full essentials) or 90 minutes (essentials plus extended massage, second mask, and add-on treatments like LED or high-frequency).",
    ],
    benefits: [
      "Built around your skin's needs that day",
      "Live skin analysis under magnification",
      "Double cleanse, exfoliation, extractions",
      "Custom serums and masks",
      "Written take-home plan",
    ],
    faqs: [
      { q: "How is this different from other facials?", a: "Other facials follow a fixed protocol designed for a specific concern (anti-aging, hydration, brightening). The Customized adapts in real time." },
      { q: "Will there be extractions?", a: "Only if your skin needs them and you consent. We never over-extract." },
      { q: "Will I be red afterward?", a: "Mild flushing for 30-60 minutes is normal. Significant redness is rare." },
      { q: "How often should I get a facial?", a: "Every 4-6 weeks matches your skin's renewal cycle." },
    ],
    durations: ["60 min", "90 min"],
    related: ["botanical-bliss", "age-defying", "hydration-infusion", "radiant-glow"],
  },
  {
    slug: "botanical-bliss",
    name: "Botanical Bliss Facial",
    tagline: "Plant-powered facial using organic botanical actives for sensitive and balanced skin.",
    title: "Botanical Bliss Facial — Livonia, MI",
    description: "Botanical Bliss organic facial in Livonia, MI. Plant-based actives for sensitive and balanced skin. 60 or 90 minutes at Storm Wellness Club.",
    h1: "Botanical Bliss Facial",
    subhead: "A plant-powered facial built around organic botanical actives — rose, calendula, chamomile, green tea — for skin that prefers gentle ingredients and visible results.",
    body: [
      "Botanical Bliss is our cleanest facial — formulated entirely around plant-based, organic actives and free of harsh acids, retinoids, and synthetic fragrances. It's the right choice for sensitive skin, pregnant or nursing guests, anyone using prescription topicals, or members who simply prefer a botanical approach.",
      "The treatment layers cold-pressed plant oils, herbal infusions, and natural enzyme exfoliation with a deeply relaxing facial massage that uses gua sha and lymphatic technique. Two custom masks address your specific concerns — calming, hydrating, brightening, or balancing.",
      "Even with its gentle profile, the results are immediate: skin looks calmer, more even, and visibly hydrated. The 90-minute version adds an extended decolleté and shoulder massage.",
    ],
    benefits: [
      "100% plant-based, organic actives",
      "Safe for sensitive, pregnant, or nursing guests",
      "No harsh acids or synthetic fragrance",
      "Gua sha and lymphatic facial massage",
      "Two custom masks per session",
    ],
    faqs: [
      { q: "Is this safe during pregnancy?", a: "Yes — all ingredients are pregnancy-safe. Confirm with your esthetician at intake." },
      { q: "Will I see results without acids or retinoids?", a: "Yes. Botanical actives work through different pathways but deliver visible calming, hydrating, and brightening results." },
      { q: "Can I get this if I have rosacea or eczema?", a: "In most cases, yes. Tell your esthetician about your condition so we can tailor the products." },
      { q: "How often can I get it?", a: "Every 3-4 weeks is safe and beneficial." },
    ],
    durations: ["60 min", "90 min"],
    related: ["customized", "hydration-infusion", "radiant-glow", "relaxing-chamomile"],
  },
  {
    slug: "age-defying",
    name: "Age-Defying Facial",
    tagline: "Firming, lifting, and line-softening treatment using peptides and microcurrent-ready technique.",
    title: "Anti-Aging Facial — Livonia, MI",
    description: "Age-Defying anti-aging facial in Livonia, MI. Peptides, retinol-based serums, and firming massage. 60 or 90 minutes at Storm Wellness Club.",
    h1: "Age-Defying Facial",
    subhead: "Our most targeted anti-aging treatment — peptides, retinol-based serums, firming massage, and a lifting mask. Visible smoothing and lift after one session.",
    body: [
      "Age-Defying is built around three pillars: peptides to signal collagen production, retinol or bakuchiol to accelerate cell turnover, and structured facial massage techniques that lift, sculpt, and de-puff. The treatment opens with a deep enzymatic exfoliation, followed by a peptide-rich serum cocktail, sculpting massage, and a firming hydrogel mask.",
      "The 90-minute version adds an LED red light session and a second targeted mask focused on eye area or jawline. You'll see visible smoothing of fine lines, more even tone, and a noticeable lift along the cheekbones and jaw immediately after the session.",
      "Best results come from a series — most guests book every 3-4 weeks for the first three sessions, then settle into a monthly maintenance rhythm.",
    ],
    benefits: [
      "Smooths fine lines and softens deeper expression lines",
      "Lifts and sculpts along jawline and cheekbones",
      "Stimulates collagen with peptides and gentle retinol",
      "Brightens and evens skin tone",
      "Compounds with repeated sessions",
    ],
    faqs: [
      { q: "Can I get this if I use prescription retinoids?", a: "Tell your esthetician — we'll skip our retinol and increase peptides instead to avoid over-exfoliation." },
      { q: "Will I peel afterward?", a: "Most guests don't. Mild flaking is possible the next day if your skin isn't accustomed to retinol." },
      { q: "When will I see results?", a: "Immediately after the first session, with compounding results across a series of 3-6." },
      { q: "Is this safe in pregnancy?", a: "No — retinoids aren't recommended. Book the Botanical Bliss facial instead." },
    ],
    durations: ["60 min", "90 min"],
    related: ["peptide-renewal", "radiant-glow", "vitamin-c-brightening", "customized"],
  },
  {
    slug: "detoxifying-purity",
    name: "Detoxifying Purity Facial",
    tagline: "Deep-cleansing facial for congested, oily, and breakout-prone skin.",
    title: "Detox Facial — Livonia, MI",
    description: "Detoxifying Purity facial in Livonia, MI. Deep cleanse, charcoal mask, extractions for congested skin. 60 minutes at Storm Wellness Club.",
    h1: "Detoxifying Purity Facial",
    subhead: "A deep-cleansing facial built for congested, oily, and breakout-prone skin — activated charcoal, gentle salicylic exfoliation, and clean extractions.",
    body: [
      "Detoxifying Purity is the right facial when your skin is congested, breaking out, or just looking dull from environmental buildup. The treatment uses a double cleanse with a clarifying gel, salicylic-based enzyme exfoliation, steam to soften the pores, and careful extractions.",
      "An activated charcoal mask follows to draw out impurities, then a soothing balancing serum and oil-free hydrator restore the barrier. The result: clearer, calmer, visibly more refined skin without the redness that aggressive treatments often leave behind.",
      "Pair with the Cold Plunge before or after to further reduce inflammation, or follow with a session in the Salt Room to support respiratory and skin health.",
    ],
    benefits: [
      "Clears congestion and decongests pores",
      "Reduces active breakouts and prevents new ones",
      "Activated charcoal mask draws out impurities",
      "Gentle salicylic exfoliation",
      "Balances oil production without stripping",
    ],
    faqs: [
      { q: "How aggressive are extractions?", a: "We extract only what's ready and never force. Heavy congestion may need 2-3 sessions to clear fully." },
      { q: "Will my skin be red afterward?", a: "Mild redness in extraction areas for 1-2 hours. We finish with a calming serum to minimize it." },
      { q: "Can I wear makeup after?", a: "We recommend waiting 4-6 hours to let the skin breathe and the actives absorb." },
      { q: "How often should I come for breakout-prone skin?", a: "Every 3-4 weeks during an active flare; every 4-6 weeks for maintenance." },
    ],
    durations: ["60 min"],
    related: ["customized", "vitamin-c-brightening", "detox-seaweed-charcoal", "salt-room"],
  },
  {
    slug: "hydration-infusion",
    name: "Hydration Infusion Facial",
    tagline: "Deep hydration for dry, tight, or dehydrated skin.",
    title: "Hydrating Facial — Livonia, MI",
    description: "Hydration Infusion facial in Livonia, MI. Hyaluronic acid, ceramides, and hydrating mask for dry, tight skin. 60 or 90 minutes.",
    h1: "Hydration Infusion Facial",
    subhead: "Deep moisture restoration for dry, dehydrated, or tight skin — hyaluronic acid layering, ceramide infusion, and a cooling cryo hydrogel mask.",
    body: [
      "Hydration Infusion is the right facial when your skin feels tight after cleansing, looks dull or papery, or shows fine lines that disappear when you moisturize (a classic dehydration sign). The treatment layers multiple molecular weights of hyaluronic acid so moisture reaches both surface and deeper layers, then locks it in with ceramides and a barrier-supportive lipid blend.",
      "A cooling cryo hydrogel mask follows — instantly calming, plumping, and de-puffing. The 90-minute version adds a hands-and-arms hydration treatment with paraffin and a nourishing scalp massage.",
      "Particularly popular in Michigan winters and for guests on retinoids, after travel, or after sun exposure.",
    ],
    benefits: [
      "Restores hydration to dry, tight, dehydrated skin",
      "Plumps fine lines caused by dehydration",
      "Strengthens skin barrier with ceramides",
      "Cooling cryo hydrogel mask",
      "Long-lasting — results visible for a week or more",
    ],
    faqs: [
      { q: "What's the difference between dry and dehydrated skin?", a: "Dry skin lacks oil; dehydrated skin lacks water. This facial addresses both, but is especially powerful for dehydration." },
      { q: "Can oily skin benefit from this?", a: "Yes — oily skin is often dehydrated. Ceramides and hyaluronic acid don't add oil." },
      { q: "How long do results last?", a: "Most guests see results for 1-2 weeks with proper home care." },
      { q: "Is this safe in pregnancy?", a: "Yes — all ingredients are pregnancy-safe." },
    ],
    durations: ["60 min", "90 min"],
    related: ["botanical-bliss", "customized", "hydration-aloe", "radiant-glow"],
  },
  {
    slug: "radiant-glow",
    name: "Radiant Glow Facial",
    tagline: "Brightening, smoothing, and event-ready glow in 60 minutes.",
    title: "Brightening Facial — Livonia, MI",
    description: "Radiant Glow brightening facial in Livonia, MI. Glycolic and lactic acid resurfacing for event-ready glow. 60 or 90 minutes.",
    h1: "Radiant Glow Facial",
    subhead: "The right facial before a wedding, an event, or a photo session — glycolic and lactic acid resurfacing, brightening serums, and a luminizing finish.",
    body: [
      "Radiant Glow is built to make skin look its best, fast. Your esthetician begins with a double cleanse, then applies a customized glycolic/lactic acid blend that lifts dead surface cells and smooths texture. Brightening vitamin C and niacinamide serums follow, then a luminizing mask that visibly plumps and reflects light.",
      "The result is the look most guests want before an event — smoother, brighter, more even, more glowy. There's no peeling and no significant redness. Book this 24-48 hours before your event for peak results.",
      "The 90-minute version adds a LED light session and a focused under-eye treatment.",
    ],
    benefits: [
      "Visible brightening and even tone",
      "Smooths texture and softens fine lines",
      "Event-ready glow — no peeling, no downtime",
      "Vitamin C and niacinamide infusion",
      "Best booked 24-48 hours pre-event",
    ],
    faqs: [
      { q: "Will I peel afterward?", a: "No — the acid blend is calibrated for instant glow without surface peeling." },
      { q: "How long does the glow last?", a: "5-7 days with proper home care." },
      { q: "When should I book before my event?", a: "24-48 hours is ideal. Avoid the day-of in case of any flushing." },
      { q: "Can I get this if I'm using retinoids?", a: "Pause retinoids 3 days before and after. Tell your esthetician." },
    ],
    durations: ["60 min", "90 min"],
    related: ["vitamin-c-brightening", "age-defying", "hydration-infusion", "customized"],
  },
  {
    slug: "vitamin-c-brightening",
    name: "Vitamin C Brightening Facial",
    tagline: "Concentrated vitamin C treatment for pigmentation, dullness, and uneven tone.",
    title: "Vitamin C Facial — Livonia, MI",
    description: "Vitamin C Brightening facial in Livonia, MI. Concentrated L-ascorbic acid for pigmentation and uneven tone. 60 or 90 minutes.",
    h1: "Vitamin C Brightening Facial",
    subhead: "Concentrated L-ascorbic acid layered with brightening peptides — targeting pigmentation, sun damage, melasma, and dullness over a series of sessions.",
    body: [
      "Vitamin C Brightening is the right facial when you're working on stubborn pigmentation — melasma, sun spots, post-inflammatory marks from old breakouts, or general uneven tone. The treatment opens with a gentle resurfacing exfoliation to remove the top layer of dead cells that scatter light, then layers a high-percentage L-ascorbic acid serum with supporting peptides and tranexamic acid.",
      "A brightening hydrogel mask follows, then targeted spot treatment on the most pigmented areas. The 90-minute version adds LED light therapy specifically tuned to interrupt melanin production.",
      "Best results come from a series of 4-6 sessions every 2-3 weeks, paired with consistent SPF and at-home vitamin C and niacinamide.",
    ],
    benefits: [
      "Fades sun damage and post-breakout marks",
      "Brightens overall tone",
      "Supports melasma management (with proper SPF)",
      "Antioxidant protection from free radicals",
      "Compounds significantly with repeated sessions",
    ],
    faqs: [
      { q: "How fast will pigmentation fade?", a: "Visible improvement after 2-3 sessions; significant fading after a full series of 4-6." },
      { q: "Is vitamin C safe for sensitive skin?", a: "Yes — we adjust concentration. Tell your esthetician if you've reacted to vitamin C before." },
      { q: "Can I do this with melasma?", a: "Yes — it's one of the safer professional treatments for melasma when paired with daily SPF." },
      { q: "Will I be sun-sensitive after?", a: "Slightly — wear SPF 30+ daily, which you should already be doing for pigmentation results." },
    ],
    durations: ["60 min", "90 min"],
    related: ["radiant-glow", "age-defying", "peptide-renewal", "customized"],
  },
  {
    slug: "peptide-renewal",
    name: "Peptide Renewal Facial",
    tagline: "Advanced peptide therapy for collagen, firmness, and skin repair.",
    title: "Peptide Facial — Livonia, MI",
    description: "Peptide Renewal facial in Livonia, MI. Multi-peptide therapy for collagen and firmness. 60 or 90 minutes at Storm Wellness Club.",
    h1: "Peptide Renewal Facial",
    subhead: "Advanced multi-peptide therapy that signals your skin to produce collagen, repair barrier damage, and visibly firm — without the irritation of stronger actives.",
    body: [
      "Peptide Renewal is the right facial when you want serious anti-aging results without retinoid sensitivity, prescription topicals, or downtime. The treatment layers four classes of peptides — signal peptides for collagen, carrier peptides for healing, neurotransmitter-inhibiting peptides for expression lines, and enzyme-inhibiting peptides for firmness.",
      "The protocol includes an ultrasonic exfoliation, peptide serum infusion, sculpting massage, and a peptide-rich biocellulose mask that delivers actives at higher absorption than a standard sheet mask. The 90-minute version adds LED red light and a focused décolleté treatment.",
      "Excellent as a standalone or alternating with the Age-Defying facial in a long-term anti-aging strategy.",
    ],
    benefits: [
      "Stimulates natural collagen production",
      "Visibly firms without irritation",
      "Smooths expression lines",
      "Repairs barrier and supports healing",
      "Safe alongside prescription retinoids",
    ],
    faqs: [
      { q: "How is this different from the Age-Defying facial?", a: "Age-Defying uses retinol and stronger acids. Peptide Renewal stays gentle and is safe alongside prescription topicals." },
      { q: "Is this safe in pregnancy?", a: "Most peptides are pregnancy-safe — confirm with your esthetician at intake." },
      { q: "How often should I book?", a: "Every 3-4 weeks for compounding results." },
      { q: "Will I see immediate results?", a: "Yes — visible firmness and plumping after the first session." },
    ],
    durations: ["60 min", "90 min"],
    related: ["age-defying", "vitamin-c-brightening", "radiant-glow", "customized"],
  },
];

// ────────────────────────────────────────────────────────────
// BODY WRAPS
// ────────────────────────────────────────────────────────────
const bodyWraps: ServiceContent[] = [
  {
    slug: "avocado-coconut",
    name: "Nourishing Avocado & Coconut Wrap",
    tagline: "Deep nourishment for dry, depleted skin using cold-pressed avocado and coconut oils.",
    title: "Avocado & Coconut Body Wrap — Livonia, MI",
    description: "Nourishing Avocado & Coconut body wrap in Livonia, MI. Deep moisture for dry skin. Storm Wellness Club's signature wrap menu.",
    h1: "Nourishing Avocado & Coconut Wrap",
    subhead: "Deep nourishment for dry, depleted, winter-stressed skin — cold-pressed avocado oil, virgin coconut, and a warm cocoon that drives the actives in.",
    body: [
      "The Nourishing Wrap begins with a full-body dry brush to slough off dead surface cells, followed by a warm avocado-and-coconut oil application that's massaged into the skin from neck to ankles. You're then wrapped in a warm thermal cocoon for 20 minutes — the heat drives the lipids deep into the skin barrier.",
      "While you rest, your therapist performs a relaxing scalp and face massage. The wrap is removed, the skin is buffed with a warm cloth, and a final layer of body butter is sealed in. You leave with skin that feels visibly softer, more supple, and deeply moisturized — often for a full week.",
      "Particularly popular in Michigan winters and for guests with eczema-prone or chronically dry skin.",
    ],
    benefits: [
      "Deep moisture for dry, depleted skin",
      "Full-body dry brushing exfoliation",
      "Warm cocoon drives actives deep",
      "Includes scalp and face massage",
      "Skin feels soft for days",
    ],
    faqs: [
      { q: "How long is the appointment?", a: "Typically 60-75 minutes from start to finish." },
      { q: "Is this safe if I have a nut allergy?", a: "Coconut is not a tree nut and is generally safe, but tell your therapist about all allergies at intake." },
      { q: "Will I be greasy afterward?", a: "No — the oils absorb during the wrap and any excess is buffed off." },
      { q: "Can I shower right after?", a: "We recommend waiting a few hours to let the lipids continue absorbing." },
    ],
    durations: ["60 min"],
    related: ["hydration-aloe", "relaxing-chamomile", "anti-aging-collagen", "mud-therapy"],
  },
  {
    slug: "body-sculpting",
    name: "Body Sculpting Wrap",
    tagline: "Firming and contouring wrap targeting water retention and cellulite.",
    title: "Body Sculpting Wrap — Livonia, MI",
    description: "Body Sculpting wrap in Livonia, MI. Firming, contouring, and slimming treatment with caffeine and seaweed actives. Storm Wellness Club.",
    h1: "Body Sculpting Wrap",
    subhead: "A firming, contouring treatment that targets water retention, soft tissue, and the appearance of cellulite — caffeine, seaweed, and a warming cocoon.",
    body: [
      "Body Sculpting opens with a stimulating dry brush that engages lymphatic flow, followed by application of a caffeine and seaweed mask formulated to tighten the skin's surface and reduce water retention. The warm cocoon period that follows drives circulation and helps the actives penetrate.",
      "After unwrapping, your therapist performs targeted contouring massage on the abdomen, hips, thighs, and arms. You'll leave with visibly tighter skin, reduced puffiness, and improved muscle tone definition. Effects build with repeated sessions — most guests book a series of 4-6 every 1-2 weeks.",
      "Popular pre-event, pre-vacation, and as part of a longer body conditioning program alongside training and nutrition.",
    ],
    benefits: [
      "Visibly tightens and contours",
      "Reduces water retention and puffiness",
      "Caffeine and seaweed actives",
      "Stimulates circulation and lymphatic flow",
      "Best results in a series",
    ],
    faqs: [
      { q: "Will this make me lose weight?", a: "It's a contouring treatment, not weight loss. Results are visible tightening and de-puffing, not fat reduction." },
      { q: "How long do results last?", a: "5-10 days for a single session; longer with a series." },
      { q: "Is the wrap tight or uncomfortable?", a: "It's a thermal cocoon, not compression — warm and snug, not constricting." },
      { q: "Can I do this if I'm pregnant?", a: "No — caffeine wraps aren't recommended in pregnancy." },
    ],
    durations: ["60 min"],
    related: ["detox-seaweed-charcoal", "anti-aging-collagen", "lymph-and-flow", "mud-therapy"],
  },
  {
    slug: "detox-seaweed-charcoal",
    name: "Detox Seaweed & Charcoal Wrap",
    tagline: "Deep detoxification using marine seaweed and activated charcoal.",
    title: "Detox Body Wrap — Livonia, MI",
    description: "Detox Seaweed & Charcoal body wrap in Livonia, MI. Marine seaweed and activated charcoal for deep detoxification. Storm Wellness Club.",
    h1: "Detox Seaweed & Charcoal Wrap",
    subhead: "Deep detoxification through the skin — marine seaweed minerals and activated charcoal in a warm cocoon to draw impurities and support lymphatic flow.",
    body: [
      "The Detox Wrap begins with a vigorous dry brushing to open lymphatic pathways, followed by a full-body application of warm marine seaweed mud blended with activated charcoal. You're wrapped in a thermal cocoon for 25 minutes — the warmth opens pores and amplifies the drawing action of the charcoal.",
      "While you rest, your therapist performs a calming scalp and face massage. After unwrapping, the body is rinsed and buffed clean, and a light mineral oil is applied. The Extended (90-min) version doubles the cocoon time and adds a lymphatic finishing massage.",
      "Many guests pair Detox wraps with the Infrared Sauna or a Salt Room session the same day for a fully detoxifying afternoon.",
    ],
    benefits: [
      "Draws impurities through skin",
      "Marine mineral infusion (iodine, magnesium, calcium)",
      "Supports lymphatic drainage",
      "Reduces water retention and puffiness",
      "Skin looks visibly clearer and more refined",
    ],
    faqs: [
      { q: "Will it stain my skin?", a: "No — the charcoal washes clean. You may want to wear darker clothing to the appointment just in case." },
      { q: "Is this safe with thyroid conditions?", a: "Seaweed contains iodine. Tell your therapist if you have any thyroid condition — we may modify the formula." },
      { q: "How is the Extended version different?", a: "Doubled cocoon time, deeper drawing action, and an added 30-minute lymphatic massage to finish." },
      { q: "How often can I do this?", a: "Every 2-3 weeks for active detox programs." },
    ],
    durations: ["60 min", "90 min"],
    related: ["body-sculpting", "mud-therapy", "lymph-and-flow", "infrared-sauna"],
  },
  {
    slug: "brightening-vitamin-c",
    name: "Brightening Vitamin C Wrap",
    tagline: "Full-body brightening treatment for uneven tone and dullness.",
    title: "Vitamin C Body Wrap — Livonia, MI",
    description: "Brightening Vitamin C body wrap in Livonia, MI. Full-body brightening for uneven tone and post-summer pigmentation. Storm Wellness Club.",
    h1: "Brightening Vitamin C Wrap",
    subhead: "A full-body brightening treatment — vitamin C, niacinamide, and gentle fruit enzymes to even tone, fade post-summer pigmentation, and restore radiance.",
    body: [
      "The Brightening Wrap begins with a gentle enzymatic exfoliation that resurfaces dull cells across the entire body, followed by a vitamin C and niacinamide mask applied head to toe. The warm cocoon period drives the antioxidants deep while your therapist performs a relaxing facial and scalp massage.",
      "After unwrapping, the body is rinsed and buffed, and a brightening body lotion is sealed in. Skin looks visibly more even, more radiant, and softer in tone. Particularly popular at the end of summer for shoulders, chest, and arms; and year-round for guests working on uneven body tone.",
      "Effects compound with a series — most guests book every 2-3 weeks for a course of 4-6.",
    ],
    benefits: [
      "Brightens uneven body tone",
      "Fades post-summer pigmentation",
      "Antioxidant protection from free radicals",
      "Gentle fruit enzyme resurfacing",
      "Compounds with repeated sessions",
    ],
    faqs: [
      { q: "Will I be sun-sensitive after?", a: "Slightly — wear SPF on exposed areas for 24-48 hours after." },
      { q: "Can this fade old pigmentation?", a: "Yes, in a series. Single sessions brighten overall tone; series-level work fades specific marks." },
      { q: "Is it safe in pregnancy?", a: "Yes — vitamin C and niacinamide are both pregnancy-safe." },
      { q: "How often can I get this?", a: "Every 2-3 weeks." },
    ],
    durations: ["60 min"],
    related: ["vitamin-c-brightening", "radiant-glow", "hydration-aloe", "anti-aging-collagen"],
  },
  {
    slug: "anti-aging-collagen",
    name: "Anti-Aging Collagen Wrap",
    tagline: "Firming full-body wrap with marine collagen and peptides.",
    title: "Collagen Body Wrap — Livonia, MI",
    description: "Anti-Aging Collagen body wrap in Livonia, MI. Marine collagen and peptide infusion for full-body firming. 60 or 90 minutes.",
    h1: "Anti-Aging Collagen Wrap",
    subhead: "A firming, plumping full-body wrap — marine collagen, signal peptides, and a warm cocoon that drives the actives into thirsty skin.",
    body: [
      "The Collagen Wrap is the body equivalent of an anti-aging facial. Your therapist begins with a smoothing exfoliation, then applies a warm marine collagen and peptide mask from collarbone to ankles. The thermal cocoon follows for 25 minutes — warmth opens the pores and drives the collagen molecules deep into the skin.",
      "After unwrapping, a sculpting body massage tones the most-asked-about areas: arms, abdomen, thighs, and décolleté. The Extended (90-min) version adds an LED light session targeting collagen production and a focused décolleté and neck treatment.",
      "Best as part of a long-term anti-aging plan — book every 3-4 weeks to compound results.",
    ],
    benefits: [
      "Visible firming across the entire body",
      "Plumps thin or crepe-y skin",
      "Marine collagen and peptide infusion",
      "Improves elasticity over a series",
      "Extended version adds LED light therapy",
    ],
    faqs: [
      { q: "How is the Extended version different?", a: "It adds LED red light therapy and an extended décolleté and neck treatment." },
      { q: "Can vegetarians do this?", a: "Marine collagen is animal-sourced. We can substitute a plant-based peptide alternative — tell us at booking." },
      { q: "How long do results last?", a: "Visible plumping for 1-2 weeks per session; compounds significantly with a series." },
      { q: "Is this safe in pregnancy?", a: "Yes — but skip if you have a fish/shellfish allergy or request the plant-based version." },
    ],
    durations: ["60 min", "90 min"],
    related: ["body-sculpting", "brightening-vitamin-c", "peptide-renewal", "age-defying"],
  },
  {
    slug: "mud-therapy",
    name: "Mud Therapy Wrap",
    tagline: "Mineral-rich therapeutic mud wrap for sore muscles and joint relief.",
    title: "Mud Wrap — Livonia, MI",
    description: "Mud Therapy wrap in Livonia, MI. Mineral-rich therapeutic mud for sore muscles and joint relief. Storm Wellness Club.",
    h1: "Mud Therapy Wrap",
    subhead: "A mineral-rich therapeutic mud wrap that soothes sore muscles, eases joint stiffness, and draws excess fluid — deeply relaxing and restorative.",
    body: [
      "Mud Therapy uses mineral-dense therapeutic mud — naturally rich in magnesium, calcium, sulfur, and silica — applied warm across the full body. The thermal cocoon period drives the minerals into joints and muscles, easing stiffness, calming inflammation, and creating one of the most deeply relaxing experiences in the spa.",
      "Particularly effective for guests with chronic muscle soreness, mild arthritis, or post-training inflammation. Many members pair Mud Therapy with the Sauna & Steam Room or the Salt Room on the same visit for amplified therapeutic effect.",
      "After unwrapping, the body is rinsed clean and a light moisturizer is applied. Most guests report deep relaxation that lasts the rest of the day.",
    ],
    benefits: [
      "Eases sore muscles and joint stiffness",
      "Mineral-rich (magnesium, calcium, sulfur)",
      "Deeply calming for the nervous system",
      "Improves circulation",
      "Excellent for post-training recovery",
    ],
    faqs: [
      { q: "Does it smell?", a: "There's a mild earthy/mineral scent that most guests find grounding." },
      { q: "Will it stain?", a: "No — the mud rinses clean. Darker clothing is still recommended just in case." },
      { q: "Is this safe with arthritis?", a: "Generally yes — the warmth and minerals often ease symptoms. Confirm with your physician for severe cases." },
      { q: "Can I do this if I have sensitive skin?", a: "Yes — therapeutic mud is gentle. Tell your therapist about any sensitivities." },
    ],
    durations: ["60 min"],
    related: ["detox-seaweed-charcoal", "anti-aging-collagen", "deep-relief", "sauna-steam"],
  },
  {
    slug: "hydration-aloe",
    name: "Hydration Boost Aloe Vera Wrap",
    tagline: "Cooling aloe wrap for sun-exposed, irritated, or summer-dry skin.",
    title: "Aloe Vera Body Wrap — Livonia, MI",
    description: "Hydration Boost Aloe Vera body wrap in Livonia, MI. Cooling treatment for sun-exposed and irritated skin. Storm Wellness Club.",
    h1: "Hydration Boost Aloe Vera Wrap",
    subhead: "A cooling, calming aloe vera wrap that restores moisture, soothes sun-exposed skin, and rebuilds the barrier after summer or harsh weather.",
    body: [
      "The Aloe Wrap is built around cold-pressed aloe vera, which calms heat, reduces redness, and delivers immediate hydration. After a gentle full-body exfoliation, your therapist applies a thick aloe and cucumber mask from neck to ankles. The cocoon is at a cooler temperature than other wraps — the goal is calming, not heat-driving.",
      "Particularly excellent after sun exposure, post-vacation, post-flight, after intense exercise outdoors, or simply when your skin feels reactive. The cooling sensation is immediate, and most guests describe the experience as deeply restorative.",
      "Safe for pregnancy, sensitive skin, and post-sun recovery.",
    ],
    benefits: [
      "Immediately cooling and calming",
      "Restores hydration after sun exposure",
      "Reduces redness and inflammation",
      "Pregnancy and sensitive-skin safe",
      "Rebuilds skin barrier",
    ],
    faqs: [
      { q: "Is this good for sunburn?", a: "Yes — one of the best treatments for sun-exposed skin. Book within 24-48 hours of exposure for best results." },
      { q: "Is it cold?", a: "Cool, not cold — calming but not uncomfortable." },
      { q: "Can I get this in winter?", a: "Yes — also excellent for skin irritated by harsh weather and indoor heating." },
      { q: "How often is too often?", a: "Weekly is fine — it's a gentle treatment." },
    ],
    durations: ["60 min"],
    related: ["avocado-coconut", "relaxing-chamomile", "hydration-infusion", "brightening-vitamin-c"],
  },
  {
    slug: "relaxing-chamomile",
    name: "Relaxing Chamomile Wrap",
    tagline: "Deeply calming wrap for stress, anxiety, and overworked nervous systems.",
    title: "Chamomile Relaxation Wrap — Livonia, MI",
    description: "Relaxing Chamomile body wrap in Livonia, MI. Deeply calming treatment for stress and nervous system reset. Storm Wellness Club.",
    h1: "Relaxing Chamomile Wrap",
    subhead: "Deeply calming aromatherapy wrap — chamomile, lavender, and warm herbal infusion — designed for stress, anxiety, sleep support, and full nervous system reset.",
    body: [
      "The Chamomile Wrap is the most relaxing service in the spa. The treatment opens with a gentle dry brushing, followed by a warm chamomile and lavender herbal infusion applied across the body. The thermal cocoon is warm and snug, and the aromatherapy is dosed to be sleep-inducing.",
      "While you rest, your therapist performs a slow scalp and face massage focused on the points that most release tension — temples, jaw, brow, and base of skull. Many guests fall asleep during the wrap. After unwrapping, a light chamomile-infused lotion is applied.",
      "Excellent the day before a stressful event, after a difficult week, or as part of a sleep-quality reset. Many members book monthly for general stress management.",
    ],
    benefits: [
      "Profoundly calming for the nervous system",
      "Supports better sleep that night",
      "Reduces stress and anxiety",
      "Chamomile and lavender aromatherapy",
      "Includes scalp and facial pressure-point massage",
    ],
    faqs: [
      { q: "Will I fall asleep?", a: "Many guests do. The treatment is designed to take you fully out of fight-or-flight." },
      { q: "Is this safe in pregnancy?", a: "Yes — chamomile and lavender are pregnancy-safe at the doses we use." },
      { q: "How does this help sleep?", a: "The combination of warmth, aromatherapy, and nervous system regulation often improves sleep that night significantly." },
      { q: "Can I get this if I have allergies?", a: "Tell your therapist — chamomile is in the ragweed family. We can substitute lavender-only." },
    ],
    durations: ["60 min"],
    related: ["avocado-coconut", "hydration-aloe", "prenatal", "heart-chakra"],
  },
];

// ────────────────────────────────────────────────────────────
// BODY RITUALS (chakra-themed)
// ────────────────────────────────────────────────────────────
const bodyRituals: ServiceContent[] = [
  {
    slug: "root-chakra",
    name: "Root Chakra Ritual",
    tagline: "Grounding ritual for stability, security, and reconnection with the body.",
    title: "Root Chakra Ritual — Livonia, MI",
    description: "Root Chakra Ritual in Livonia, MI. Grounding spa ritual for stability and reconnection. Storm Wellness Club's body ritual menu.",
    h1: "Root Chakra Ritual",
    subhead: "A grounding ritual built around earth aromatherapy, warming oils, and deep foot and leg work — designed for guests feeling scattered, anxious, or disconnected.",
    body: [
      "The Root Chakra Ritual is designed for anyone who feels ungrounded — anxious, scattered, post-travel, post-life-event, or simply disconnected from their body. The ritual opens with intention-setting and an aromatherapy blend featuring patchouli, vetiver, and cedarwood — earth-element oils that quiet the mind.",
      "The bodywork emphasizes the feet, calves, legs, and low back — the physical regions associated with stability and groundedness. Warming oils, slow rhythmic strokes, and reflexology technique are layered with red jasper stone placement at the base of the spine.",
      "The session closes with a brief grounding meditation and a warm herbal tea. Most guests leave feeling visibly calmer, more present, and physically heavier in a settled way.",
    ],
    benefits: [
      "Calms anxiety and racing thoughts",
      "Reconnects mind and body after stress",
      "Deep foot, leg, and low-back work",
      "Earth-element aromatherapy",
      "Includes brief guided grounding meditation",
    ],
    faqs: [
      { q: "Do I need to believe in chakras?", a: "No. The ritual works on the body and nervous system regardless of belief. The chakra framing is a thematic anchor for the treatment design." },
      { q: "How long is the ritual?", a: "Typically 75 minutes total." },
      { q: "Is this religious?", a: "No — it's a wellness ritual, not a religious practice." },
      { q: "Can I do this if I'm pregnant?", a: "Yes — we modify pressure and positioning for prenatal guests." },
    ],
    durations: ["75 min"],
    related: ["sacral-chakra", "solar-plexus-chakra", "heart-chakra", "relaxing-chamomile"],
  },
  {
    slug: "sacral-chakra",
    name: "Sacral Chakra Ritual",
    tagline: "Creative-flow ritual for emotional release, hip-opening, and reconnection with pleasure.",
    title: "Sacral Chakra Ritual — Livonia, MI",
    description: "Sacral Chakra Ritual in Livonia, MI. Hip-opening, emotional-release spa ritual. Storm Wellness Club's body ritual menu.",
    h1: "Sacral Chakra Ritual",
    subhead: "A flowing, hip-opening ritual designed for emotional release, creative reconnection, and movement in places where the body has been holding for too long.",
    body: [
      "The Sacral Chakra Ritual focuses on the hips, low belly, and pelvic region — the parts of the body where emotional holding shows up most for many guests. The treatment uses warm orange-toned oils with neroli, sweet orange, and ylang ylang, applied with flowing strokes that mimic water — slow, rhythmic, and unhurried.",
      "Deep hip release work, gentle psoas attention (over the clothing), and abdominal massage (only with consent) are layered with carnelian stone placement. The bodywork can sometimes prompt emotional release — tears or laughter — which the therapist welcomes without comment.",
      "Particularly meaningful for guests working through grief, creative blocks, postpartum recovery, or simply chronic hip tightness from sitting.",
    ],
    benefits: [
      "Releases chronic hip and pelvic tension",
      "Supports emotional processing",
      "Flowing, rhythmic bodywork",
      "Water-element aromatherapy",
      "Particularly helpful for sit-all-day bodies",
    ],
    faqs: [
      { q: "What if I get emotional during the session?", a: "It's completely normal and welcomed. Your therapist will hold space without comment." },
      { q: "Is the abdominal work invasive?", a: "Only over the drape and only with consent. We never go below the waistline of underwear." },
      { q: "Can I do this postpartum?", a: "Yes — after your 6-week clearance. Excellent for postpartum recovery." },
      { q: "How long is the ritual?", a: "75 minutes total." },
    ],
    durations: ["75 min"],
    related: ["root-chakra", "solar-plexus-chakra", "heart-chakra", "lymph-and-flow"],
  },
  {
    slug: "solar-plexus-chakra",
    name: "Solar Plexus Chakra Ritual",
    tagline: "Energizing ritual for confidence, digestion, and core vitality.",
    title: "Solar Plexus Chakra Ritual — Livonia, MI",
    description: "Solar Plexus Chakra Ritual in Livonia, MI. Energizing spa ritual for confidence and core vitality. Storm Wellness Club.",
    h1: "Solar Plexus Chakra Ritual",
    subhead: "An energizing ritual focused on the core, midback, and diaphragm — designed for guests rebuilding confidence, working through digestive issues, or recovering vitality.",
    body: [
      "The Solar Plexus Ritual targets the abdomen, midback, ribs, and diaphragm. The aromatherapy is bright and warming — bergamot, ginger, and lemon — meant to energize rather than sedate. The bodywork includes a careful abdominal massage (over the drape), midback release, rib mobility work, and breath-focused techniques that open the diaphragm.",
      "Citrine stone is placed at the solar plexus during the session, and guided breathwork closes the ritual. Particularly meaningful for guests recovering from a long illness, working on digestive concerns, or rebuilding a sense of agency and confidence after a difficult chapter.",
      "Energizing rather than sedating — book this when you want to leave feeling alive, not drowsy.",
    ],
    benefits: [
      "Energizes and uplifts",
      "Supports digestion and core function",
      "Opens diaphragm and improves breath capacity",
      "Bright, warming citrus aromatherapy",
      "Includes guided breathwork",
    ],
    faqs: [
      { q: "Will I feel tired or energized after?", a: "Energized. This is the most uplifting of the chakra rituals." },
      { q: "Can this help with digestion?", a: "Many guests report better digestion after — the abdominal work and diaphragm release support GI function." },
      { q: "Is this safe with reflux?", a: "Yes, with positioning modifications. Tell your therapist at intake." },
      { q: "Is this safe in pregnancy?", a: "We modify significantly — confirm trimester at booking." },
    ],
    durations: ["75 min"],
    related: ["root-chakra", "sacral-chakra", "heart-chakra", "throat-chakra"],
  },
  {
    slug: "heart-chakra",
    name: "Heart Chakra Ritual",
    tagline: "Opening ritual for chest, shoulders, and the spaces grief and stress live.",
    title: "Heart Chakra Ritual — Livonia, MI",
    description: "Heart Chakra Ritual in Livonia, MI. Opening spa ritual for chest, shoulders, and emotional release. Storm Wellness Club.",
    h1: "Heart Chakra Ritual",
    subhead: "An opening ritual for the chest, shoulders, upper back, and arms — designed for guests carrying grief, loneliness, or chronic tension across the heart line.",
    body: [
      "The Heart Chakra Ritual focuses on the upper chest, collarbones, shoulders, upper back, and arms — the regions where grief, anxiety, and 'desk posture' collapse the heart line. The aromatherapy is rose, geranium, and bergamot — gentle, opening, emotionally regulating.",
      "The bodywork emphasizes pec release, shoulder rolling, upper back unwinding, and arm-and-hand work. Rose quartz is placed at the sternum during the session. The treatment often surfaces unexpected emotion — your therapist welcomes whatever comes up without comment.",
      "Particularly meaningful for guests in grief, going through life transitions, recovering from heartbreak, or simply chronically tight across the chest and shoulders.",
    ],
    benefits: [
      "Releases chest, shoulder, and upper-back tension",
      "Supports emotional processing of grief or transition",
      "Rose and geranium aromatherapy",
      "Reverses 'desk posture' collapse",
      "Holds space for emotional release",
    ],
    faqs: [
      { q: "What if I cry during the session?", a: "It's welcomed and held without comment. Tissues are always within reach." },
      { q: "Can this help with grief?", a: "Many guests find it deeply supportive during grief — though it's not a replacement for therapy." },
      { q: "Is this only for emotional concerns?", a: "No — also excellent for anyone with chronic chest, shoulder, or upper back tightness." },
      { q: "How long is the ritual?", a: "75 minutes." },
    ],
    durations: ["75 min"],
    related: ["throat-chakra", "third-eye-chakra", "sacral-chakra", "relaxing-chamomile"],
  },
  {
    slug: "throat-chakra",
    name: "Throat Chakra Ritual",
    tagline: "Voice-supporting ritual for jaw, neck, throat, and self-expression.",
    title: "Throat Chakra Ritual — Livonia, MI",
    description: "Throat Chakra Ritual in Livonia, MI. Spa ritual for jaw, neck, and self-expression. Storm Wellness Club.",
    h1: "Throat Chakra Ritual",
    subhead: "A focused ritual for the jaw, neck, throat, and voice — designed for guests with TMJ, chronic neck tension, or feeling unable to speak their truth.",
    body: [
      "The Throat Chakra Ritual targets the jaw (including intraoral work with consent and gloves), the front and back of the neck, the upper trapezius, and the base of the skull. The aromatherapy is eucalyptus, peppermint, and blue tansy — clearing, opening, slightly cooling.",
      "The bodywork includes craniosacral technique, careful neck mobility work, intraoral TMJ release (optional), and shoulder unwinding. Aquamarine stone is placed at the throat. Many guests report a profound sense of clarity afterward — both physical (jaw, neck, breath) and emotional.",
      "Particularly meaningful for teeth-grinders, chronic neck-tension sufferers, voice professionals, and guests working on communication or boundary-setting in their lives.",
    ],
    benefits: [
      "Releases jaw, neck, and TMJ tension",
      "Cooling, clearing aromatherapy",
      "Intraoral TMJ work available with consent",
      "Improves neck mobility",
      "Supports voice professionals",
    ],
    faqs: [
      { q: "What is intraoral work?", a: "Gloved release of the jaw muscles from inside the mouth. Always optional and only with explicit consent." },
      { q: "Does this help TMJ?", a: "Yes — one of the most effective treatments for TMJ tension." },
      { q: "Can I get this if I have a stiff neck?", a: "Yes — this is specifically designed for chronic neck issues." },
      { q: "How long is the ritual?", a: "75 minutes." },
    ],
    durations: ["75 min"],
    related: ["heart-chakra", "third-eye-chakra", "crown-chakra", "deep-relief"],
  },
  {
    slug: "third-eye-chakra",
    name: "Third Eye Chakra Ritual",
    tagline: "Quieting ritual for the mind, headaches, eye strain, and overactive thinking.",
    title: "Third Eye Chakra Ritual — Livonia, MI",
    description: "Third Eye Chakra Ritual in Livonia, MI. Calming spa ritual for the mind and headache relief. Storm Wellness Club.",
    h1: "Third Eye Chakra Ritual",
    subhead: "A quieting ritual focused on the head, face, eyes, and brow — designed for guests with chronic headaches, eye strain, mental overwhelm, or insomnia from racing thoughts.",
    body: [
      "The Third Eye Ritual focuses entirely on the head, face, and upper neck. The aromatherapy is frankincense, lavender, and clary sage — quieting, meditative, sleep-supporting. The bodywork includes facial pressure-point release, scalp massage, indian-style hair pulling, eye-area work, and brow and temple release.",
      "Amethyst is placed at the brow during the session, and the room is darkened. Many guests describe the experience as the deepest mental quiet they've felt in months. Particularly meaningful for guests with chronic tension headaches, screen-strain, insomnia, or mental overwhelm.",
      "An excellent choice the day before a stressful event, after a difficult week of intense thinking, or as part of an insomnia reset.",
    ],
    benefits: [
      "Relieves tension headaches",
      "Reduces eye strain from screens",
      "Supports better sleep that night",
      "Profoundly calming for racing thoughts",
      "Includes deep scalp and face work",
    ],
    faqs: [
      { q: "Will this help my migraines?", a: "Many migraine sufferers find significant relief, though we can't guarantee it. Tell your therapist your specific patterns at intake." },
      { q: "Is this just a head massage?", a: "It includes deep head, face, and scalp work — but it's a full ritual with aromatherapy and stone placement, not just massage." },
      { q: "Is it safe in pregnancy?", a: "Yes." },
      { q: "How long is the ritual?", a: "75 minutes." },
    ],
    durations: ["75 min"],
    related: ["crown-chakra", "throat-chakra", "heart-chakra", "relaxing-chamomile"],
  },
  {
    slug: "crown-chakra",
    name: "Crown Chakra Ritual (Integration)",
    tagline: "Closing ritual to integrate the work — meditation, sound, and stillness.",
    title: "Crown Chakra Integration Ritual — Livonia, MI",
    description: "Crown Chakra Ritual in Livonia, MI. Integration spa ritual with meditation and sound. Storm Wellness Club.",
    h1: "Crown Chakra Ritual (Integration)",
    subhead: "A closing, integrative ritual — meant to be booked at the end of a chakra series or anytime you need stillness, perspective, and full nervous system reset.",
    body: [
      "The Crown Ritual is the most still of our offerings. It's not a full bodywork session — instead, the treatment combines a brief grounding head and shoulder massage, sound therapy (singing bowls or tuning forks at your preference), a guided meditation, and an extended stillness period under weighted blankets.",
      "The aromatherapy is sandalwood, frankincense, and lotus — meditative, ceremonial, spacious. Clear quartz and amethyst are placed at the crown and brow. The room is held in silence for the meditation period, and many guests describe it as one of the most reset experiences they've ever had.",
      "Best booked as the closing session of a chakra series, after a period of intense life stress, or as a quarterly nervous system reset.",
    ],
    benefits: [
      "Profound nervous system reset",
      "Includes sound therapy and guided meditation",
      "Weighted blanket stillness period",
      "Integrative — ties together prior chakra work",
      "Quarterly reset for high-stress lives",
    ],
    faqs: [
      { q: "Do I need to do the other chakra rituals first?", a: "No — it's powerful as a standalone, but it does deepen if you've done others first." },
      { q: "What is sound therapy?", a: "Singing bowls, tuning forks, or chimes played around the body during stillness. You can opt out if you prefer silence." },
      { q: "Is this religious?", a: "No — it's a contemplative wellness practice." },
      { q: "How long is the ritual?", a: "75 minutes." },
    ],
    durations: ["75 min"],
    related: ["third-eye-chakra", "heart-chakra", "root-chakra", "relaxing-chamomile"],
  },
];

// ────────────────────────────────────────────────────────────
// RECOVERY (only "Sports Stretching" gets a new sub-page — others have own routes)
// ────────────────────────────────────────────────────────────
const recovery: ServiceContent[] = [
  {
    slug: "sports-stretching",
    name: "Sports Stretching",
    tagline: "Assisted stretching session for mobility, flexibility, and injury prevention.",
    title: "Assisted Stretching — Livonia, MI",
    description: "Sports Stretching in Livonia, MI. Assisted PNF stretching for mobility, flexibility, and injury prevention. 60 or 90 minutes.",
    h1: "Sports Stretching (Assisted)",
    subhead: "A one-on-one assisted stretching session — PNF technique, dynamic mobility work, and targeted release for the joints and muscles your training relies on.",
    body: [
      "Sports Stretching is one-on-one assisted flexibility work performed by a trained practitioner. You stay clothed and rest on a stretching table while your practitioner moves your limbs through ranges that are difficult or impossible to access on your own. The technique combines passive stretching, PNF (proprioceptive neuromuscular facilitation), and dynamic mobility work.",
      "The session is tailored to your sport, your training schedule, and your specific tight spots. Runners and cyclists usually focus on hips, hamstrings, and calves; lifters on hips, shoulders, and thoracic spine; CrossFit athletes on overhead shoulder mobility and squat position.",
      "Particularly powerful as a recovery session 1-2 days after intense training, or as a primer before a heavy workout. The 90-minute version covers the full body unhurried; 60 minutes is a focused session on 2-3 areas.",
    ],
    benefits: [
      "Improves mobility and flexibility faster than solo stretching",
      "Targets the specific ranges your training demands",
      "PNF technique accesses deeper range",
      "Reduces injury risk",
      "Pair with massage or red light for full recovery",
    ],
    faqs: [
      { q: "Do I stay clothed?", a: "Yes — wear athletic clothing you can move in." },
      { q: "Is this like yoga?", a: "No — you're passive on the table while the practitioner moves you. It accesses ranges yoga can't." },
      { q: "How often should I book?", a: "Weekly in heavy training; every 2-3 weeks for maintenance." },
      { q: "Will I be sore after?", a: "Mild soreness for 24 hours is possible if your tissues were very tight." },
    ],
    durations: ["60 min", "90 min"],
    related: ["sports-performance", "deep-relief", "storm-signature", "lymph-and-flow"],
  },
];

// ────────────────────────────────────────────────────────────
// CATEGORIES
// ────────────────────────────────────────────────────────────
export const SPA_CATEGORIES: Record<string, CategoryContent> = {
  massage: {
    slug: "massage",
    name: "Massage",
    dbCategory: "Massage",
    h1: "Massage Therapy in Livonia, MI",
    subhead: "Licensed massage therapists, private treatment rooms, and five distinct modalities — Swedish, deep tissue, sports, lymphatic, and prenatal — booked online in under a minute.",
    title: "Massage Therapy Livonia, MI | Licensed Massage Therapists",
    description: "Massage therapy in Livonia, MI with licensed massage therapists. Swedish, deep tissue, sports, lymphatic drainage & prenatal massage. 60 or 90 minutes, open to the public.",
    intro: [
      "Storm Wellness Club's Aella Spa offers five distinct massage modalities in Livonia, Michigan, each performed by a licensed, Michigan-certified massage therapist in a private, quiet, temperature-controlled treatment room. Choose the session that matches what your body needs that day.",
      "Swedish-style work in the Storm Signature Massage calms the nervous system with flowing, medium-pressure strokes — the right starting point if you want general relaxation and better sleep. Deep tissue work in the Deep Relief Massage uses slower, sustained pressure through the deeper muscle layers to release chronic knots in the back, neck, and shoulders. Sports massage in the Sports Performance session combines active stretching and trigger-point work for athletes training, competing, or recovering from hard sessions. Lymph & Flow uses light rhythmic drainage strokes to reduce fluid retention and post-surgical swelling, and Prenatal Massage is delivered by therapists trained in safe second- and third-trimester positioning and support.",
      "Every therapist on our team holds an active Michigan massage therapy license and completes ongoing modality-specific training. Sessions run 60 or 90 minutes and include warmed organic oil and hot towels. Members receive 5–12% off depending on tier. Non-members are welcome — simply create a portal account and sign a waiver before your first appointment.",
    ],

    services: massage,
  },
  facials: {
    slug: "facials",
    name: "Facials",
    dbCategory: "Facials",
    h1: "Facials in Livonia, MI",
    subhead: "Customized and targeted facials performed by licensed estheticians — every skin type, every concern, every season.",
    title: "Facials — Livonia, MI",
    description: "Facials in Livonia, MI. Customized, anti-aging, hydrating, brightening, and detox facials at Storm Wellness Club's Aella Spa.",
    intro: [
      "Our facial menu spans the full range of skin needs — from the Customized Facial (built around your skin that day) to targeted treatments for anti-aging, hydration, brightening, detox, and barrier repair.",
      "All facials are performed by licensed estheticians under professional magnification, using medical-grade products and including a written take-home recommendation.",
    ],
    services: facials,
  },
  "body-wraps": {
    slug: "body-wraps",
    name: "Body Wraps",
    dbCategory: "Body Wraps",
    h1: "Body Wraps in Livonia, MI",
    subhead: "Full-body therapeutic wraps for nourishment, detoxification, brightening, firming, and deep relaxation.",
    title: "Body Wraps — Livonia, MI",
    description: "Body wraps in Livonia, MI. Nourishing, detoxifying, brightening, firming, and relaxing full-body wrap treatments. Storm Wellness Club.",
    intro: [
      "Body wraps are one of the most under-appreciated treatments in modern spa work. They combine full-body exfoliation, active-rich masks, a thermal cocoon, and targeted bodywork — delivering results across the entire body that no single facial or massage can match.",
      "Our wrap menu includes nine distinct treatments addressing dry skin, congestion, pigmentation, firmness, water retention, sore muscles, sun damage, and deep relaxation.",
    ],
    services: bodyWraps,
  },
  "body-rituals": {
    slug: "body-rituals",
    name: "Body Rituals",
    dbCategory: "Body Rituals",
    h1: "Body Rituals in Livonia, MI",
    subhead: "Themed wellness rituals combining bodywork, aromatherapy, stone placement, and meditation — designed for nervous system reset.",
    title: "Body Rituals — Livonia, MI",
    description: "Body rituals in Livonia, MI. Chakra-themed spa rituals combining bodywork, aromatherapy, and meditation. Storm Wellness Club.",
    intro: [
      "Our body rituals are 75-minute themed wellness experiences — each built around a chakra-aligned focus area, aromatherapy blend, stone placement, and bodywork emphasis. They sit between a traditional massage and a guided meditation, and are designed for deeper nervous system work than a single-modality service.",
      "You don't need to believe in chakras to receive the benefit — the framework simply organizes the treatment design. The bodywork, aromatherapy, and stillness do the work.",
    ],
    services: bodyRituals,
  },
  recovery: {
    slug: "recovery",
    name: "Recovery",
    dbCategory: "Recovery",
    h1: "Recovery Modalities in Livonia, MI",
    subhead: "Red Light Therapy, Cryotherapy, Cold Plunge, Infrared Sauna, Salt Room, Sauna & Steam, ZeroBody Cryo, and Assisted Stretching — under one roof.",
    title: "Recovery Spa — Livonia, MI",
    description: "Recovery modalities in Livonia, MI. Red light, cryotherapy, cold plunge, infrared sauna, salt room, and assisted stretching at Storm Wellness Club.",
    intro: [
      "Storm Wellness Club houses the most complete recovery suite in the Detroit metro area. Members and guests can stack multiple modalities in a single visit — for example: assisted stretching, followed by red light therapy, followed by a cold plunge — for a complete recovery protocol.",
      "Each modality has its own dedicated page below with full details, protocols, and FAQs.",
    ],
    services: recovery,
  },
};

// Flat lookup helpers
export function getCategory(slug: string): CategoryContent | undefined {
  return SPA_CATEGORIES[slug];
}

export function getService(categorySlug: string, serviceSlug: string): ServiceContent | undefined {
  return SPA_CATEGORIES[categorySlug]?.services.find((s) => s.slug === serviceSlug);
}

export const ALL_CATEGORY_SLUGS = Object.keys(SPA_CATEGORIES);
