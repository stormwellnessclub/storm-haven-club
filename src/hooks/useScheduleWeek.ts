import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduleShift {
  id: string;
  user_id: string | null;
  person_ref: string | null;
  person_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  department: string | null;
  position: string | null;
  break_minutes: number;
  notes: string | null;
  status: 'scheduled' | 'pto' | 'cancelled' | 'swapped';
  published_at: string | null;
  template_id: string | null;
}

export interface ScheduleTemplate {
  id: string;
  user_id: string | null;
  person_ref: string | null;
  person_name: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  department: string | null;
  notes: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

export interface CoverageRule {
  id: string;
  department: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  min_staff: number;
  is_active: boolean;
  notes: string | null;
}

export function personKeyOf(s: { user_id: string | null; person_ref: string | null }) {
  return s.user_id ?? `ref:${s.person_ref ?? ''}`;
}

export function useScheduleWeek(dates: string[]) {
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [rules, setRules] = useState<CoverageRule[]>([]);
  const [loading, setLoading] = useState(true);

  const first = dates[0];
  const last = dates[dates.length - 1];

  const load = useCallback(async () => {
    if (!first) return;
    setLoading(true);
    try {
      const [shiftRes, tplRes, ruleRes] = await Promise.all([
        (supabase as any)
          .from('staff_shifts')
          .select('*')
          .gte('shift_date', first)
          .lte('shift_date', last),
        (supabase as any).from('staff_shift_templates').select('*').eq('is_active', true),
        (supabase as any).from('staff_coverage_rules').select('*').eq('is_active', true),
      ]);
      setShifts(((shiftRes.data ?? []) as any[]).map((s) => ({ ...s, break_minutes: s.break_minutes ?? 0 })));
      setTemplates((tplRes.data ?? []) as any[]);
      setRules((ruleRes.data ?? []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [first, last]);

  useEffect(() => {
    load();
  }, [load]);

  return { shifts, templates, rules, loading, reload: load };
}

/** Hours a shift is worth, minus unpaid break. */
export function shiftHours(s: { start_time: string; end_time: string; break_minutes?: number | null }) {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const mins = toMin(s.end_time) - toMin(s.start_time) - (s.break_minutes ?? 0);
  return Math.max(0, mins) / 60;
}

export function formatTime(t: string) {
  const [hStr, m] = t.split(':');
  let h = Number(hStr);
  const ampm = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return m === '00' ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}
