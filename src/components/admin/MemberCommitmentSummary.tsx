import { useQuery } from "@tanstack/react-query";
import { parseISO, format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { membershipCommitment } from "@/lib/membershipCommitment";

export function MemberCommitmentSummary({ memberId, startDate }: { memberId: string; startDate: string }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data, isLoading, error } = useQuery({
    queryKey: ["member-commitment", memberId, startDate, today],
    queryFn: async () => {
      const freezes = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("member_freezes")
          .select("status, actual_start_date, actual_end_date, requested_start_date, requested_end_date")
          .eq("member_id", memberId).order("id").range(offset, offset + 499);
        if (error) throw error;
        freezes.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }
      return membershipCommitment(startDate, freezes, today);
    },
    refetchInterval: 60_000,
  });
  return <div className="flex items-start gap-2">
    <CalendarClock className="h-4 w-4 mt-1 text-muted-foreground" />
    <div>
      <p className="text-sm text-muted-foreground">Commitment through{data?.provisional ? " · provisional" : ""}</p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? <p className="text-sm text-destructive">Unable to load commitment</p> : data ? <>
        <p>{format(parseISO(data.adjustedEndISO), "MMM d, yyyy")}</p>
        <p className="text-sm text-muted-foreground">{data.daysRemaining ? `${data.monthsRemaining} months, ${data.extraDays} days remaining` : "Initial commitment completed"}</p>
        {data.frozenDays > 0 && <p className="text-sm text-muted-foreground">Extended by {data.frozenDays} frozen days{data.provisional ? " to date" : ""}</p>}
      </> : <p>—</p>}
    </div>
  </div>;
}