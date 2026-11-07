/**
 * PT client booking modes. Mirrors public.pt_effective_client_booking_mode():
 * global OFF always wins, a trainer override can be stricter or looser than the club,
 * and instant booking collapses to OFF until 2D.3 availability enforcement is ready.
 */
export type ClubBookingMode = "off" | "request" | "instant";
export type TrainerBookingMode = "follow" | "hidden" | "request" | "instant";

export const INSTANT_NOT_READY_MESSAGE = "Instant booking requires completed trainer availability setup.";

export const CLUB_MODE_OPTIONS: { value: ClubBookingMode; label: string; description: string }[] = [
  {
    value: "off",
    label: "Off",
    description: "Clients see their booked sessions and history only. No booking or request button, and no trainer times are shown.",
  },
  {
    value: "request",
    label: "Request Only",
    description: "Current PT clients can ask for a day and time. Nothing is booked until a trainer or manager approves it or offers another time.",
  },
  {
    value: "instant",
    label: "Instant Booking",
    description: "Current PT clients pick an open time and it is confirmed right away, checked against trainer hours, time off and other bookings.",
  },
];

export const TRAINER_MODE_OPTIONS: { value: TrainerBookingMode; label: string }[] = [
  { value: "follow", label: "Follow Club Setting" },
  { value: "hidden", label: "Hidden" },
  { value: "request", label: "Request Only" },
  { value: "instant", label: "Instant Booking" },
];

export function resolveClientBookingMode(args: {
  global: ClubBookingMode;
  override?: TrainerBookingMode | null;
  isPtTrainer?: boolean;
  instantReady: boolean;
}): ClubBookingMode {
  const { global, override = "follow", isPtTrainer = true, instantReady } = args;
  if (global === "off") return "off";
  let mode: ClubBookingMode;
  if (override === "hidden") return "off";
  if (!override || override === "follow") {
    if (!isPtTrainer) return "off";
    mode = global;
  } else {
    mode = override;
  }
  if (mode === "instant" && !instantReady) return "off";
  return mode;
}

export const CLIENT_MODE_LABEL: Record<ClubBookingMode, string> = {
  off: "Not bookable",
  request: "Requests",
  instant: "Instant booking",
};
