import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  appointmentId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
  className?: string;
}

/**
 * Generates (or fetches) a public spa review token for the appointment and copies
 * the full review URL to the clipboard. Safe to render even pre-completion; the RPC
 * will create the token row when called.
 */
export function SpaReviewLinkButton({ appointmentId, variant = "outline", size = "sm", className }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("ensure_spa_review_token", { _appointment_id: appointmentId });
      if (error) throw error;
      const url = `${window.location.origin}/review/spa/${data}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Review link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch (err: any) {
      console.error("Failed to copy spa review link", err);
      toast.error(err?.message || "Couldn't generate review link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={handleClick} disabled={loading} className={className}>
      {copied ? <Check className="h-3 w-3 mr-1.5" /> : <Link2 className="h-3 w-3 mr-1.5" />}
      {copied ? "Copied" : "Copy review link"}
    </Button>
  );
}
