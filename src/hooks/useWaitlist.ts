import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useWaitlistCounts(sessionIds: string[]) {
  return useQuery({
    queryKey: ["waitlist-counts", sessionIds],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_counts", {
        p_session_ids: sessionIds,
      });

      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const entry of (data as any[]) || []) {
        counts[entry.session_id] = Number(entry.count);
      }
      return counts;
    },
  });
}

export function useWaitlistStatus(sessionIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["waitlist-status", user?.id, sessionIds],
    enabled: !!user && sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_waitlist")
        .select("id, session_id, status, position")
        .eq("user_id", user!.id)
        .in("session_id", sessionIds)
        .in("status", ["waiting", "notified"]);

      if (error) throw error;
      // Return a map of session_id -> waitlist entry
      const map: Record<string, { id: string; status: string; position: number }> = {};
      for (const entry of data || []) {
        map[entry.session_id] = { id: entry.id, status: entry.status, position: entry.position };
      }
      return map;
    },
  });
}

export function useJoinWaitlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      paymentMethod,
      passId,
      creditId,
    }: {
      sessionId: string;
      paymentMethod: "credits" | "pass";
      passId?: string | null;
      creditId?: string | null;
    }) => {
      if (!user) throw new Error("Please sign in first.");

      const { data, error } = await supabase.rpc("join_waitlist_with_hold", {
        p_session_id: sessionId,
        p_method: paymentMethod,
        p_pass_id: passId ?? null,
        p_credit_id: creditId ?? null,
      });

      if (error) throw error;
      const result = data as { position: number; payment_method: string };
      return { ...result, sessionId };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-status"] });
      queryClient.invalidateQueries({ queryKey: ["waitlist-counts"] });
      queryClient.invalidateQueries({ queryKey: ["available-credits"] });
      queryClient.invalidateQueries({ queryKey: ["roster-passes"] });
      queryClient.invalidateQueries({ queryKey: ["roster-credits"] });
      const heldLabel = data.payment_method === "credits" ? "1 class credit" : "1 class on your pass";
      toast.success("Added to Waitlist", {
        description: `You're #${data.position} on the waitlist. We've held ${heldLabel} — it'll be refunded if you leave or the spot doesn't open.`,
      });

      // Fire confirmation email + SMS (best-effort).
      if (!user) return;
      try {
        // Lookup session + contact in parallel.
        const [{ data: session }, { data: prof }, { data: nonMember }] = await Promise.all([
          (supabase.from as any)("class_sessions")
            .select("id, scheduled_date, scheduled_time, class_types(name)")
            .eq("id", data.sessionId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("email, phone, sms_opt_in")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("non_member_profiles")
            .select("email, phone, sms_opt_in")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        const email =
          (prof as any)?.email ?? (nonMember as any)?.email ?? user.email ?? null;
        const phone = (prof as any)?.phone ?? (nonMember as any)?.phone ?? null;
        const smsOptIn =
          (prof as any)?.sms_opt_in === true ||
          (nonMember as any)?.sms_opt_in === true;

        const className =
          (session as any)?.class_types?.name ?? "your class";
        const rawDate = (session as any)?.scheduled_date as string | undefined;
        const rawTime = (session as any)?.scheduled_time as string | undefined;
        const dateStr = rawDate
          ? new Date(rawDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "America/Chicago",
            })
          : "";
        const timeStr = rawTime
          ? new Date(`2000-01-01T${rawTime.slice(0, 5)}:00`).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "";

        await Promise.allSettled([
          email
            ? supabase.functions.invoke("send-email", {
                body: {
                  type: "waitlist_joined",
                  to: email,
                  data: { className, date: dateStr, time: timeStr, position: data.position },
                },
              })
            : Promise.resolve(),
          phone && smsOptIn
            ? supabase.functions.invoke("send-sms", {
                body: {
                  to: { phone, userId: user.id },
                  templateKey: "waitlist-joined",
                  variables: { className, date: dateStr, time: timeStr },
                  idempotencyKey: `waitlist-join-${data.sessionId}-${user.id}`,
                  metadata: { source: "waitlist_join" },
                },
              })
            : Promise.resolve(),
        ]);
      } catch (e) {
        console.warn("waitlist join notify failed (non-fatal):", e);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useLeaveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ waitlistId }: { waitlistId: string }) => {
      const { error: refundError } = await supabase.rpc("refund_waitlist_hold", {
        p_waitlist_id: waitlistId,
      });
      if (refundError) throw refundError;
      const { error } = await supabase
        .from("class_waitlist")
        .delete()
        .eq("id", waitlistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-status"] });
      queryClient.invalidateQueries({ queryKey: ["waitlist-counts"] });
      queryClient.invalidateQueries({ queryKey: ["available-credits"] });
      toast.success("Left waitlist — your credit/pass has been refunded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
