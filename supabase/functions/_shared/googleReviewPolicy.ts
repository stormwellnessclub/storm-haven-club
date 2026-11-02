export const REVIEW_LINK = 'https://g.page/r/CUKF3Od20um5EBM/review';
export const REVIEW_RULES = { smsHours: 24, emailHours: 48, cooldownDays: 90, dailyLimit: 15, spacingMinutes: 48 };
export function reviewSms(firstName?: string | null, visitType?: string | null) {
  const full = `Thank you for visiting Storm Wellness Club. We'd love to hear how your experience was — a Google review takes less than a minute: ${REVIEW_LINK}`;
  if (full.length < 160) return full;
  const greeting = firstName ? `${firstName}, thank you` : 'Thank you';
  const custom = `${greeting} for ${visitType ? `your ${visitType}` : 'visiting'} at Storm Wellness Club. Share your experience: ${REVIEW_LINK} Reply STOP to opt out.`;
  if (custom.length < 160 && /^[\x20-\x7e]*$/.test(custom)) return custom;
  return `Thank you for visiting Storm Wellness Club. Please share your experience: ${REVIEW_LINK} Reply STOP to opt out.`;
}
export function reviewEmail(firstName?: string | null, visitType?: string | null) {
  return `${firstName ? `Dear ${firstName},\n\n` : ''}Thank you for spending part of your day with us at Storm Wellness Club${visitType ? ` for your ${visitType}` : ''}. If you have a moment, we'd truly appreciate hearing about your experience in a Google review: ${REVIEW_LINK}\n\nWith gratitude,\n\nThe Storm Wellness Club Team`;
}