import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MemberNote {
  id: string;
  member_id: string;
  created_by: string;
  note_text: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteData {
  member_id: string;
  note_text: string;
  is_internal?: boolean;
}

export function useMemberNotes(memberId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-notes", memberId],
    queryFn: async (): Promise<MemberNote[]> => {
      if (!user) return [];

      const { data, error } = await (supabase
        .from("member_notes" as any)
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data || []) as MemberNote[];
    },
    enabled: !!user && !!memberId,
  });
}

export function useCreateMemberNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteData) => {
      if (!user) throw new Error("You must be signed in");

      const { data: note, error } = await (supabase
        .from("member_notes" as any)
        .insert({
          ...data,
          created_by: user.id,
          is_internal: data.is_internal ?? true,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return note as MemberNote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["member-notes", variables.member_id] });
      toast.success("Note added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add note");
    },
  });
}

export function useUpdateMemberNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note_text }: { id: string; note_text: string }) => {
      const { data, error } = await (supabase
        .from("member_notes" as any)
        .update({ note_text } as any)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as MemberNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["member-notes", data.member_id] });
      toast.success("Note updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update note");
    },
  });
}

export function useDeleteMemberNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, memberId }: { id: string; memberId: string }) => {
      const { error } = await (supabase
        .from("member_notes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["member-notes", variables.memberId] });
      toast.success("Note deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete note");
    },
  });
}
