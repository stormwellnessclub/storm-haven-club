/** Personal outreach copy for the Seasonal Edit hot list. Sent by staff from their own phones. */
export type HotReason = 'pt_low' | 'pt_unpaid' | 'member_recent' | 'spa_recent' | 'class_non_member';

export const SEASONAL_EDIT_ENDS = 'Sunday, Nov 30';
const BASE = 'https://stormwellnessclub.com/seasonal-edit';

export const REASON_LABEL: Record<HotReason, string> = {
  pt_low: 'PT package running low',
  pt_unpaid: 'Paying single PT sessions',
  member_recent: 'Member visiting often',
  spa_recent: 'Recent massage client',
  class_non_member: 'Non-member taking classes',
};

export const REASON_OFFER: Record<HotReason, string> = {
  pt_low: 'Seasonal Edit PT package. Plans available, and payments can start when the current package ends.',
  pt_unpaid: 'A Seasonal Edit PT package instead of single-session pricing',
  member_recent: 'Seasonal Edit PT or a massage at their member price',
  spa_recent: 'Seasonal Edit massage, for themselves or as a gift',
  class_non_member: 'Movement Edit 10 classes, or the Club Experience',
};

export function hotListText(reason: HotReason, firstName: string | null, sender: string): string {
  const hi = `Hi ${(firstName || '').trim() || 'there'}, it's ${sender} from Storm.`;
  switch (reason) {
    case 'pt_low':
      return `${hi} I noticed your training package is getting close to the end. Our Seasonal Edit pricing on PT packages ends ${SEASONAL_EDIT_ENDS}, and we can start your plan payments when your current one finishes. Want me to set it up for you? ${BASE}#pt-edit`;
    case 'pt_unpaid':
      return `${hi} You've been so consistent with training! Right now you're paying session by session, and a Seasonal Edit package would bring your per-session price down. It ends ${SEASONAL_EDIT_ENDS}. Want me to put one together for you? ${BASE}#pt-edit`;
    case 'member_recent':
      return `${hi} Love seeing you in the club! Before ${SEASONAL_EDIT_ENDS}, members have Seasonal Edit pricing on training packages and massages, with your tier discount on massages for yourself. Happy to walk you through it next time you're in. ${BASE}`;
    case 'spa_recent':
      return `${hi} Thank you for coming in for your massage. Our Seasonal Edit massage pricing ends ${SEASONAL_EDIT_ENDS}, for you or as a gift for someone you love. Want me to hold one for you? ${BASE}#spa-edit`;
    case 'class_non_member':
      return `${hi} It's been great having you in class! Through ${SEASONAL_EDIT_ENDS}, the Movement Edit gives you 10 classes at our best class pricing of the year. Want me to add it to your account? ${BASE}`;
  }
}
