import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DayAvailability {
  start: string;
  end: string;
}

export interface SchedulePerson {
  id: string;
  key: string;
  user_id: string | null;
  placeholder_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  departments: string[];
  availability: Record<string, DayAvailability | null>;
  is_active: boolean;
  notes: string | null;
  rate: number | null;
}

export interface StaffCandidate {
  key: string;
  user_id: string | null;
  name: string;
  email: string | null;
  source: 'account' | 'placeholder';
  placeholder_id: string | null;
}

/** person_ref value stored on staff_shifts for a person key */
export function personRefFor(key: string): string | null {
  return key.startsWith('ref:') ? key.slice(4) : null;
}

export function userIdFor(key: string): string | null {
  return key.startsWith('ref:') ? null : key;
}

export function useScheduleTeam(canSeePay: boolean) {
  const [people, setPeople] = useState<SchedulePerson[]>([]);
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, placeholdersRes, rolesRes] = await Promise.all([
        (supabase as any).from('staff_schedule_profiles').select('*').order('display_name'),
        (supabase as any)
          .from('staff_placeholders')
          .select('id, first_name, last_name, email, phone')
          .eq('archived', false),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      let rates: any[] = [];
      if (canSeePay) {
        const r = await (supabase as any).from('staff_pay_rates').select('person_key, hourly_rate');
        rates = r.data ?? [];
      }
      const rateByKey = new Map<string, number>(rates.map((r: any) => [r.person_key, Number(r.hourly_rate)]));

      const profiles = (profilesRes.data ?? []) as any[];
      const placeholders = (placeholdersRes.data ?? []) as any[];
      const placeholderById = new Map(placeholders.map((p) => [p.id, p]));

      const staffUserIds = Array.from(new Set(((rolesRes.data ?? []) as any[]).map((r) => r.user_id)));
      const profilesUsers = staffUserIds.length
        ? (
            await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, email, phone')
              .in('user_id', staffUserIds)
          ).data ?? []
        : [];
      const userById = new Map((profilesUsers as any[]).map((p) => [p.user_id, p]));

      const mapped: SchedulePerson[] = profiles.map((p) => {
        const ph = p.placeholder_id ? placeholderById.get(p.placeholder_id) : null;
        const usr = p.user_id ? userById.get(p.user_id) : null;
        const fallbackName = ph
          ? `${ph.first_name ?? ''} ${ph.last_name ?? ''}`.trim()
          : usr
          ? `${usr.first_name ?? ''} ${usr.last_name ?? ''}`.trim()
          : '';
        return {
          id: p.id,
          key: p.person_key,
          user_id: p.user_id ?? null,
          placeholder_id: p.placeholder_id ?? null,
          name: p.display_name || fallbackName || p.email || 'Staff member',
          email: p.email ?? ph?.email ?? usr?.email ?? null,
          phone: p.phone ?? ph?.phone ?? usr?.phone ?? null,
          departments: (p.departments ?? []) as string[],
          availability: (p.default_availability ?? {}) as Record<string, DayAvailability | null>,
          is_active: p.is_active,
          notes: p.notes ?? null,
          rate: rateByKey.has(p.person_key) ? rateByKey.get(p.person_key)! : null,
        };
      });

      const existingKeys = new Set(mapped.map((m) => m.key));
      const cands: StaffCandidate[] = [];
      for (const uid of staffUserIds) {
        if (existingKeys.has(uid)) continue;
        const u = userById.get(uid);
        cands.push({
          key: uid,
          user_id: uid,
          name: u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || 'Staff' : 'Staff',
          email: u?.email ?? null,
          source: 'account',
          placeholder_id: null,
        });
      }
      for (const ph of placeholders) {
        const key = `ref:placeholder:${ph.id}`;
        if (existingKeys.has(key)) continue;
        cands.push({
          key,
          user_id: null,
          name: `${ph.first_name ?? ''} ${ph.last_name ?? ''}`.trim() || ph.email || 'Staff',
          email: ph.email ?? null,
          source: 'placeholder',
          placeholder_id: ph.id,
        });
      }

      setPeople(mapped.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)));
      setCandidates(cands.sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoading(false);
    }
  }, [canSeePay]);

  useEffect(() => {
    load();
  }, [load]);

  return { people, candidates, loading, reload: load };
}
