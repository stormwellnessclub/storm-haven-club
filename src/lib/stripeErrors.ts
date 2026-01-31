/**
 * Formats Stripe SetupIntent errors into user-friendly messages.
 * Clarifies that card verification failures are NOT charges.
 */
export function formatSetupError(error: { code?: string; message?: string; decline_code?: string }): string {
  // Map common Stripe decline codes to user-friendly messages
  const declineCodes = [
    'card_declined',
    'insufficient_funds',
    'lost_card',
    'stolen_card',
    'expired_card',
    'incorrect_cvc',
    'processing_error',
  ];

  // Check for specific decline codes first
  if (error.code && declineCodes.includes(error.code)) {
    return `Card verification failed. No charge was made. Please check your card details or try a different card. (${error.code})`;
  }

  // Check if the message contains "declined" and reword it
  if (error.message?.toLowerCase().includes('declined')) {
    return "Card verification failed. No charge was made. The card issuer declined the verification request. Please try a different card or contact your bank.";
  }

  // Check for expired card message
  if (error.message?.toLowerCase().includes('expired')) {
    return "Card verification failed. No charge was made. Your card has expired. Please use a different card.";
  }

  // Return original message or default
  return error.message || "Failed to save card. Please try again.";
}
