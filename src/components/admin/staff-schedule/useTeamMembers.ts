import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TeamMember } from './types';
import type { AppRole } from '@/lib/permissions';

const GROUP_FOR_ROLE: Record<AppRole, TeamMember['group']> = {
  super_admin: 'Managers',
  admin: 'Managers',
  manager: 'Managers',
  front_desk: 'Front Desk',
  spa_staff: 'Therapists',
  class_instructor: 'Instructors',
  cafe_staff: 'Operations',
  childcare_staff: 'Operations',
};

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Pull staff via user_roles + profiles
        const [{ data: roles }, { data: instructors }, { data: therapists }] = await Promise.all([
          supabase.from('user_roles').select('user_id, role'),
          supabase.from('instructors').select('id, full_name, email').eq('is_active', true),
          supabase.from('spa_therapists' as any).select('id, full_name, email').eq('is_active', true),
        ]);

        // Get profiles for staff users
        const staffUserIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
        const profilesRes = staffUserIds.length
          ? await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, email')
              .in('user_id', staffUserIds)
          : { data: [] as any[] };

        const profileById = new Map<string, any>();
        (profilesRes.data ?? []).forEach((p: any) => profileById.set(p.user_id, p));

        const byKey = new Map<string, TeamMember>();

        // Staff (user_roles → profiles)
        for (const r of roles ?? []) {
          const p = profileById.get(r.user_id);
          const key = r.user_id;
          const existing = byKey.get(key);
          const role = r.role as AppRole;
          const group = GROUP_FOR_ROLE[role] ?? 'Other';
          const name = p
            ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || 'Unknown'
            : 'Unknown';
          const email = p?.email ?? null;
          if (existing) {
            existing.roleLabels.push(role);
            // Promote to manager group if they hold a manager role
            if (group === 'Managers') existing.group = 'Managers';
          } else {
            byKey.set(key, {
              key,
              user_id: r.user_id,
              email,
              name,
              group,
              roleLabels: [role],
            });
          }
        }

        // Instructors (link by email when possible)
        for (const i of instructors ?? []) {
          const email = (i.email || '').toLowerCase() || null;
          let key = `ref:${email}`;
          let user_id: string | null = null;
          if (email) {
            // Match to existing staff by profile email
            const matched = Array.from(byKey.values()).find(
              (m) => (m.email || '').toLowerCase() === email
            );
            if (matched) {
              key = matched.key;
              user_id = matched.user_id;
              matched.roleLabels.push('class_instructor' as AppRole);
              if (matched.group !== 'Managers') matched.group = 'Instructors';
              continue;
            }
          }
          if (!byKey.has(key)) {
            byKey.set(key, {
              key,
              user_id,
              email,
              name: i.full_name || email || 'Instructor',
              group: 'Instructors',
              roleLabels: ['class_instructor' as AppRole],
            });
          }
        }

        // Therapists
        for (const t of therapists ?? []) {
          const email = ((t as any).email || '').toLowerCase() || null;
          let key = `ref:${email}`;
          let user_id: string | null = null;
          if (email) {
            const matched = Array.from(byKey.values()).find(
              (m) => (m.email || '').toLowerCase() === email
            );
            if (matched) {
              if (matched.group !== 'Managers') matched.group = 'Therapists';
              continue;
            }
          }
          if (!byKey.has(key)) {
            byKey.set(key, {
              key,
              user_id,
              email,
              name: (t as any).full_name || email || 'Therapist',
              group: 'Therapists',
              roleLabels: ['spa_staff' as AppRole],
            });
          }
        }

        const sorted = Array.from(byKey.values()).sort((a, b) => {
          const groupOrder: TeamMember['group'][] = [
            'Managers',
            'Front Desk',
            'Operations',
            'Instructors',
            'Therapists',
            'Other',
          ];
          const ga = groupOrder.indexOf(a.group);
          const gb = groupOrder.indexOf(b.group);
          if (ga !== gb) return ga - gb;
          return a.name.localeCompare(b.name);
        });

        if (!cancelled) setMembers(sorted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { members, loading };
}
