import { describe, it, expect } from 'bun:test';
import { hotListText } from './seasonalHotList';

const reasons = ['pt_low', 'pt_unpaid', 'member_recent', 'spa_recent', 'class_non_member'] as const;

describe('hot list texts', () => {
  it('never uses banned client words', () => {
    for (const r of reasons) {
      const t = hotListText(r, 'Ana', 'Storm').toLowerCase();
      expect(t).not.toMatch(/\bsale\b|\bfree\b|black friday|processing fee/);
    }
  });
  it('names the real end date', () => {
    for (const r of reasons) expect(hotListText(r, 'Ana', 'Storm')).toContain('Nov 30');
  });
});
