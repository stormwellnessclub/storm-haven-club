// @ts-nocheck -- Bun runs isolated policy tests; not a browser module.
import { test, expect } from 'bun:test';
import { REVIEW_RULES, REVIEW_LINK, reviewSms } from './googleReviewPolicy';
test('SMS is due at 24 hours', () => expect(REVIEW_RULES.smsHours).toBe(24));
test('Email is due at 48 hours', () => expect(REVIEW_RULES.emailHours).toBe(48));
test('Person cooldown is 90 days', () => expect(REVIEW_RULES.cooldownDays).toBe(90));
test('Shared daily limit is 15 sends', () => expect(REVIEW_RULES.dailyLimit).toBe(15));
test('Pacing is 48 minutes', () => expect(REVIEW_RULES.spacingMinutes).toBe(48));
test('SMS including link and opt-out is under 160 characters', () => {
  for (const name of [null, 'Alice', 'A'.repeat(180), 'Amélie']) {
    const message = reviewSms(name, 'Pilates class');
    expect(message.length).toBeLessThan(160); expect(message).toContain(REVIEW_LINK);
  }
});