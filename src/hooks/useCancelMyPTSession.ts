import { useQueryClient } from "@tanstack/react-query";
import { differenceInHours, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { memberCancelOutcomeMessage } from "@/lib/ptFormat";

/** Client cancels their own confirmed PT session through cancel_pt_appointment (server applies the 24-hour rule). */
export function useCancelMyPTSession() {
  const qc = useQueryClient();
  return async (a: { id: string; starts_at: string }) => {
    const hoursOut = differenceInHours(parseISO(a.starts_at), new Date());
    const warn = hoursOut < 24
      ? "This is less than 24 hours away. Cancelling now will forfeit this session from your pack. Continue?"
      : "Cancel this session? If it was booked from a pack, it will be returned.";
    if (!window.confirm(warn)) return false;
    const { data, error } = await (supabase as any).rpc("cancel_pt_appointment", { p_appointment_id: a.id, p_reason: "Cancelled by client" });
    if (error) { toast.error(error.message); return false; }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(memberCancelOutcomeMessage(row?.cancel_credit_outcome));
    qc.invalidateQueries({ queryKey: ["pt-my-portal"] });
    qc.invalidateQueries({ queryKey: ["pt-my-requests"] });
    qc.invalidateQueries({ queryKey: ["pt-client-request-times"] });
    return true;
  };
}
