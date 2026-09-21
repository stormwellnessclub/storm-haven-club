import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchCafeSales, type CafeSale } from '@/lib/cafeSales';

export const STORM_OPENING_DATE = '2026-02-01';

export interface LaunchSession {
  id: string;
  session_date: string;
  room: string | null;
  instructor_id: string | null;
  current_enrollment: number;
  max_capacity: number;
  is_cancelled: boolean;
  is_hidden: boolean;
  is_fundraiser: boolean;
}

export interface LaunchSpaAppointment {
  id: string;
  member_id: string | null;
  staff_id: string | null;
  room_id: string | null;
  appointment_date: string;
  status: string;
  amount_paid: number | null;
  addons_total: number;
  tip_amount: number | null;
  duration_minutes: number;
  cleanup_minutes: number;
  payment_intent_id: string | null;
}

export interface LaunchRoom {
  id: string;
  name: string;
  room_type: string;
  is_active: boolean;
}

export interface LaunchTherapist {
  id: string;
  full_name: string;
  is_active: boolean;
}

export interface LaunchClassPass {
  id: string;
  purchased_at: string;
  price_paid: number;
  status: string;
  stripe_payment_intent_id: string | null;
}

export interface LaunchOperationsData {
  sessions: LaunchSession[];
  spaAppointments: LaunchSpaAppointment[];
  rooms: LaunchRoom[];
  therapists: LaunchTherapist[];
  classPasses: LaunchClassPass[];
  cafeSales: CafeSale[];
}

const empty: LaunchOperationsData = {
  sessions: [],
  spaAppointments: [],
  rooms: [],
  therapists: [],
  classPasses: [],
  cafeSales: [],
};

export function useLaunchOperations() {
  const [data, setData] = useState<LaunchOperationsData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const start = new Date(`${STORM_OPENING_DATE}T00:00:00-05:00`);
      const end = new Date();
      try {
        const [sessions, spa, rooms, therapists, classPasses, cafeSales] = await Promise.all([
          (supabase as any)
            .from('class_sessions')
            .select('id,session_date,room,instructor_id,current_enrollment,max_capacity,is_cancelled,is_hidden,is_fundraiser')
            .gte('session_date', STORM_OPENING_DATE)
            .lte('session_date', end.toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })),
          (supabase as any)
            .from('spa_appointments')
            .select('id,member_id,staff_id,room_id,appointment_date,status,amount_paid,addons_total,tip_amount,duration_minutes,cleanup_minutes,payment_intent_id')
            .gte('appointment_date', STORM_OPENING_DATE)
            .lte('appointment_date', end.toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })),
          (supabase as any).from('spa_rooms').select('id,name,room_type,is_active').eq('is_active', true),
          (supabase as any).from('spa_therapists').select('id,full_name,is_active').eq('is_active', true),
          (supabase as any)
            .from('class_passes')
            .select('id,purchased_at,price_paid,status,stripe_payment_intent_id')
            .gte('purchased_at', start.toISOString())
            .lte('purchased_at', end.toISOString()),
          fetchCafeSales(start, end),
        ]);
        const failures = [sessions, spa, rooms, therapists, classPasses].filter((r) => r.error);
        if (failures.length) throw failures[0].error;
        if (!active) return;
        setData({
          sessions: (sessions.data ?? []) as LaunchSession[],
          spaAppointments: (spa.data ?? []) as LaunchSpaAppointment[],
          rooms: (rooms.data ?? []) as LaunchRoom[],
          therapists: (therapists.data ?? []) as LaunchTherapist[],
          classPasses: (classPasses.data ?? []) as LaunchClassPass[],
          cafeSales,
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load operating data');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}