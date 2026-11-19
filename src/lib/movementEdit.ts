// Display copy for The Movement Edit (owner-approved wording). Prices and rules live in the database.
export type MovementOfferKey = "discovery_pass" | "movement_edit" | "club_experience";
export const processingFeeCents = (amountCents: number) => Math.round((amountCents + 30) / (1 - 0.029)) - amountCents;

export const MOVEMENT_COPY: Record<MovementOfferKey, {
  n: string; title: string; headline: string; tagline: string; body: string[]; details: string[]; button: string;
}> = {
  discovery_pass: {
    n: "01", title: "The Discovery Pass", headline: "$75 | 3 Classes",
    tagline: "A first introduction to movement at Storm Wellness Club.",
    body: [
      "Explore our class offerings, get to know our instructors, and discover the atmosphere that makes our approach to movement different.",
      "Three classes. The freedom to try something new.",
    ],
    details: ["$75 total", "Includes 3 group fitness classes", "Available exclusively to first-time class guests", "Valid for 21 days from purchase", "One purchase per eligible guest", "Subject to class availability"],
    button: "Explore Classes",
  },
  movement_edit: {
    n: "02", title: "The Movement Edit", headline: "$255 | 10 Classes",
    tagline: "Find your rhythm. Make room for more of what moves you.",
    body: [
      "Whether it's the precision of Reformer Pilates, the energy of cycling, or the strength found in movement, enjoy the flexibility to explore our diverse class schedule.",
      "Ten classes, thoughtfully priced for the season.",
    ],
    details: ["Seasonal price: $255", "Includes 10 group fitness classes", "Non-members only", "Valid for 2 months from purchase", "Regular package price: $285", "No additional club access included"],
    button: "Select Package",
  },
  club_experience: {
    n: "03", title: "The Club Experience", headline: "$285 | 10 Classes + Club Day Pass",
    tagline: "There's more to experience beyond the studio.",
    body: [
      "Movement is only one part of the Storm Wellness Club experience.",
      "For The Seasonal Edit, enjoy ten group fitness classes accompanied by a complimentary day of access to our gym and designated club amenities.",
      "An opportunity to experience the club beyond your scheduled class and discover what makes Storm Wellness Club something different.",
    ],
    details: ["$285 total", "Includes 10 group fitness classes", "Includes 1 complimentary club day pass", "Non-members only", "Classes valid for 2 months from purchase", "Day pass is non-transferable and valid for one redemption", "Standard day pass value: $60", "Spa treatments and separately priced recovery services are not included unless already covered by the existing standard guest day pass"],
    button: "Experience the Club",
  },
};
