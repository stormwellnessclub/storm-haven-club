import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkoutSessionFromSearch } from "@/lib/classPassCheckout";
import { toast } from "sonner";

/** One consumer per page. Wait for auth and fulfillment before refreshing balances. */
export function useClassPassCheckoutReturn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [returnSession] = useState(() => checkoutSessionFromSearch(window.location.search));
  const [isConfirming, setIsConfirming] = useState(!!returnSession);
  const [error, setError] = useState<string | null>(null);
  const [pass, setPass] = useState<any>(null);
  const started = useRef(false);
  const confirm = useCallback(async () => {
    if (!user || !returnSession) return;
    setIsConfirming(true);
    setError(null);
    try {
      const { data, error: requestError } = await supabase.functions.invoke("class-pass-confirm", { body: { session_id: returnSession } });
      if (requestError || !data?.success || !data?.paid || !data?.pass) {
        throw new Error("We couldn't confirm your pass yet. Please check again—don't purchase another pass.");
      }
      await queryClient.invalidateQueries({ queryKey: ["user-credits", user.id] });
      setPass(data.pass);
      const params = new URLSearchParams(window.location.search.replace(/\?(?=session_id=)/g, "&"));
      params.delete("purchase");
      params.delete("session_id");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
      toast.success("Your class pass is ready. You can now finish booking.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm your class pass. Please check again.");
    } finally {
      setIsConfirming(false);
    }
  }, [user?.id, returnSession, queryClient]);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    if (returnSession) void confirm();
    else if (new URLSearchParams(window.location.search).get("purchase") === "cancelled") {
      toast.info("Purchase cancelled. No new pass was purchased.");
      const params = new URLSearchParams(window.location.search);
      params.delete("purchase");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
  }, [user?.id, returnSession, confirm]);
  return { isConfirming, error, pass, retry: confirm };
}