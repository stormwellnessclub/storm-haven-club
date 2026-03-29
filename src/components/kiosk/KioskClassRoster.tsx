import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, User } from "lucide-react";
import { useKioskCheckIn } from "@/hooks/useKioskCheckIn";
import { toast } from "sonner";
import { useState } from "react";

interface RosterEntry {
  booking_id: string;
  name: string;
  status: string;
  checked_in_at: string | null;
  photo_url: string | null;
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
              {entry.photo_url ? (
                <AvatarImage src={entry.photo_url} alt={entry.name} />
              ) : null}
              <AvatarFallback className="text-xs">
                <User className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>

            <span className="flex-1 text-sm font-medium truncate">{entry.name}</span>

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
