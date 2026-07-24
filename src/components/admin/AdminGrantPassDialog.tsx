import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Gift } from "lucide-react";

type GrantType = "class_credits" | "guest_pass" | "guest_pass_credit" | "class_pass" | "kids_care_pass" | "red_light" | "dry_cryo" | "ozone";

interface AdminGrantPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill for a specific member */
  prefill?: {
    memberId?: string;
    userId?: string;
    name?: string;
    email?: string;
  };
  onSuccess?: () => void;
}

export function AdminGrantPassDialog({ open, onOpenChange, prefill, onSuccess }: AdminGrantPassDialogProps) {
  const queryClient = useQueryClient();
  const [grantType, setGrantType] = useState<GrantType>(prefill?.memberId ? "guest_pass_credit" : "guest_pass");
  const [guestName, setGuestName] = useState(prefill?.name || "");
  const [guestEmail, setGuestEmail] = useState(prefill?.email || "");
  const [quantity, setQuantity] = useState(1);
  const [guestPassQuantity, setGuestPassQuantity] = useState(1);
  const [expiresAt, setExpiresAt] = useState<Date>(addDays(new Date(), 30));
  const [notes, setNotes] = useState("");
  // Class pass specific
  const [classCategory, setClassCategory] = useState<"pilates_cycling" | "other">("pilates_cycling");
  const [passType, setPassType] = useState<"single" | "10-pack">("single");
  // Kids care pass specific
  const [kidsCareSessionCount, setKidsCareSessionCount] = useState(16);
  const [purchasedAt, setPurchasedAt] = useState<Date>(new Date());

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (grantType === "guest_pass") {
        if (!guestName.trim()) throw new Error("Guest name is required");
        const passesToInsert = Array.from({ length: guestPassQuantity }, () => ({
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || null,
          price_paid: 0,
          status: "active",
          purchased_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          valid_date: null,
          member_referral: notes.trim() || "Admin Granted",
          user_id: prefill?.userId || null,
        }));
        const { error } = await (supabase
          .from("guest_passes" as any)
          .insert(passesToInsert) as any);
        if (error) throw error;
      } else if (grantType === "class_pass") {
        if (!prefill?.userId) throw new Error("User ID required for class passes");
        const classCount = passType === "10-pack" ? 10 : 1;
        const { error } = await supabase.from("class_passes").insert({
          user_id: prefill.userId,
          member_id: prefill.memberId || null,
          category: classCategory as any,
          pass_type: passType,
          classes_total: classCount,
          classes_remaining: classCount,
          price_paid: 0,
          is_member_price: !!prefill.memberId,
          expires_at: expiresAt.toISOString(),
          status: "active" as const,
        });
        if (error) throw error;
      } else if (grantType === "kids_care_pass") {
        if (!prefill?.userId) throw new Error("User ID required for kids care passes");
        const { error } = await supabase.from("class_passes").insert({
          user_id: prefill.userId,
          member_id: prefill.memberId || null,
          category: "other" as any,
          pass_type: "kids_care_monthly",
          classes_total: kidsCareSessionCount,
          classes_remaining: kidsCareSessionCount,
          price_paid: 0,
          is_member_price: !!prefill.memberId,
          purchased_at: purchasedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "active" as const,
        });
        if (error) throw error;
      } else {
        // class_credits, red_light, dry_cryo, ozone, or guest_pass_credit
        if (!prefill?.userId && !prefill?.memberId) throw new Error("User or member ID required");
        const cycleStart = format(new Date(), "yyyy-MM-dd");
        const cycleEnd = format(expiresAt, "yyyy-MM-dd");
        const creditType: "class" | "guest_pass" | "red_light" | "dry_cryo" | "ozone" =
          grantType === "guest_pass_credit" ? "guest_pass"
          : grantType === "class_credits" ? "class"
          : grantType;

        // If member already has an active (non-expired, remaining > 0) credit of this type,
        // add to that existing row instead of creating a parallel row that would hide it.
        let existingCredit: { id: string; credits_total: number; credits_remaining: number } | null = null;
        if (prefill?.memberId) {
          const { data: existing } = await supabase
            .from("member_credits")
            .select("id, credits_total, credits_remaining")
            .eq("member_id", prefill.memberId)
            .eq("credit_type", creditType)
            .gt("credits_remaining", 0)
            .gt("expires_at", new Date().toISOString())
            .order("cycle_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingCredit = (existing as any) || null;
        }

        if (existingCredit) {
          const prevRemaining = existingCredit.credits_remaining;
          const newTotal = existingCredit.credits_total + quantity;
          const newRemaining = existingCredit.credits_remaining + quantity;
          const { error: updateError } = await supabase
            .from("member_credits")
            .update({ credits_total: newTotal, credits_remaining: newRemaining })
            .eq("id", existingCredit.id);
          if (updateError) throw updateError;

          const { data: { user: authUser } } = await supabase.auth.getUser();
          await supabase.from("credit_adjustments").insert({
            member_id: prefill!.memberId!,
            member_credit_id: existingCredit.id,
            credit_type: creditType,
            adjustment_type: "add",
            amount: quantity,
            previous_balance: prevRemaining,
            new_balance: newRemaining,
            reason: notes || "Admin grant (added to existing cycle)",
            adjusted_by: authUser?.id || null,
          } as any);
        } else {
          const { error } = await supabase.from("member_credits").insert({
            user_id: prefill?.userId || null,
            member_id: prefill?.memberId || null,
            credit_type: creditType,
            credits_total: quantity,
            credits_remaining: quantity,
            cycle_start: cycleStart,
            cycle_end: cycleEnd,
            expires_at: expiresAt.toISOString(),
          } as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Pass/credit granted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail"] });
      queryClient.invalidateQueries({ queryKey: ["member-credits"] });
      queryClient.invalidateQueries({ queryKey: ["member-class-passes-admin"] });
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-passes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-wellness-credits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-guest-passes"] });
      queryClient.invalidateQueries({ queryKey: ["portal-guest-passes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-passes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-bookings"] });
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setGrantType(prefill?.memberId ? "guest_pass_credit" : "guest_pass");
    setGuestName(prefill?.name || "");
    setGuestEmail(prefill?.email || "");
    setQuantity(1);
    setGuestPassQuantity(1);
    setExpiresAt(addDays(new Date(), 30));
    setNotes("");
    setClassCategory("pilates_cycling");
    setPassType("single");
    setKidsCareSessionCount(16);
    setPurchasedAt(new Date());
  };

  const typeLabel: Record<GrantType, string> = {
    class_credits: "Class Credits (member can book classes)",
    guest_pass: "Guest Pass Voucher (non-member / walk-in)",
    guest_pass_credit: "Guest Pass Credit — lets member invite guests",
    class_pass: "Class Pass",
    kids_care_pass: "Kids Care Pass",
    red_light: "Red Light Therapy Credits",
    dry_cryo: "Dry Cryotherapy Credits",
  };

  // Filter available types based on prefill
  const availableTypes: GrantType[] = prefill?.userId
    ? ["class_credits", "guest_pass_credit", "class_pass", "kids_care_pass", "red_light", "dry_cryo", "guest_pass"]
    : ["guest_pass"]; // Without a user, can only grant guest passes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Grant Pass / Credit
          </DialogTitle>
          <DialogDescription>
            {prefill?.name ? `For ${prefill.name}` : "Manually create a pass or credit"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={grantType} onValueChange={(v) => setGrantType(v as GrantType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warning when voucher selected for a member */}
          {grantType === "guest_pass" && prefill?.memberId && (
            <div className="rounded-md bg-yellow-50 border border-yellow-300 p-3 text-xs text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
              ⚠️ Vouchers are for direct guest entries (walk-ins). Use <strong>Guest Pass Credit</strong> instead so the member can see and redeem it in their app.
            </div>
          )}

          {/* Guest Pass fields */}
          {grantType === "guest_pass" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Guest Name *</Label>
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Guest Email</Label>
                <Input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Optional" type="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input type="number" min={1} max={20} value={guestPassQuantity} onChange={(e) => setGuestPassQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
            </>
          )}

          {/* Class Pass fields */}
          {grantType === "class_pass" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={classCategory} onValueChange={(v) => setClassCategory(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilates_cycling">Pilates / Cycling</SelectItem>
                    <SelectItem value="other">Other Classes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pass Type</Label>
                <Select value={passType} onValueChange={(v) => setPassType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Class</SelectItem>
                    <SelectItem value="10-pack">10-Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Kids Care Pass fields */}
          {grantType === "kids_care_pass" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sessions</Label>
                <Input type="number" min={1} max={50} value={kidsCareSessionCount} onChange={(e) => setKidsCareSessionCount(parseInt(e.target.value) || 16)} />
                <p className="text-xs text-muted-foreground">Standard monthly pass = 16 sessions</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Purchase Date (backdate if needed)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(purchasedAt, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={purchasedAt}
                      onSelect={(d) => d && setPurchasedAt(d)}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Credit quantity (class, wellness, guest pass credit) */}
          {(grantType === "class_credits" || grantType === "red_light" || grantType === "dry_cryo" || grantType === "guest_pass_credit") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">How many credits?</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="h-12 text-lg font-semibold"
              />
              <div className="flex flex-wrap gap-2">
                {[1, 5, 10, 20].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={quantity === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuantity(n)}
                    className="h-8"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Expiration */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Expiration Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(expiresAt, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={(d) => d && setExpiresAt(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes (for guest pass) */}
          {grantType === "guest_pass" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes / Referral Source</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Complimentary, Admin Granted" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => grantMutation.mutate()}
            disabled={grantMutation.isPending || (grantType === "guest_pass" && !guestName.trim())}
          >
            {grantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
            Grant {grantType === "guest_pass" && guestPassQuantity > 1 ? `${guestPassQuantity} Guest Passes` : typeLabel[grantType]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
