import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";

interface WalletButtonsProps {
  code: string;
}

interface ProbeState {
  loading: boolean;
  apple: { enabled: boolean; ready?: boolean; reason?: string } | null;
  google: { enabled: boolean; saveUrl?: string; reason?: string } | null;
}

export function WalletButtons({ code }: WalletButtonsProps) {
  const [state, setState] = useState<ProbeState>({ loading: true, apple: null, google: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [appleRes, googleRes] = await Promise.all([
        supabase.functions.invoke("mothers-day-wallet-apple", { body: { code } }),
        supabase.functions.invoke("mothers-day-wallet-google", { body: { code } }),
      ]);
      if (cancelled) return;
      setState({
        loading: false,
        apple: (appleRes.data as any) ?? { enabled: false },
        google: (googleRes.data as any) ?? { enabled: false },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleApple = async () => {
    if (!state.apple?.enabled || !state.apple?.ready) {
      toast.message("Apple Wallet coming soon", {
        description: state.apple?.reason || "Check back shortly.",
      });
      return;
    }
    // When Apple signing is implemented, this will download the .pkpass.
    window.location.href = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/mothers-day-wallet-apple?code=${encodeURIComponent(code)}`;
  };

  const handleGoogle = () => {
    if (!state.google?.enabled || !state.google?.saveUrl) {
      toast.message("Google Wallet coming soon", {
        description: state.google?.reason || "Check back shortly.",
      });
      return;
    }
    window.open(state.google.saveUrl, "_blank");
  };

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#a17e3a" }} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs tracking-[3px]" style={{ color: "#a17e3a" }}>
        SAVE TO YOUR WALLET
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={handleApple}
          className="w-full"
          style={{ borderColor: "#1c170f", color: "#1c170f" }}
        >
          <Smartphone className="w-4 h-4 mr-2" />
          Add to Apple Wallet
        </Button>
        <Button
          variant="outline"
          onClick={handleGoogle}
          className="w-full"
          style={{ borderColor: "#1c170f", color: "#1c170f" }}
        >
          <Wallet className="w-4 h-4 mr-2" />
          Save to Google Wallet
        </Button>
      </div>
      <p className="text-[11px] italic" style={{ color: "#6b5a3b" }}>
        Non-transferable · Includes expiration date and your unique code
      </p>
    </div>
  );
}
