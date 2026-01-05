import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MemberTag {
  id: string;
  member_id: string;
  tag: string;
  created_by: string;
  created_at: string;
}

export interface CreateTagData {
  member_id: string;
  tag: string;
}

export function useMemberTags(memberId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-tags", memberId],
    queryFn: async (): Promise<MemberTag[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("member_tags")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MemberTag[];
    },
    enabled: !!user && !!memberId,
  });
}

export function useCreateMemberTag() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTagData) => {
      if (!user) throw new Error("You must be signed in");

      const { data: tag, error } = await supabase
        .from("member_tags")
        .insert({
          ...data,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return tag as MemberTag;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["member-tags", variables.member_id] });
      toast.success("Tag added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add tag");
    },
  });
}

export function useDeleteMemberTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, memberId }: { id: string; memberId: string }) => {
      const { error } = await supabase
        .from("member_tags")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["member-tags", variables.memberId] });
      toast.success("Tag removed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove tag");
    },
  });
}



