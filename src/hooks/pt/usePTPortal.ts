import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PtFormat } from "@/lib/ptFormat";
import { toast } from "sonner";

export interface PTPerson {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  isMember: boolean;
  photo_url?: string | null;
}

export interface PTAppointment {
  id: string;
  user_id: string;
  instructor_id: string | null;
  format: PtFormat;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  payment_status: string | null;
  amount_due_cents: number | null;
  checked_in_at: string | null;
  completed_at: string | null;
  pass_id?: string | null;
}

export interface PTTask {
  id: string;
  title: string;
  detail: string | null;
  task_type: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  client_user_id: string | null;
  instructor_id: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Resolve names/emails for a set of user ids across members, non-members and profiles. */
export function usePTPeople(userIds: string[]) {
  const ids = useMemo(() => Array.from(new Set(userIds.filter(Boolean))).sort(), [userIds]);
  return useQuery({
    queryKey: ["pt-people", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, PTPerson>> => {
      const [{ data: profiles }, { data: members }, { data: nonMembers }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, first_name, last_name, phone").in("user_id", ids),
        supabase.from("members").select("user_id, email, first_name, last_name, phone, photo_url").in("user_id", ids),
        supabase.from("non_member_profiles").select("user_id, email, first_name, last_name, phone").in("user_id", ids),
      ]);
      const map: Record<string, PTPerson> = {};
      (profiles ?? []).forEach((p: any) => {
        map[p.user_id] = { user_id: p.user_id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email, email: p.email, phone: p.phone ?? null, isMember: false };
      });
      (nonMembers ?? []).forEach((n: any) => {
        map[n.user_id] = {
          user_id: n.user_id,
          name: `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() || n.email,
          email: n.email, phone: n.phone ?? null, isMember: false,
        };
      });
      (members ?? []).forEach((m: any) => {
        map[m.user_id] = {
          user_id: m.user_id,
          name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
          email: m.email, phone: m.phone ?? null, isMember: true, photo_url: m.photo_url ?? null,
        };
      });
      return map;
    },
  });
}

export function usePTTrainers() {
  return useQuery({
    queryKey: ["pt-trainers-list"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, first_name, last_name, is_active")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return (data ?? []).map((i: any) => ({ id: i.id, name: `${i.first_name} ${i.last_name}`.trim() }));
    },
  });
}

export function usePTTrainerMap() {
  const { data: trainers = [] } = usePTTrainers();
  return useMemo(() => {
    const m: Record<string, string> = {};
    trainers.forEach((t) => { m[t.id] = t.name; });
    return m;
  }, [trainers]);
}

export function usePTAppointments(opts: {
  fromIso: string;
  toIso: string;
  trainerId?: string;
  format?: string;
  status?: string;
}) {
  const { fromIso, toIso, trainerId, format, status } = opts;
  return useQuery({
    queryKey: ["pt-appointments", fromIso, toIso, trainerId, format, status],
    queryFn: async (): Promise<PTAppointment[]> => {
      let q = (supabase as any)
        .from("pt_appointments")
        .select("*")
        .gte("starts_at", fromIso)
        .lte("starts_at", toIso)
        .order("starts_at", { ascending: true });
      if (trainerId && trainerId !== "all") q = q.eq("instructor_id", trainerId);
      if (format && format !== "all") q = q.eq("format", format);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PTAppointment[];
    },
  });
}

export function usePTTasks(includeDone = false) {
  return useQuery({
    queryKey: ["pt-tasks", includeDone],
    queryFn: async (): Promise<PTTask[]> => {
      let q = (supabase as any).from("pt_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }).limit(200);
      if (!includeDone) q = q.is("completed_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PTTask[];
    },
  });
}

export function usePTTaskMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pt-tasks"] });

  const create = useMutation({
    mutationFn: async (input: Partial<PTTask>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_tasks").insert({
        ...input,
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task added"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not add task"),
  });

  const toggle = useMutation({
    mutationFn: async (task: PTTask) => {
      const { error } = await (supabase as any)
        .from("pt_tasks")
        .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Could not update task"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove task"),
  });

  return { create, toggle, remove };
}

/** Every person who has ever had a PT pass or appointment. */
export function usePTClients() {
  return useQuery({
    queryKey: ["pt-clients"],
    queryFn: async () => {
      const [{ data: passes }, { data: appts }, { data: profiles }] = await Promise.all([
        (supabase as any).from("pt_passes").select("user_id, format, sessions_remaining, sessions_total, status, expires_at, pack_name"),
        (supabase as any).from("pt_appointments").select("user_id, starts_at, status, instructor_id, payment_status, amount_due_cents"),
        (supabase as any).from("pt_client_profiles").select("*"),
      ]);
      const ids = Array.from(new Set([
        ...(passes ?? []).map((p: any) => p.user_id),
        ...(appts ?? []).map((a: any) => a.user_id),
        ...(profiles ?? []).map((p: any) => p.user_id),
      ].filter(Boolean)));
      return {
        ids: ids as string[],
        passes: (passes ?? []) as any[],
        appts: (appts ?? []) as any[],
        profiles: (profiles ?? []) as any[],
      };
    },
  });
}

export function usePTClientProfile(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_client_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
  });
}

export function useSavePTClientProfile(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!userId) throw new Error("Missing client");
      const { error } = await (supabase as any)
        .from("pt_client_profiles")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["pt-client-profile", userId] });
      qc.invalidateQueries({ queryKey: ["pt-clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });
}
