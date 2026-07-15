// Event vote configuration — single source of truth for the Sound Bath poll.
// Keep this file in sync with the email template + admin tracking page.

export const SOUND_BATH_VOTE = {
  slug: "sound-bath-jul-2026",
  title: "Sound Bath, Nervous System Reset & Guided Meditation",
  subtitle: "Help us pick the evening — members vote",
  // Voting closes end of day Jul 20, 2026 (America/Detroit).
  closesAt: "2026-07-15T23:59:59-05:00",
  pricing: {
    member: 30,
    nonMember: 40,
  },
  options: [
    {
      key: "friday_jul_24",
      label: "Friday, July 24",
      time: "7:00 PM",
    },
    {
      key: "saturday_jul_25",
      label: "Saturday, July 25",
      time: "7:00 PM",
    },
    {
      key: "either",
      label: "Either works for me",
      time: "No preference",
    },
  ] as const,
  description: [
    "Join us for a 90-minute nervous system reset led by Crystal Bell, a classically trained musician and yoga instructor. This restorative experience combines the healing frequencies of sound with the deep relaxation of guided meditation.",
    "The session will begin with breathwork and gentle stretching to prepare the mind and body to relax, release, and settle into stillness. Once grounded, attendees will be guided through a meditation designed to create a deeper state of relaxation and receptivity.",
    "The meditation will transition into an extended sound bath, where natural sound waves and healing vibrational frequencies will be used to release stress, encourage creativity, and restore energy throughout the body.",
    "Attendees are encouraged to bring a yoga mat, pillow, light blanket, eye mask, or anything else that will allow them to feel fully comfortable during the experience.",
  ],
} as const;

export type EventVoteOptionKey = (typeof SOUND_BATH_VOTE.options)[number]["key"];

export function isVoteOpen(now: Date = new Date()): boolean {
  return now < new Date(SOUND_BATH_VOTE.closesAt);
}
