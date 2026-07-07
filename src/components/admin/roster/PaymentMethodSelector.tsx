import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Ticket, DollarSign, ShoppingBag, Gift } from "lucide-react";
import { getCategoryDisplayName } from "@/lib/classCategories";

export type PaymentOption = "pass" | "credits" | "dropin" | "sell" | "comp";

interface ActivePass {
  id: string;
  pass_type: string;
  category: string;
  classes_remaining: number;
  expires_at: string;
}

interface ActiveCredit {
  id: string;
  credit_type: string;
  credits_remaining: number;
  expires_at: string;
}

interface PaymentMethodSelectorProps {
  userId: string | null;
  memberId: string | null;
  isMember: boolean;
  selectedMethod: PaymentOption | null;
  onMethodChange: (method: PaymentOption) => void;
  selectedPassId: string | null;
  onPassIdChange: (id: string | null) => void;
  selectedCreditId: string | null;
  onCreditIdChange: (id: string | null) => void;
  dropInRate: "member" | "nonmember";
  onDropInRateChange: (rate: "member" | "nonmember") => void;
  isFundraiser?: boolean;
  fundraiserAmountCents?: number;
  /**
   * Held pass on a waitlist entry — surfaced in the pass list even if the
   * underlying row is currently `exhausted`/0 remaining (because the seat is
   * held). Promote flow refunds the hold before decrementing, so it's safe.
   */
  heldPassId?: string | null;
  heldCreditId?: string | null;
}

export function PaymentMethodSelector({
  userId,
  memberId,
  isMember,
  selectedMethod,
  onMethodChange,
  selectedPassId,
  onPassIdChange,
  selectedCreditId,
  onCreditIdChange,
  dropInRate,
  onDropInRateChange,
  isFundraiser = false,
  fundraiserAmountCents = 4000,
  heldPassId = null,
  heldCreditId = null,
}: PaymentMethodSelectorProps) {
  // Fetch active class passes for the user
  const { data: passes = [] } = useQuery({
    queryKey: ["roster-passes", userId, heldPassId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("class_passes")
        .select("id, pass_type, category, classes_remaining, expires_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("classes_remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      if (error) throw error;
      const list = (data as ActivePass[]) || [];

      // If there's a held pass on the waitlist entry, ensure it appears even
      // though it's currently 0-remaining/exhausted.
      if (heldPassId && !list.some(p => p.id === heldPassId)) {
        const { data: held } = await supabase
          .from("class_passes")
          .select("id, pass_type, category, classes_remaining, expires_at")
          .eq("id", heldPassId)
          .maybeSingle();
        if (held) {
          // Treat the held seat as 1 remaining for display purposes.
          list.unshift({ ...(held as ActivePass), classes_remaining: Math.max(1, held.classes_remaining) });
        }
      }
      return list;
    },
    enabled: !!userId,
  });

  // Fetch active member credits
  const { data: credits = [] } = useQuery({
    queryKey: ["roster-credits", memberId, heldCreditId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("member_credits")
        .select("id, credit_type, credits_remaining, expires_at")
        .eq("member_id", memberId)
        .eq("credit_type", "class")
        .gt("credits_remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      if (error) throw error;
      const list = (data as ActiveCredit[]) || [];

      if (heldCreditId && !list.some(c => c.id === heldCreditId)) {
        const { data: held } = await supabase
          .from("member_credits")
          .select("id, credit_type, credits_remaining, expires_at")
          .eq("id", heldCreditId)
          .maybeSingle();
        if (held) {
          list.unshift({ ...(held as ActiveCredit), credits_remaining: Math.max(1, held.credits_remaining) });
        }
      }
      return list;
    },
    enabled: !!memberId,
  });

  const hasPasses = passes.length > 0;
  const hasCredits = credits.length > 0;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Payment Method</Label>
      <RadioGroup
        value={selectedMethod || ""}
        onValueChange={(v) => {
          onMethodChange(v as PaymentOption);
          // Reset sub-selections
          if (v !== "pass") onPassIdChange(null);
          if (v !== "credits") onCreditIdChange(null);
        }}
        className="space-y-2"
      >
        {/* Use existing pass — hidden for fundraiser/donation classes */}
        {hasPasses && !isFundraiser && (
          <div className="flex items-start space-x-3 rounded-sm border p-3">
            <RadioGroupItem value="pass" id="pay-pass" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="pay-pass" className="text-sm font-medium cursor-pointer">
                  Use existing class pass
                </Label>
                <Badge variant="secondary" className="text-xs">{passes.reduce((s, p) => s + p.classes_remaining, 0)} remaining</Badge>
              </div>
              {selectedMethod === "pass" && (
                <Select value={selectedPassId || ""} onValueChange={(v) => onPassIdChange(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a pass..." />
                  </SelectTrigger>
                  <SelectContent>
                    {passes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {getCategoryDisplayName(p.category)} {p.pass_type === "single" ? "Single" : "10-Pack"} — {p.classes_remaining} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        {/* Use member credits — hidden for fundraiser/donation classes */}
        {hasCredits && !isFundraiser && (
          <div className="flex items-start space-x-3 rounded-sm border p-3">
            <RadioGroupItem value="credits" id="pay-credits" className="mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="pay-credits" className="text-sm font-medium cursor-pointer">
                  Use member credits
                </Label>
                <Badge variant="secondary" className="text-xs">{credits.reduce((s, c) => s + c.credits_remaining, 0)} remaining</Badge>
              </div>
              {selectedMethod === "credits" && credits.length > 1 && (
                <Select value={selectedCreditId || ""} onValueChange={(v) => onCreditIdChange(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select credit pool..." />
                  </SelectTrigger>
                  <SelectContent>
                    {credits.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.credits_remaining} credits — expires {new Date(c.expires_at).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        {/* Charge — donation amount for fundraiser classes, otherwise standard drop-in */}
        <div className="flex items-start space-x-3 rounded-sm border p-3">
          <RadioGroupItem value="dropin" id="pay-dropin" className="mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="pay-dropin" className="text-sm font-medium cursor-pointer">
                {isFundraiser
                  ? `Charge donation — $${(fundraiserAmountCents / 100).toFixed(0)}`
                  : "Charge single drop-in"}
              </Label>
            </div>
            {selectedMethod === "dropin" && !isFundraiser && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDropInRateChange("member")}
                  className={`flex-1 rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                    dropInRate === "member" ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"
                  }`}
                >
                  Member — $25
                </button>
                <button
                  type="button"
                  onClick={() => onDropInRateChange("nonmember")}
                  className={`flex-1 rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                    dropInRate === "nonmember" ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"
                  }`}
                >
                  Non-Member — $30
                </button>
              </div>
            )}
            {selectedMethod === "dropin" && isFundraiser && (
              <p className="text-xs text-muted-foreground">
                Fundraiser class — donation amount will be charged to the member's card on file (or collected at the desk).
              </p>
            )}
          </div>
        </div>

        {/* Sell a package — hidden for fundraiser/donation classes */}
        {!isFundraiser && (
          <div className="flex items-start space-x-3 rounded-sm border p-3">
            <RadioGroupItem value="sell" id="pay-sell" className="mt-0.5" />
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="pay-sell" className="text-sm font-medium cursor-pointer">
                Sell a package now
              </Label>
            </div>
          </div>
        )}

        {/* Comp */}
        <div className="flex items-start space-x-3 rounded-sm border p-3">
          <RadioGroupItem value="comp" id="pay-comp" className="mt-0.5" />
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="pay-comp" className="text-sm font-medium cursor-pointer">
              Comp / No charge
            </Label>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
