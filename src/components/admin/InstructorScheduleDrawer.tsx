import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, User, Calendar as CalendarIcon, MapPin, Users } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

interface Props {
  instructorId: string | null;
  onClose: () => void;
  onAddClassWithInstructor: (instructorId: string) => void;
  onOpenSession?: (sessionId: string) => void;
}

export function InstructorScheduleDrawer({
  instructorId,
  onClose,
  onAddClassWithInstructor,
  onOpenSession,
}: Props) {
  const open = !!instructorId;

  const { data: instructor } = useQuery({
    queryKey: ["instructor-drawer", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      // Email is staff-only; served through the SECURITY DEFINER staff RPC.
      const { data, error } = await (supabase as any).rpc("get_instructors_with_contact");
      if (error) throw error;
      return ((data ?? []) as any[]).find((i) => i.id === instructorId) ?? null;
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["instructor-drawer-schedules", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_schedules")
        .select("id, day_of_week, start_time, end_time, room, is_active, is_one_time, effective_from, effective_until, class_types(name, category)")
        .eq("instructor_id", instructorId!)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const rangeStart = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const rangeEnd = useMemo(() => format(addDays(new Date(), 28), "yyyy-MM-dd"), []);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["instructor-drawer-sessions", instructorId, rangeStart, rangeEnd],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, room, current_enrollment, max_capacity, is_cancelled, is_hidden, class_types(name)")
        .eq("instructor_id", instructorId!)
        .gte("session_date", rangeStart)
        .lte("session_date", rangeEnd)
        .order("session_date")
        .order("start_time");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const activeSessions = sessions.filter((s) => !s.is_hidden);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {instructor ? `${instructor.first_name} ${instructor.last_name}` : "Instructor"}
            {instructor?.is_master && (
              <Badge className="bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/50">
                Master
              </Badge>
            )}
            {instructor && !instructor.is_active && <Badge variant="secondary">Inactive</Badge>}
          </SheetTitle>
          <SheetDescription>
            {instructor?.email || "Their upcoming classes and recurring schedule."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => instructorId && onAddClassWithInstructor(instructorId)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add class with this instructor
            </Button>
          </div>

          {/* Recurring schedule */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <CalendarIcon className="h-4 w-4" />
              Recurring schedule
              <Badge variant="secondary">{schedules.length}</Badge>
            </h3>
            {schedules.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recurring or dated schedules assigned.</p>
            ) : (
              <ul className="border rounded-md divide-y">
                {schedules.map((s) => (
                  <li key={s.id} className="p-2 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {DAY_LABELS[s.day_of_week]} · {formatTime12h(s.start_time)}–{formatTime12h(s.end_time)}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {s.class_types?.name || "—"}
                        {s.room ? ` · ${s.room}` : ""}
                        {s.is_one_time && s.effective_from ? ` · One-off ${s.effective_from}` : ""}
                        {!s.is_one_time && s.effective_until ? ` · thru ${s.effective_until}` : ""}
                      </div>
                    </div>
                    {!s.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming sessions */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Users className="h-4 w-4" />
              Upcoming classes (next 4 weeks)
              <Badge variant="secondary">{activeSessions.length}</Badge>
            </h3>
            {sessionsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : activeSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No classes booked in the next 4 weeks.</p>
            ) : (
              <ScrollArea className="max-h-[45vh] pr-2">
                <ul className="space-y-1">
                  {activeSessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={
                          "w-full text-left border rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 " +
                          (s.is_cancelled ? "opacity-60 line-through" : "")
                        }
                        onClick={() => onOpenSession && onOpenSession(s.id)}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {format(new Date(`${s.session_date}T00:00:00`), "EEE, MMM d")} · {formatTime12h(s.start_time)}
                          </div>
                          <div className="text-muted-foreground truncate flex items-center gap-1">
                            {s.class_types?.name || "—"}
                            {s.room ? (
                              <>
                                <MapPin className="h-3 w-3 ml-1" />
                                {s.room}
                              </>
                            ) : null}
                          </div>
                        </div>
                        <Badge variant={s.current_enrollment >= (s.max_capacity || 0) ? "default" : "secondary"} className="shrink-0">
                          {s.current_enrollment}/{s.max_capacity ?? "—"}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
