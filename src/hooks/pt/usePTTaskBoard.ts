import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTTaskRow {
  id: string;
  title: string;
  detail: string | null;
  task_type: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  client_user_id: string | null;
  instructor_id: string | null;
  assigned_to: string | null;
  appointment_id: string | null;
  completed_at: string | null;
  recurrence: string;
  recurrence_interval: number;
  recurrence_until: string | null;
  parent_task_id: string | null;
  created_at: string;
}

export const PT_TASK_TYPES = [
  "general",
  "follow_up",
  "check_in",
  "renewal",
  "programming",
  "assessment",
  "admin",
];

export const PT_TASK_STATUSES = ["todo", "in_progress", "done"] as const;

export function usePTTaskList() {
  return useQuery({
    queryKey: ["pt-tasks", "board"],
    queryFn: async (): Promise<PTTaskRow[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_tasks")
        .select("id, title, detail, task_type, priority, status, due_at, client_user_id, instructor_id, assigned_to, appointment_id, completed_at, recurrence, recurrence_interval, recurrence_until, parent_task_id, created_at")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTTaskBoardMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pt-tasks"] });

  const create = useMutation({
    mutationFn: async (input: Partial<PTTaskRow>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_tasks").insert({
        ...input,
        created_by: auth.user?.id ?? null,
        status: input.status ?? "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Task created"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not create task"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PTTaskRow> }) => {
      const { error } = await (supabase as any).from("pt_tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Could not update task"),
  });

  const complete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await (supabase as any).rpc("pt_complete_task", { p_task_id: id, p_completed: completed });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Could not update task"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Task deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete task"),
  });

  return { create, update, complete, remove };
}
