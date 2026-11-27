import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySocietyRsvps } from "@/hooks/useSocietyGatherings";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "yes", label: "I'll be there" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't make it" },
] as const;

const STATUS: Record<string, string> = {
  yes: "You're attending.",
  maybe: "You're considering this gathering.",
  no: "You've let us know you can't make it.",
};

export function useIsSocietyMember() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["hss-vote-eligible", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("is_society_roster_member" as any, { _uid: user.id });
      if (error) throw error;
      return !!data;
    },
  });
}

export function useSaveSocietyRsvp() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, response }: { eventId: string; response: string }) => {
      if (!user) throw new Error("Sign in to RSVP");
      // One row per member per gathering; a change updates that row.
      const { error } = await supabase.from("society_meeting_rsvps")
        .upsert({ event_id: eventId, user_id: user.id, response } as any, { onConflict: "event_id,user_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["hss-rsvp"] });
      if (v.response !== "dismissed") toast.success("Your RSVP is saved");
    },
    onError: (error) => toast.error(error.message.includes("RSVPs are closed") ? "RSVPs are closed for this gathering." : "Your RSVP didn't save. Please try again."),
  });
}

/** One RSVP control shared by the society page, portal and dashboard. */
export function SocietyRsvp({ eventId, compact = false, allowDismiss = false }: { eventId: string; compact?: boolean; allowDismiss?: boolean }) {
  const { user } = useAuth();
  const { data: eligible } = useIsSocietyMember();
  const { data: mine = {} } = useMySocietyRsvps();
  const save = useSaveSocietyRsvp();
  const [editing, setEditing] = useState(false);
  const { data: closesAt, isPending: deadlinePending, isError: deadlineError } = useQuery({
    queryKey: ["hss-rsvp-close", eventId],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("rsvp_closes_at").eq("id", eventId).maybeSingle();
      if (error) throw error;
      return data?.rsvp_closes_at ?? null;
    },
  });
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!closesAt) return;
    const delay = new Date(closesAt).getTime() - Date.now() + 1;
    if (delay <= 0) { setClock(Date.now()); return; }
    const timer = window.setTimeout(() => setClock(Date.now()), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [closesAt, clock]);
  const closed = !!closesAt && clock > new Date(closesAt).getTime();
  if (closed) {
    const current = mine[eventId];
    return (
      <div id="rsvp" className={compact ? "mt-4" : "mt-6"}>
        <p className={compact ? "text-sm" : "font-serif text-xl"}>RSVPs are closed.</p>
        {current && current !== "dismissed" && <p className="mt-1 text-sm text-[hsl(var(--society-muted))]">{STATUS[current]}</p>}
      </div>
    );
  }
  if (!user && !compact) return (
    <a href="/auth?redirect=/rituals/higher-self-society" className="inline-block mt-6 mr-6 text-xs uppercase tracking-[0.2em] text-[hsl(var(--society-gold))]">Sign in to RSVP</a>
  );
  if (!user || eligible !== true || !eventId) return null;
  const current = mine[eventId];
  const answered = current && current !== "dismissed";

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  if (answered && !editing) {
    return (
      <div id="rsvp" className={compact ? "mt-4" : "mt-6"}>
        <p className={compact ? "text-sm" : "font-serif text-xl"}>{STATUS[current]}</p>
        <Button variant="ghost" type="button" disabled={deadlinePending || deadlineError} onClick={(e) => { stop(e); setEditing(true); }}
          className="mt-2 h-auto p-0 text-xs uppercase tracking-[0.2em] text-[hsl(var(--society-gold))]">
          {current === "yes" ? "Manage or cancel RSVP" : "Update response"}
        </Button>
      </div>
    );
  }

  return (
    <div id="rsvp" className={compact ? "mt-4" : "mt-6"}>
      <p className={compact ? "text-sm" : "font-serif text-xl"}>Will you be joining us?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <Button variant="outline" key={o.value} type="button" disabled={save.isPending || deadlinePending || deadlineError}
            onClick={(e) => { stop(e); save.mutate({ eventId, response: o.value }, { onSuccess: () => setEditing(false) }); }}
            className={`px-4 py-2 rounded-sm border text-sm transition-colors ${current === o.value
              ? "bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))] border-[hsl(var(--society-gold))]"
              : "border-[hsl(var(--society-line))] hover:border-[hsl(var(--society-gold))]"}`}>
            {o.label}
          </Button>
        ))}
      </div>
      {allowDismiss && !current && (
        <Button variant="ghost" type="button" disabled={deadlinePending || deadlineError} onClick={(e) => { stop(e); save.mutate({ eventId, response: "dismissed" }); }}
          className="mt-2 h-auto p-0 text-xs text-[hsl(var(--society-muted))] underline underline-offset-4">Not now</Button>
      )}
    </div>
  );
}
