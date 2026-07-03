import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Reads the current user's phone number from (in order):
 *   members.phone  →  non_member_profiles.phone  →  profiles.phone
 * Returns null when nothing is on file, which is the signal
 * every booking surface uses to gate the confirm step.
 */
export function usePhoneOnFile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["phone-on-file", user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const email = (user.email || "").toLowerCase().trim();

      // 1) members (may be by user_id or email)
      const memberQuery = email
        ? supabase.from("members").select("phone").or(`user_id.eq.${user.id},email.ilike.${email}`).limit(1).maybeSingle()
        : supabase.from("members").select("phone").eq("user_id", user.id).maybeSingle();
      const { data: m } = await memberQuery;
      if (m?.phone?.trim()) return m.phone.trim();

      // 2) non_member_profiles
      const { data: nm } = await supabase
        .from("non_member_profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (nm?.phone?.trim()) return nm.phone.trim();

      // 3) profiles
      const { data: p } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (p?.phone?.trim()) return p.phone.trim();

      return null;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: async (rawPhone: string) => {
      if (!user) throw new Error("Not signed in");
      const digits = rawPhone.replace(/\D/g, "");
      if (digits.length !== 10) throw new Error("Enter a valid 10-digit mobile number");
      const normalized = `+1${digits}`;

      // Write to all three so downstream lookups agree.
      const writes: Promise<any>[] = [];
      writes.push(
        supabase.from("profiles").update({ phone: normalized }).eq("user_id", user.id)
      );
      writes.push(
        supabase.from("non_member_profiles").update({ phone: normalized }).eq("user_id", user.id)
      );
      writes.push(
        supabase.from("members").update({ phone: normalized }).eq("user_id", user.id)
      );
      await Promise.all(writes);
      return normalized;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone-on-file", user?.id] });
      qc.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["user-profile", user?.id] });
    },
  });

  return {
    phone: q.data ?? null,
    isLoading: q.isLoading,
    hasPhone: !!q.data,
    savePhone: save.mutateAsync,
    isSaving: save.isPending,
  };
}
