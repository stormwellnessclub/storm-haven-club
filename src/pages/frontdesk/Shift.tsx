import { useEffect, useMemo, useState } from "react";
import { FrontDeskShell, useActiveFrontDeskShift } from "./FrontDeskShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Clock } from "lucide-react";
import { format, formatDistanceStrict, startOfWeek, endOfWeek } from "date-fns";

interface ShiftRow {
  id: string;
  staff_user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  device_label: string | null;
  auto_closed: boolean;
  notes: string | null;
}

export default function FrontDeskShiftPage() {
  const shift = useActiveFrontDeskShift();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shift?.staffUserId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("staff_shift_clocks")
        .select("id, staff_user_id, clock_in_at, clock_out_at, device_label, auto_closed, notes")
        .eq("staff_user_id", shift.staffUserId)
        .order("clock_in_at", { ascending: false })
        .limit(30);
      if (error) {
        console.error("[Shift] load", error);
      } else {
        setShifts((data as ShiftRow[]) || []);
      }
      setLoading(false);
    };
    void load();
  }, [shift?.staffUserId]);

  const weekTotalMinutes = useMemo(() => {
    if (!shifts.length) return 0;
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return shifts.reduce((sum, s) => {
      const inAt = new Date(s.clock_in_at);
      if (inAt < start || inAt > end) return sum;
      const outAt = s.clock_out_at ? new Date(s.clock_out_at) : new Date();
      const mins = Math.max(0, Math.floor((outAt.getTime() - inAt.getTime()) / 60000));
      return sum + mins;
    }, 0);
  }, [shifts]);

  const weekHours = Math.floor(weekTotalMinutes / 60);
  const weekMins = weekTotalMinutes % 60;

  return (
    <FrontDeskShell>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Timesheet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shift && (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 p-3 flex flex-wrap items-center gap-3">
                <Badge className="bg-green-600 hover:bg-green-600">On the clock</Badge>
                <span className="text-sm">
                  Since <strong>{format(new Date(shift.clockInAt), "h:mm a")}</strong>
                  {" · "}
                  {formatDistanceStrict(new Date(shift.clockInAt), new Date())}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">This week</div>
                <div className="text-2xl font-semibold">
                  {weekHours}h {weekMins}m
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Recent shifts</div>
                <div className="text-2xl font-semibold">{shifts.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No shift history yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((s) => {
                      const inAt = new Date(s.clock_in_at);
                      const outAt = s.clock_out_at ? new Date(s.clock_out_at) : null;
                      const dur = outAt
                        ? formatDistanceStrict(inAt, outAt)
                        : formatDistanceStrict(inAt, new Date()) + " (open)";
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{format(inAt, "EEE, MMM d")}</TableCell>
                          <TableCell>{format(inAt, "h:mm a")}</TableCell>
                          <TableCell>{outAt ? format(outAt, "h:mm a") : "—"}</TableCell>
                          <TableCell>{dur}</TableCell>
                          <TableCell>
                            {s.auto_closed && (
                              <Badge variant="outline" className="text-amber-700 border-amber-300">
                                Auto-closed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FrontDeskShell>
  );
}
