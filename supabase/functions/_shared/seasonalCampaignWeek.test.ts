// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from 'bun:test';
import { clickedCategory, seasonalWeekDrafts, SEASONAL_CLOSE } from './seasonalCampaignWeek';
import { latestInterest, purchasedAfterInterest, recentlyActive } from './seasonalCampaignAudience';

it('ends November 30 at 11:59:59 PM Detroit time', () => {
  expect(SEASONAL_CLOSE).toBe('2026-12-01T04:59:59Z');
});
it('prepares drafts only and no send time is assigned', () => {
  const rows = seasonalWeekDrafts();
  expect(rows.length).toBe(23);
  expect(rows.every(r => r.status === 'draft' && !('scheduled_at' in r))).toBe(true);
});
it('limits each account audience to the three proposed text days', () => {
  const rows = seasonalWeekDrafts();
  expect(rows.filter(r => r.send_sms && r.audience_key === 'active_only').length).toBe(3);
  expect(rows.filter(r => r.send_sms && r.audience_key === 'seasonal_recent_non_members').length).toBe(3);
});
it('imported contacts receive one engaged-only email and no texts', () => {
  const rows = seasonalWeekDrafts().filter(r => r.audience_key === 'seasonal_engaged_imported');
  expect(rows.length).toBe(1);
  expect(rows[0].send_sms).toBe(false);
  expect(rows[0].send_email).toBe(true);
});
it('routes giving interest to listed-price gifts, never a member checkout', () => {
  expect(clickedCategory('https://stormwellnessclub.com/seasonal-edit/choose?for=member&choice=giving')).toBe('gifts');
  expect(clickedCategory('https://attacker.test/seasonal-edit?choice=giving')).toBe(null);
});
it('opens alone never qualify someone for category follow-up', () => {
  expect(latestInterest([{ email: 'a@test.com', event: 'opened', last_url: null, last_at: '2026-11-24T10:00:00Z' }]).size).toBe(0);
});
it('keeps one latest category per lowercase email', () => {
  const m = latestInterest([
    { email: ' A@TEST.COM ', event: 'clicked', last_url: 'https://stormwellnessclub.com/seasonal-edit#pt-edit', last_at: '2026-11-24T10:00:00Z' },
    { email: 'a@test.com', event: 'clicked', last_url: 'https://stormwellnessclub.com/seasonal-edit#spa-edit', last_at: '2026-11-25T10:00:00Z' },
  ]);
  expect(m.size).toBe(1); expect(m.get('a@test.com').category).toBe('spa');
});
it('omits buyers after their click but not membership-dues payments', () => {
  const after = Date.parse('2026-11-24T10:00:00Z');
  const base = { stripe_customer_id: 'cus_test', occurred_at: '2026-11-25T10:00:00Z', gross_cents: 12000, kind: 'sale' };
  expect(purchasedAfterInterest([{ ...base, area: 'spa' }], 'cus_test', after)).toBe(true);
  expect(purchasedAfterInterest([{ ...base, area: 'membership' }], 'cus_test', after)).toBe(false);
  expect(purchasedAfterInterest([{ ...base, area: 'spa' }], 'cus_other', after)).toBe(false);
});
it('includes recent activity within twelve months and excludes stale activity', () => {
  const now = Date.parse('2026-11-24T10:00:00Z');
  expect(recentlyActive({ email: 'a@test.com', last_pt_at: '2026-11-20T10:00:00Z' }, false, now)).toBe(true);
  expect(recentlyActive({ email: 'a@test.com', last_pt_at: '2025-11-20T10:00:00Z' }, false, now)).toBe(false);
  expect(recentlyActive({ email: 'a@test.com' }, true, now)).toBe(true);
});
