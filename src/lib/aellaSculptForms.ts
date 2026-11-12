// Aella Sculpt first-visit forms: question visibility and completeness rules, consent wording.
// Screening questions and their review rules live in the database (spa_screening_questions) and are
// edited by managers; the database grades the answers. Consent wording is the owner's text, verbatim.

export type AnswerType = "yes_no" | "yes_no_unsure" | "multi" | "text";

export interface ScreeningQuestion {
  id: string;
  service_key: string;
  section: string;
  title: string | null;
  prompt: string;
  answer_type: AnswerType;
  options: string[] | null;
  exclusive_option: string | null;
  detail_prompt: string | null;
  detail_on: string[];
  review_on: string[];
  hold_on: string[];
  zone_ids: string[] | null;
  parent_id: string | null;
  show_when: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export type Answer = { answer: string | string[] | null; detail?: string | null };
export type Answers = Record<string, Answer>;

export const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
export const YES_NO_UNSURE = [...YES_NO, { value: "not_sure", label: "Not Sure" }];

/** The answers a question can have, as stored values. */
export function answerChoices(q: Pick<ScreeningQuestion, "answer_type" | "options">): { value: string; label: string }[] {
  if (q.answer_type === "yes_no") return YES_NO;
  if (q.answer_type === "yes_no_unsure") return YES_NO_UNSURE;
  if (q.answer_type === "multi") return (q.options ?? []).map((o) => ({ value: o, label: o }));
  return [];
}

export const valuesOf = (a: Answer | undefined): string[] =>
  !a || a.answer == null ? [] : Array.isArray(a.answer) ? a.answer : String(a.answer).trim() ? [String(a.answer)] : [];

/** Follow-up questions show only when the parent's answer matches. */
export function isShown(q: ScreeningQuestion, answers: Answers): boolean {
  if (!q.parent_id) return true;
  const parent = valuesOf(answers[q.parent_id]);
  return (q.show_when ?? []).some((v) => parent.includes(v));
}

export const needsDetail = (q: ScreeningQuestion, answers: Answers): boolean =>
  !!q.detail_prompt && (q.detail_on ?? []).some((v) => valuesOf(answers[q.id]).includes(v));

/** Multi-select toggle: "None of the above" clears the others and vice versa. */
export function toggleMulti(q: ScreeningQuestion, current: string[], option: string): string[] {
  if (current.includes(option)) return current.filter((o) => o !== option);
  if (q.exclusive_option && option === q.exclusive_option) return [option];
  return [...current.filter((o) => o !== q.exclusive_option), option];
}

/** First unanswered required question (or missing follow-up detail), or null when the form is complete. */
export function firstMissing(questions: ScreeningQuestion[], answers: Answers): ScreeningQuestion | null {
  for (const q of questions) {
    if (!q.is_active || !isShown(q, answers)) continue;
    if (q.is_required && valuesOf(answers[q.id]).length === 0) return q;
    if (needsDetail(q, answers) && !(answers[q.id]?.detail ?? "").trim()) return q;
  }
  return null;
}

/** Drop answers to questions that are hidden or inactive so nothing stale is saved. */
export function cleanAnswers(questions: ScreeningQuestion[], answers: Answers): Answers {
  const out: Answers = {};
  for (const q of questions) {
    if (!q.is_active || !isShown(q, answers)) continue;
    const a = answers[q.id];
    if (!a) continue;
    out[q.id] = { answer: a.answer, detail: needsDetail(q, answers) ? (a.detail ?? "").trim() || null : null };
  }
  return out;
}

export const SCREENING_INTRO =
  "Please answer the following carefully. Some conditions do not necessarily mean you cannot receive treatment, but they may require additional review before your appointment.";

export const CONSENT_VERSION = "aella-sculpt-consent-2026-11-12";

export const CONSENT_SECTIONS: { key: string; title: string; paragraphs?: string[]; intro?: string; bullets?: string[]; after?: string[] }[] = [
  {
    key: "nature",
    title: "Nature of Treatment",
    paragraphs: [
      "I understand that Aella Sculpt is a non-invasive aesthetic body-contouring treatment that may incorporate ultrasonic cavitation, therapeutic ultrasound, radiofrequency energy, low-level light/laser technology, manual massage and wood therapy.",
      "I understand that the specific techniques used may vary depending on the treatment area, my goals and my provider's assessment.",
    ],
  },
  {
    key: "not_weight_loss",
    title: "Not a Weight-Loss Treatment",
    paragraphs: [
      "I understand that Aella Sculpt is intended for localized aesthetic body contouring and is not a weight-loss treatment, treatment for obesity or substitute for medical care, nutrition or physical activity.",
    ],
  },
  {
    key: "results",
    title: "Results",
    intro: "I understand that:",
    bullets: [
      "Results vary between individuals.",
      "No specific reduction in inches, fat, cellulite or body size is guaranteed.",
      "Multiple treatments may be recommended.",
      "Changes may be gradual.",
      "Maintenance treatments may be recommended.",
      "My individual response may differ from another client's results.",
    ],
  },
  {
    key: "responses",
    title: "Possible Treatment Responses",
    intro: "I understand that temporary responses may include:",
    bullets: ["Redness", "Warmth", "Tenderness", "Swelling", "Bruising", "Sensitivity", "Muscle or tissue soreness", "Temporary changes in sensation", "Temporary lumpiness or nodules in the treated tissue"],
    after: [
      "I understand that energy-based treatments can also carry less common risks including blistering, burns, pigmentation changes, prolonged sensitivity or other tissue/skin reactions.",
    ],
  },
  {
    key: "communication",
    title: "Communication During Treatment",
    paragraphs: [
      "I agree to tell my provider immediately if I experience excessive heat, sharp pain, unusual discomfort, burning or any unexpected sensation during treatment.",
      "I understand that my provider may adjust or discontinue a modality or the entire treatment if necessary.",
    ],
  },
  {
    key: "health_info",
    title: "Health Information",
    paragraphs: ["I confirm that the information I provided on my health and treatment intake is accurate to the best of my knowledge."],
    intro: "I agree to notify Spa Aella of any meaningful change in:",
    bullets: ["Pregnancy status", "Medical conditions", "Medication", "Surgery", "Implants", "Skin condition", "Injury", "Health status"],
    after: ["before subsequent treatments."],
  },
  {
    key: "no_guarantee",
    title: "No Guarantee",
    paragraphs: ["I understand that Spa Aella and my provider cannot guarantee a specific aesthetic result."],
  },
  {
    key: "questions",
    title: "Questions",
    paragraphs: [
      "I acknowledge that I have had the opportunity to ask questions about Aella Sculpt, its expected benefits, limitations, alternatives and potential risks before treatment.",
    ],
  },
];

export const CONSENT_STATEMENT = "I have read and understand the information above and consent to receive Aella Sculpt treatment.";

export const PHOTO_QUESTION =
  "Would you like Spa Aella to take standardized progress photographs to help you and your provider track changes throughout your Aella Sculpt series?";
export const PHOTO_YES = "Yes — photographs may be taken and stored privately in my treatment record.";
export const PHOTO_NO = "No — I do not consent to progress photography.";
export const PHOTO_NOTE =
  "Private treatment-record photography consent does not authorize marketing, social media, website, advertising or public before-and-after use. Any marketing or publication use requires a separate media authorization.";

/** What staff see for provider review. */
export type ReviewState = "pending" | "clear" | "required" | "completed";
export function reviewLabel(state: ReviewState | null | undefined, decision?: string | null): string {
  if (state === "completed") return decision === "not_cleared" ? "Completed · Not cleared for treatment" : "Completed · Cleared";
  if (state === "required") return "Required";
  if (state === "clear") return "Clear";
  return "Waiting for intake";
}

/** Spa preparation instructions saved on a service. */
export interface SpaPreparation {
  title: string;
  short: string[];
  link_label: string;
  full_title: string;
  full: { heading: string; body: string }[];
}
