// Aella Body Lab — owner-supplied copy for Aella Sculpt (Spa Aella new service build).
// Presentation copy only: prices, packages and treatment zones will come from admin
// settings once the service is set up, so none are hard-coded here.

export const BODY_LAB = {
  name: "Aella Body Lab",
  descriptor: "Body Sculpting & Contouring",
};

export const AELLA_SCULPT = {
  name: "Aella Sculpt",
  subtitle: "90-Minute Multi-Modality Body Contouring",
  card:
    "A layered contouring treatment combining advanced technology with hands-on sculpting. Designed to address localized areas, support visible contour and improve the appearance of smoother, firmer-looking skin over a progressive treatment series.",
  minutes: 90,
  heroLine: "A layered approach to body contouring.",
  intro: [
    "Aella Sculpt is our 90-minute multi-modality body contouring treatment designed to address more than one component of visible body shape at a time.",
    "Rather than relying on a single technology, each treatment combines targeted energy-based modalities with intentional hands-on sculpting.",
    "Fat cavitation, targeted ultrasound therapy, radiofrequency, lipo laser, manual massage and wood therapy are layered according to the treatment area and individual goals.",
  ],
  intention: ["The intention is not weight loss.", "It is refinement."],
  designedForIntro: "Aella Sculpt is intended for clients seeking targeted attention to localized areas of the body.",
  designedFor: [
    { title: "Contour", body: "Support a more refined appearance in targeted areas." },
    { title: "Smooth", body: "Improve the appearance and texture of the treated area." },
    { title: "Firm", body: "Incorporate radiofrequency and targeted techniques to support firmer-looking skin." },
    { title: "Sculpt", body: "Combine technology with hands-on bodywork rather than relying on a machine alone." },
  ],
  technologies: [
    {
      title: "Fat Cavitation",
      body: "Ultrasound-based cavitation is used to target localized areas of subcutaneous tissue as part of the overall contouring protocol. It is incorporated strategically according to the treatment area and goals rather than offered as an isolated machine treatment.",
    },
    {
      title: "Targeted Ultrasound Therapy",
      body: "A separate targeted ultrasound modality is incorporated into the treatment according to the selected area, tissue characteristics and treatment protocol.",
    },
    {
      title: "Radiofrequency",
      body: "Controlled radiofrequency energy is incorporated to complement the contouring process while supporting the appearance of smoother and firmer-looking skin.",
    },
    {
      title: "Lipo Laser",
      body: "Low-level laser technology is used as another non-invasive component of the contouring protocol and is layered into the treatment according to the area being addressed.",
    },
    {
      title: "Manual Sculpting",
      body: "Hands-on massage allows the provider to work directly with the tissue and selected contouring area rather than relying exclusively on device-based treatment.",
    },
    {
      title: "Wood Therapy",
      body: "Specialized wooden tools are incorporated to support tissue mobilization, circulation and the appearance of smoother, more defined contours.",
    },
  ],
  focusTitle: "One Treatment. One Focus.",
  focusBody:
    "Each 90-minute appointment focuses on one intentional treatment zone, so there is time for every technology and manual technique being used.",
  // Treatment zones are staff-managed rows (spa_treatment_zones), read through src/lib/spaZones.ts.
  series: [
    {
      count: "4 Treatments",
      name: "The Foundation",
      body: "The minimum course we recommend for clients beginning a structured contouring plan or focusing on a smaller treatment goal.",
      recommended: false,
    },
    {
      count: "6 Treatments",
      name: "The Aella Series",
      body: "Our ideal starting series for clients pursuing a more intentional and progressive contouring goal.",
      recommended: true,
    },
    {
      count: "8–12 Treatments",
      name: "The Extended Series",
      body: "Designed for clients pursuing a more comprehensive contouring program, larger treatment goals or continued progressive treatment.",
      recommended: false,
    },
  ],
  seriesNote:
    "Individual response varies. Your provider will recommend a treatment course based on your starting point, selected area, tissue characteristics and desired outcome.",
  is: "Aella Sculpt is a non-invasive aesthetic body-contouring treatment.",
  isnt: [
    "A weight-loss treatment",
    "A treatment for obesity",
    "Surgical liposuction",
    "A replacement for nutrition or physical activity",
    "A guaranteed inch-loss treatment",
  ],
  isntNote: "Results and response vary between individuals.",
  firstVisitTitle: "Your First Aella Sculpt Appointment",
  firstVisitLine: "No separate consultation needed. Your assessment happens as part of your first 90-minute appointment.",
  firstVisit: [
    "Review of treatment goals",
    "Selected treatment area",
    "Relevant health-history and contraindication screening",
    "Required consent",
    "Baseline assessment",
    "Optional standardized progress photographs",
    "Optional baseline measurements",
    "90-minute treatment",
    "Provider recommendation for treatment series",
    "Post-treatment guidance",
  ],
  visitTypes: [
    { id: "first", label: "First Aella Sculpt Treatment", note: "Your intake and consent forms open as soon as you book. Your provider reviews them before your first treatment." },
    { id: "returning", label: "Returning Aella Sculpt Treatment", note: "Continue your series." },
  ],
};
