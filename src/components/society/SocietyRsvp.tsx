import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENT_ROUND } from "@/lib/societyBooks";

const OPTIONS = [
  { value: "yes", label: "I'll be there" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't make it" },
] as const;

export function useIsSocietyMember() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["hss-vote-eligible", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_society_roster_member" as any, { _uid: user!.id });
      if (error) throw error;
      return !!data;
    },
  });
}

/** One RSVP control shared by the book club page and the member portal card. */
export function SocietyRsvp({ roundKey = CURRENT_ROUND.key, compact = false }: { roundKey?: string; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: eligible } = useIsSocietyMember();
  const { data: mine } = useQuery({
    queryKey: ["hss-rsvp", roundKey, user?.id],
    enabled: !!user && eligible === true,
    queryFn: async () => {
      const { data } = await supabase.from("society_meeting_rsvps").select("response")
        .eq("round_key", roundKey).eq("user_id", user!.id).maybeSingle();
      return data?.response ?? null;
    },
  });
  const save = useMutation({
    mutationFn: async (response: string) => {
      const { error } = await supabase.from("society_meeting_rsvps")
        .upsert({ round_key: roundKey, user_id: user!.id, response }, { onConflict: "round_key,user_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hss-rsvp", roundKey] }); toast.success("Your RSVP is saved"); },
    onError: () => toast.error("Your RSVP didn't save. Please try again."),
  });
  if (!user || eligible !== true) return null;
  return (
    <div id="rsvp" className={compact ? "mt-4" : "mt-6"}>
      <p className={compact ? "text-sm" : "font-serif text-xl"}>Will you be joining us?</p>
      <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.preventDefault()}>
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" disabled={save.isPending}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); save.mutate(o.value); }}
            className={`px-4 py-2 rounded-sm border text-sm transition-colors ${mine === o.value
              ? "bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))] border-[hsl(var(--society-gold))]"
              : "border-[hsl(var(--society-line))] hover:border-[hsl(var(--society-gold))]"}`}>
            {o.label}
          </button>
        ))}
      </div>
      {mine && <p className="mt-2 text-xs text-[hsl(var(--society-muted))]">You can change your answer anytime.</p>}
    </div>
  );
}
