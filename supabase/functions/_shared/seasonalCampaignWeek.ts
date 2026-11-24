import type { Block } from './campaignRender.ts';

export const SEASONAL_WEEK_PREFIX = 'Seasonal Edit — Seven Openings';
export const SEASONAL_CLOSE = '2026-12-01T04:59:59Z';
export const CAMPAIGN_ORIGIN = 'https://stormwellnessclub.com';
export const WEEK_DAYS = [
  { day: 24, title: 'One question before December', focus: 'Choose a direction', insight: 'Start with the part of life they want handled, not a list of prices.', goal: 'Offer-choice clicks', emailTime: '10:00', textTime: '09:00' },
  { day: 25, title: 'A place in your week', focus: 'Classes', insight: 'Make a repeatable class routine feel achievable.', goal: 'Class purchases', emailTime: '10:00' },
  { day: 26, title: 'A note of thanks', focus: 'Thanksgiving', insight: 'A human pause builds continuity without another price pitch.', goal: 'Engagement, not immediate purchases', emailTime: '10:00' },
  { day: 27, title: 'For the person who books everyone else first', focus: 'Massage & gifting', insight: 'Give a specific experience rather than another object.', goal: 'Gift purchases', emailTime: '09:00', textTime: '12:00' },
  { day: 28, title: 'Training that knows your name', focus: 'Personal training', insight: 'Sell guidance and consistency; payment flexibility removes a practical barrier.', goal: 'PT purchases', emailTime: '10:00' },
  { day: 29, title: 'Still considering it?', focus: 'Interest follow-up', insight: 'Follow the category they clicked; omit buyers instead of repeating the whole catalog.', goal: 'Clicks-to-purchases', emailTime: '11:00' },
  { day: 30, title: 'The Edit closes tonight', focus: 'Final day', insight: 'Use the real closing time, never invented scarcity.', goal: 'Completed purchases', emailTime: '09:00', textTime: '16:00' },
] as const;
export type WeekDraft = { name: string; event_tag: string; send_email: boolean; send_sms: boolean; subject: string; preheader: string; blocks: Block[]; sms_body: string; sms_image_url: null; audience_key: string; status: 'draft' };
const url = (path: string) => `${CAMPAIGN_ORIGIN}${path}`;
const button = (label: string, path: string): Block => ({ type: 'button', label, url: url(path) });

