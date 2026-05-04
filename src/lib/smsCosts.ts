// US 10DLC pricing baseline (2026). Tune as Twilio rates change.
export const SMS_PRICE_PER_SEGMENT = 0.0079;
export const MMS_PRICE_PER_SEGMENT = 0.02;

export function segments(body: string) {
  return Math.max(1, Math.ceil(body.length / 160));
}

export function estimateCost(opts: {
  recipients: number;
  body: string;
  hasMedia: boolean;
}) {
  const segs = segments(opts.body);
  const perRecipient = opts.hasMedia ? MMS_PRICE_PER_SEGMENT : SMS_PRICE_PER_SEGMENT * segs;
  const total = perRecipient * Math.max(1, opts.recipients);
  return {
    segments: segs,
    perRecipient,
    total,
    formatted: `$${total.toFixed(2)}`,
    perRecipientFormatted: `$${perRecipient.toFixed(4)}`,
    type: opts.hasMedia ? "MMS" : "SMS",
  };
}
