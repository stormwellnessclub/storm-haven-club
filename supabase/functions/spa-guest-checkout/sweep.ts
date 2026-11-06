// Closing abandoned online spa holds. A hold expires 20 minutes after the card screen opens;
// the booking system refuses it after that, so its Stripe payment can be closed safely.
// A paid (succeeded) payment is never touched.

export const SWEEP_GRACE_MS = 10 * 60 * 1000;

type IntentLike = {
  status: string;
  last_payment_error?: { code?: string | null; decline_code?: string | null; message?: string | null; payment_method?: { card?: { funding?: string | null } | null } | null } | null;
  last_setup_error?: { code?: string | null; decline_code?: string | null; message?: string | null } | null;
};

const CANCELABLE = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture']);

/** Whether an expired, unbooked hold's Stripe intent should be cancelled. */
export function shouldCancel(status: string): boolean {
  return CANCELABLE.has(status);
}

const DECLINE_LABELS: Record<string, string> = {
  insufficient_funds: 'insufficient funds',
  lost_card: 'card reported lost',
  stolen_card: 'card reported stolen',
  expired_card: 'card expired',
  incorrect_cvc: 'wrong security code',
  incorrect_number: 'wrong card number',
  do_not_honor: 'bank declined',
  generic_decline: 'bank declined',
  card_velocity_exceeded: 'card limit reached',
  fraudulent: 'bank fraud check',
  merchant_blacklist: 'bank fraud check',
  authentication_required: 'bank verification not finished',
};

/** Plain-language reason staff see for why an online booking stopped. */
export function stopReasonFor(intent: IntentLike): { reason: string; message: string | null } {
  const err = intent.last_payment_error ?? intent.last_setup_error ?? null;
  if (err) {
    const code = err.decline_code ?? err.code ?? '';
    let label = DECLINE_LABELS[code] ?? (code ? code.replace(/_/g, ' ') : 'card problem');
    const prepaid = (err as { payment_method?: { card?: { funding?: string | null } | null } | null }).payment_method?.card?.funding === 'prepaid';
    if (prepaid) label += ' (prepaid card)';
    return { reason: `Card declined: ${label}`, message: err.message ?? null };
  }
  if (intent.status === 'requires_action') return { reason: 'Stopped at bank verification', message: null };
  if (intent.status === 'requires_capture') return { reason: 'Card approved but hold expired before booking', message: null };
  return { reason: 'Left at card screen', message: null };
}
