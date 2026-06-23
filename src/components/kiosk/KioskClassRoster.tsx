import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Sparkles, Trophy, User } from "lucide-react";
import { useKioskCheckIn } from "@/hooks/useKioskCheckIn";
import { toast } from "sonner";
import { useState } from "react";
import { SignedMemberPhoto } from "@/components/member/SignedMemberPhoto";

interface RosterEntry {
  booking_id: string;
  name: string;
  status: string;
  checked_in_at: string | null;
  photo_url: string | null;
  class_type_name?: string | null;
  is_first_in_type?: boolean;
  is_first_visit?: boolean;
  total_classes?: number;
  milestone_hit?: boolean;
  next_milestone?: number | null;
  prior_total?: number;
}

interface KioskClassRosterProps {
  sessionId: string;
  onCheckIn?: () => void;
}

export function KioskClassRoster({ sessionId, onCheckIn }: KioskClassRosterProps) {
  const queryClient = useQueryClient();
  const { checkInClass, isCheckingIn } = useKioskCheckIn();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data: roster, isLoading } = useQuery({
    queryKey: ["kiosk-class-roster", sessionId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("kiosk_class_roster", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return (data || []) as RosterEntry[];
    },
    refetchInterval: 15000,
  });

  const handleCheckIn = async (bookingId: string) => {
    setCheckingId(bookingId);
    const ok = await checkInClass(bookingId);
    if (ok) {
      toast.success("Checked in for class");
      queryClient.invalidateQueries({ queryKey: ["kiosk-class-roster", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-todays-classes"] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-attendance"] });
      onCheckIn?.();
    }
    setCheckingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!roster || roster.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">No bookings yet</p>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {roster.map((entry) => {
        const isCheckedIn = !!entry.checked_in_at;
        const isThisLoading = checkingId === entry.booking_id && isCheckingIn;

        return (
          <div
            key={entry.booking_id}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30"
          >
            <Avatar className="h-8 w-8">
              <SignedMemberPhoto photoUrl={entry.photo_url} alt={entry.name} />
              <AvatarFallback className="text-xs">
                <User className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium truncate">{entry.name}</span>
              {entry.is_first_visit && (
                <Badge className="h-5 px-1.5 text-[10px] gap-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                  <Sparkles className="h-2.5 w-2.5" /> First visit!
                </Badge>
              )}
              {entry.is_first_in_type && !entry.is_first_visit && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                  <Sparkles className="h-2.5 w-2.5" /> First {entry.class_type_name || "class"}
                </Badge>
              )}
              {typeof entry.total_classes === "number" && entry.total_classes > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-0.5">
                  <Trophy className="h-2.5 w-2.5" /> {entry.total_classes}
                </Badge>
              )}
              {/* Approaching milestone heads-up (shows BEFORE check-in so staff can prepare) */}
              {!entry.milestone_hit &&
                typeof entry.next_milestone === "number" &&
                typeof entry.prior_total === "number" &&
                entry.next_milestone - entry.prior_total <= 2 &&
                entry.next_milestone - entry.prior_total > 0 && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] gap-0.5 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <Trophy className="h-2.5 w-2.5" />
                    {entry.next_milestone - entry.prior_total === 1
                      ? `1 away from ${entry.next_milestone}!`
                      : `${entry.next_milestone - entry.prior_total} from ${entry.next_milestone}`}
                  </Badge>
                )}
              {entry.milestone_hit && (
                <Badge
                  className="h-5 px-1.5 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse"
                >
                  🎉 {entry.total_classes}th class today!
                </Badge>
              )}
            </div>

            {isCheckedIn ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 gap-1">
                <CheckCircle2 className="h-3 w-3" /> In
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs px-3"
                disabled={isThisLoading}
                onClick={() => handleCheckIn(entry.booking_id)}
              >
                {isThisLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check In"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