export function seasonalWeekDrafts(): WeekDraft[] {
  const drafts: WeekDraft[] = [];
  for (const audience of ['member', 'non_member', 'imported'] as const) {
    const member = audience === 'member';
    const audienceKey = member ? 'active_only' : audience === 'imported' ? 'seasonal_engaged_imported' : 'seasonal_recent_non_members';
    const audienceLabel = member ? 'Members' : audience === 'imported' ? 'Engaged imported contacts' : 'Recent non-members';
    const view = member ? 'member' : 'non_member';
    for (const day of WEEK_DAYS) {
      // Imported contacts get one focused, engagement-qualified invitation, not seven blasts.
      if (audience === 'imported' && day.day !== 27) continue;
      if (day.day === 29) continue; // Category-specific follow-ups are built separately below.
      const paths = { pick: `/seasonal-edit/choose?for=${view}`, classes: `/seasonal-edit?for=${view}#movement-edit`, pt: `/seasonal-edit?for=${view}#pt-edit`, massage: `/seasonal-edit?for=${view}#spa-edit`, gifts: '/seasonal-edit/gifts' };
      let blocks: Block[] = [];
      let sms = '';
      switch (day.day) {
        case 24:
          blocks = [{ type: 'text', text: 'December fills up quickly. Which part of your week would you like to make room for?' }, { type: 'choices', items: [
            { label: 'Stronger', description: 'Personal training', url: url(`${paths.pick}&choice=stronger`) },
            { label: 'Calmer', description: 'A class routine', url: url(`${paths.pick}&choice=calmer`) },
            { label: 'Restored', description: 'Massage', url: url(`${paths.pick}&choice=restored`) },
            { label: 'Giving', description: 'A gift for someone else', url: url(`${paths.pick}&choice=giving`) },
          ] }];
          sms = `One question before December: stronger, calmer, restored, or giving? Choose your Seasonal Edit: ${url(paths.pick)}`;
          break;
        case 25:
          blocks = [{ type: 'text', text: member ? 'A familiar class. A place already set aside in your week. The Member Movement Edit brings 10 class credits, a guest class and $10 in café credit together for $160.' : 'A class routine starts with finding what fits. Try the Discovery Pass: 3 classes for $75, for first-time class clients. Or make room for 10 classes with the Movement Edit at $255. The Club Experience adds a club day pass for $285.' }, button('Find your class Edit', paths.classes)];
          break;
        case 26:
          blocks = [{ type: 'text', text: 'Thank you for making Storm Wellness Club part of your week. The conversations before class, the effort you bring to training, the time you set aside for care—they make this place what it is.\n\nWishing you a thoughtful Thanksgiving, however you spend it.' }, button('A card for someone on your list', paths.gifts)];
          break;
        case 27:
          blocks = [{ type: 'text', text: 'For the person who books everyone else first: a massage already chosen, with a message from you.\n\nThe Seasonal Edit starts at $120 for a 60-minute Storm Signature or Deep Relief massage. Prefer movement? Give the Movement Edit for $255.' }, { type: 'reveal_card', text: 'An hour no one else schedules.', url: url(paths.gifts), label: 'Open the card' }, ...(member ? [{ type: 'text', text: 'Buying for yourself? Your membership tier discount applies to your own massage. Gifts for someone else are at the listed gift price.' } as Block] : [])];
          sms = `For the person who books everyone else first. Open a Seasonal Edit gift: massage from $120, or a class experience. Gifts use listed prices. ${url(paths.gifts)}`;
          break;
        case 28:
          blocks = [{ type: 'text', text: 'A note from the training team\n\nConsistent training is easier when someone knows your starting point, adjusts the work and keeps the next step clear. That is what personal training at Storm Wellness Club is built around.\n\nThe Seasonal Edit offers 30, 40, 60 or 80 sessions, with monthly payment options. Package use-by dates are separate from payment-plan length.' }, button('Explore personal training', paths.pt)];
          break;
        case 30:
          blocks = [{ type: 'text', text: 'The Seasonal Edit closes tonight, November 30, at 11:59 PM Michigan time.\n\nIf you have been considering training, a class routine or a massage gift, this is the final day to choose. Gifts already purchased keep their stated validity.' }, button('Choose your Edit', paths.pick)];
          sms = `The Seasonal Edit closes tonight at 11:59 PM Michigan time. Choose your training, classes or massage gift before it closes: ${url(paths.pick)}`;
          break;
      }
      const base = { event_tag: 'general', subject: day.title, preheader: day.day === 30 ? 'November 30 · 11:59 PM Michigan time.' : 'The Seasonal Edit · Storm Wellness Club', blocks: [{ type: 'eyebrow', text: `THE SEASONAL EDIT · ${day.day - 23} OF 7` } as Block, { type: 'heading', text: day.title } as Block, ...blocks, { type: 'signature' } as Block], sms_body: '', sms_image_url: null, audience_key: audienceKey, status: 'draft' as const };
      drafts.push({ ...base, name: `${SEASONAL_WEEK_PREFIX} · Nov ${day.day} · ${audienceLabel} · Email`, send_email: true, send_sms: false });
      if (sms && audience !== 'imported') drafts.push({ ...base, name: `${SEASONAL_WEEK_PREFIX} · Nov ${day.day} · ${audienceLabel} · Text`, send_email: false, send_sms: true, sms_body: sms });
    }
  }
  for (const category of ['pt', 'classes', 'spa', 'gifts'] as const) {
    const labels = { pt: 'Training that knows your name', classes: 'A place in your week', spa: 'An hour set aside', gifts: 'A gift worth opening' };
    const paths = { pt: '/seasonal-edit#pt-edit', classes: '/seasonal-edit#movement-edit', spa: '/seasonal-edit#spa-edit', gifts: '/seasonal-edit/gifts' };
    drafts.push({ name: `${SEASONAL_WEEK_PREFIX} · Nov 29 · ${category} interest · Email`, event_tag: 'general', send_email: true, send_sms: false, subject: labels[category], preheader: 'One more look before the Seasonal Edit closes.', blocks: [{ type: 'eyebrow', text: 'THE SEASONAL EDIT · 6 OF 7' }, { type: 'heading', text: labels[category] }, { type: 'text', text: 'Still considering it? There is one day left after today to choose your Seasonal Edit. Here is a closer look, with the options and terms in one place.' }, button('Take another look', paths[category]), { type: 'signature' }], sms_body: '', sms_image_url: null, audience_key: `seasonal_interest_${category}`, status: 'draft' });
  }
  return drafts;
}

export function clickedCategory(raw: string | null): 'pt' | 'classes' | 'spa' | 'gifts' | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname !== 'stormwellnessclub.com' && u.hostname !== 'www.stormwellnessclub.com') return null;
    if (u.pathname.includes('/gifts') || u.pathname === '/shop' || u.searchParams.get('choice') === 'giving') return 'gifts';
    if (u.hash === '#pt-edit' || u.searchParams.get('choice') === 'stronger') return 'pt';
    if (u.hash === '#movement-edit' || u.searchParams.get('choice') === 'calmer') return 'classes';
    if (u.hash === '#spa-edit' || u.searchParams.get('choice') === 'restored') return 'spa';
  } catch { /* Invalid or unrelated links don't qualify. */ }
  return null;
}
