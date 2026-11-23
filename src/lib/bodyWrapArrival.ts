// Longer (extended) body wraps include red light and the vibration plate before the wrap.
export const EXTENDED_WRAP_PREP_NOTE =
  "Your longer wrap includes a vibration plate and red light session before your treatment, in addition to your treatment time. Please arrive 20–30 minutes early so there's time for both.";

/** Used where the booked length isn't known (intake forms). */
export const BODY_WRAP_ARRIVAL_NOTE =
  "If you booked the longer option of your wrap, please arrive 20–30 minutes early for your vibration plate and red light session before your treatment.";

export const isExtendedWrap = (name: string) => /\(extended\)\s*$/i.test(name);
