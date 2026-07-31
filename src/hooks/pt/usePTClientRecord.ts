import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Generic per-client table reader. */
function useClientTable<T = any>(
  table: string,
  userId: string | undefined,
  opts: { column?: string; orderBy?: string; ascending?: boolean } = {},
) {
  const { column = "user_id", orderBy = "created_at", ascending = false } = opts;
  return useQuery({
    queryKey: ["pt-client", table, userId],
    enabled: !!userId,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await (supabase as any)
        .from(table).select("*").eq(column, userId).order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export const usePTClientAppointments = (userId?: string) =>
  useClientTable("pt_appointments", userId, { orderBy: "starts_at" });
export const usePTClientPassesFull = (userId?: string) =>
  useClientTable("pt_passes", userId, { orderBy: "created_at" });
export const usePTClientSessionNotes = (userId?: string) =>
  useClientTable("pt_session_notes", userId, { orderBy: "session_date" });
export const usePTClientMetrics = (userId?: string) =>
  useClientTable("pt_body_metrics", userId, { orderBy: "measured_on" });
export const usePTClientPhotos = (userId?: string) =>
  useClientTable("pt_progress_photos", userId, { orderBy: "taken_on" });
export const usePTClientDocuments = (userId?: string) =>
  useClientTable("pt_documents", userId, { orderBy: "created_at" });
export const usePTClientPrograms = (userId?: string) =>
  useClientTable("pt_programs", userId, { orderBy: "created_at" });
export const usePTClientPrs = (userId?: string) =>
  useClientTable("pt_prs", userId, { orderBy: "achieved_on" });
export const usePTClientMilestones = (userId?: string) =>
  useClientTable("pt_milestones", userId, { orderBy: "created_at" });
export const usePTClientTests = (userId?: string) =>
  useClientTable("pt_performance_tests", userId, { orderBy: "tested_on" });
export const usePTClientActivity = (userId?: string) =>
  useClientTable("pt_activity_log", userId, { orderBy: "created_at" });
export const usePTClientCommunications = (userId?: string) =>
  useClientTable("pt_communications", userId, { column: "client_user_id", orderBy: "created_at" });
export const usePTClientAudit = (userId?: string) =>
  useClientTable("pt_audit_log", userId, { column: "client_user_id", orderBy: "created_at" });

/* ------------------------------------------------------------ alerts */

export interface PTClientAlert {
  id: string;
  client_user_id: string;
  instructor_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  due_date: string | null;
  assigned_to: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export function usePTClientAlerts(userId?: string) {
  return useQuery({
    queryKey: ["pt-client", "pt_alerts", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PTClientAlert[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_alerts").select("*").eq("client_user_id", userId)
        .order("is_resolved", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTAlertMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pt-client", "pt_alerts", userId] });
    qc.invalidateQueries({ queryKey: ["pt-alerts"] });
    qc.invalidateQueries({ queryKey: ["pt-client-directory"] });
  };

  const create = useMutation({
    mutationFn: async (input: {
      message: string; alert_type: string; severity: string;
      due_date?: string | null; assigned_to?: string | null; instructor_id?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_alerts").insert({
        client_user_id: userId,
        created_by: auth?.user?.id ?? null,
        assigned_to: input.assigned_to ?? auth?.user?.id ?? null,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alert created"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not create alert"),
  });

  const resolve = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_alerts").update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: auth?.user?.id ?? null,
        resolution_notes: notes ?? null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alert resolved"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not resolve alert"),
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_alerts")
        .update({ is_resolved: false, resolved_at: null, resolved_by: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Could not reopen alert"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alert removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove alert"),
  });

  return { create, resolve, reopen, remove };
}

/* --------------------------------------------------- writes & activity */

export function usePTClientActions(userId?: string) {
  const qc = useQueryClient();
  const refresh = (tables: string[]) => {
    tables.forEach((t) => qc.invalidateQueries({ queryKey: ["pt-client", t, userId] }));
    qc.invalidateQueries({ queryKey: ["pt-client-profile", userId] });
    qc.invalidateQueries({ queryKey: ["pt-client-directory"] });
  };

  async function logActivity(action: string, detail?: string) {
    const { data: auth } = await supabase.auth.getUser();
    await (supabase as any).from("pt_activity_log").insert({
      user_id: userId, actor_id: auth?.user?.id ?? null, action, detail: detail ?? null,
    });
    qc.invalidateQueries({ queryKey: ["pt-client", "pt_activity_log", userId] });
  }

  const addSessionNote = useMutation({
    mutationFn: async (input: Record<string, any>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_session_notes").insert({
        user_id: userId, created_by: auth?.user?.id ?? null, is_draft: false, ...input,
      });
      if (error) throw error;
      await logActivity("session_note_added");
    },
    onSuccess: () => { toast.success("Note saved"); refresh(["pt_session_notes"]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save note"),
  });

  const addMetrics = useMutation({
    mutationFn: async (input: Record<string, any>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_body_metrics").insert({
        user_id: userId, created_by: auth?.user?.id ?? null, ...input,
      });
      if (error) throw error;
      await logActivity("progress_check_in", "Body metrics recorded");
    },
    onSuccess: () => { toast.success("Check-in recorded"); refresh(["pt_body_metrics"]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save check-in"),
  });

  const logCommunication = useMutation({
    mutationFn: async (input: { channel: string; subject?: string | null; body: string; direction?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_communications").insert({
        client_user_id: userId,
        created_by: auth?.user?.id ?? null,
        direction: input.direction ?? "outbound",
        delivery_status: "logged",
        sent_at: new Date().toISOString(),
        channel: input.channel,
        subject: input.subject ?? null,
        body: input.body,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Message logged"); refresh(["pt_communications"]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not log message"),
  });

  const addDocument = useMutation({
    mutationFn: async (input: { doc_type: string; title: string; external_url?: string | null; expires_at?: string | null; status?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_documents").insert({
        user_id: userId, uploaded_by: auth?.user?.id ?? null, status: input.status ?? "complete", ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document added"); refresh(["pt_documents"]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not add document"),
  });

  const assignTrainer = useMutation({
    mutationFn: async (instructorId: string | null) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_client_profiles").upsert(
        { user_id: userId, primary_trainer_id: instructorId, updated_by: auth?.user?.id ?? null },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      if (instructorId) {
        await (supabase as any).from("pt_client_trainers").insert({
          client_user_id: userId, instructor_id: instructorId,
          relationship: "primary", assigned_by: auth?.user?.id ?? null,
        });
      }
      await logActivity("trainer_assigned");
    },
    onSuccess: () => { toast.success("Trainer updated"); refresh(["pt_client_trainers"]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not assign trainer"),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_client_profiles").upsert(
        { user_id: userId, status, updated_by: auth?.user?.id ?? null },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await logActivity("status_changed", status);
    },
    onSuccess: () => { toast.success("Status updated"); refresh([]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update status"),
  });

  const updateTags = useMutation({
    mutationFn: async (tags: string[]) => {
      const { error } = await (supabase as any).from("pt_client_profiles").upsert(
        { user_id: userId, tags }, { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tags updated"); refresh([]); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update tags"),
  });

  return { addSessionNote, addMetrics, logCommunication, addDocument, assignTrainer, updateStatus, updateTags, logActivity };
}
