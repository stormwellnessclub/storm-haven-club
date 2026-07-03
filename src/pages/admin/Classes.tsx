import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CalendarDays, Clock, Users, CheckCircle, Dumbbell, XCircle, UserPlus, List, ChevronLeft, ChevronRight, Loader2, ExternalLink, EyeOff } from "lucide-react";
import { AdminSessionsCalendar } from "@/components/admin/AdminSessionsCalendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { resolveAttendeePreviewsForSessions } from "@/hooks/useRosterIdentity";
import { toast } from "sonner";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface ClassSession {
  id: string;
  class_type_id: string;
  instructor_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_enrollment: number;
  is_cancelled: boolean;
  room: string | null;
  cancellation_reason: string | null;
  class_types: {
    id: string;
    name: string;
    category: string;
    is_active: boolean;
  } | null;
  instructors: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface AttendeePreview {
  name: string;
  phone: string;
}

function getSessionStatus(session: ClassSession): 'upcoming' | 'in-progress' | 'completed' | 'cancelled' {
  if (session.is_cancelled) return 'cancelled';
  const now = new Date();
  const sessionDate = parseISO(session.session_date);
  const [startHour, startMin] = session.start_time.split(':').map(Number);
  const [endHour, endMin] = session.end_time.split(':').map(Number);
  const startTime = new Date(sessionDate);
  startTime.setHours(startHour, startMin, 0, 0);
  const endTime = new Date(sessionDate);
  endTime.setHours(endHour, endMin, 0, 0);
  if (isBefore(now, startTime)) return 'upcoming';
  if (isAfter(now, endTime)) return 'completed';
  return 'in-progress';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-muted text-muted-foreground';
    case 'in-progress': return 'bg-green-500';
    case 'upcoming': return 'bg-blue-500';
    case 'cancelled': return 'bg-destructive';
    default: return 'bg-muted';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'in-progress': return 'In Progress';
    case 'upcoming': return 'Upcoming';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

export default function Classes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [hideFromMembers, setHideFromMembers] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = selectedDateStr === format(new Date(), 'yyyy-MM-dd');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-class-sessions-day', selectedDateStr, showInactive],
    queryFn: async () => {
      let query = supabase
        .from('class_sessions')
        .select(`
          *,
          class_types!inner (id, name, category, is_active),
          instructors (id, first_name, last_name)
        `)
        .eq('session_date', selectedDateStr)
        .order('start_time');
      if (!showInactive) {
        query = query.eq('is_hidden', false).eq('is_cancelled', false);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ClassSession[];
    },
  });

  // Filter out sessions from inactive class types unless toggle is on
  const filteredSessions = showInactive
    ? sessions
    : sessions.filter(s => s.class_types?.is_active !== false);

  // Fetch attendee previews for all sessions on this day
  const sessionIds = filteredSessions.map(s => s.id);
  const { data: attendeePreviews = {} } = useQuery({
    queryKey: ['admin-session-attendees-preview', selectedDateStr, sessionIds.join(',')],
    queryFn: async (): Promise<Record<string, AttendeePreview[]>> => {
      return resolveAttendeePreviewsForSessions(sessionIds);
    },
    enabled: sessionIds.length > 0,
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSession) return;
      const { error } = await supabase.rpc('admin_cancel_class_session', {
        _session_id: selectedSession.id,
        _cancellation_reason: cancellationReason || 'Class cancelled by admin',
        _is_hidden: hideFromMembers,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-day'] });
      
      // Send cancellation emails to all booked members
      if (selectedSession) {
        try {
          // Only notify people whose booking was cancelled by THIS admin action.
          // Without this filter, anyone who self-cancelled earlier would also get
          // a misleading "Class Cancelled by Admin" email. The admin_cancel_class_session
          // RPC stamps exactly this reason on every booking it touches.
          const { data: bookings } = await supabase
            .from('class_bookings')
            .select('id, member_id, user_id, walk_in_email, walk_in_name, members(first_name, last_name, email)')
            .eq('session_id', selectedSession.id)
            .eq('status', 'cancelled')
            .eq('cancellation_reason', 'Class cancelled by admin');
          
          if (bookings && bookings.length > 0) {
            const sessionDate = format(parseISO(selectedSession.session_date), 'MMMM d, yyyy');
            const sessionTime = formatTime(selectedSession.start_time);

            // Build a userId -> {email, name} map for bookings without a linked member.
            // Some attendees book via their auth account (user_id) without a members row,
            // so we must fall back through non_member_profiles and profiles to find them.
            const unresolvedUserIds = Array.from(new Set(
              bookings
                .filter(b => {
                  const m = b.members as any;
                  return !(m?.email) && !b.walk_in_email && b.user_id;
                })
                .map(b => b.user_id as string)
            ));

            const userIdContact: Record<string, { email?: string; name?: string }> = {};
            if (unresolvedUserIds.length > 0) {
              const [nmpRes, profRes] = await Promise.all([
                supabase
                  .from('non_member_profiles')
                  .select('user_id, email, first_name, last_name')
                  .in('user_id', unresolvedUserIds),
                supabase
                  .from('profiles')
                  .select('user_id, email, first_name, last_name')
                  .in('user_id', unresolvedUserIds),
              ]);
              for (const p of profRes.data || []) {
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || undefined;
                if (p.email && p.user_id) userIdContact[p.user_id] = { email: p.email, name };
              }
              for (const nmp of nmpRes.data || []) {
                const name = [nmp.first_name, nmp.last_name].filter(Boolean).join(' ').trim() || undefined;
                if (nmp.email) userIdContact[nmp.user_id] = { email: nmp.email, name };
              }
            }

            for (const booking of bookings) {
              const member = booking.members as any;
              const userContact = booking.user_id ? userIdContact[booking.user_id] : undefined;
              const email = member?.email || userContact?.email || booking.walk_in_email;
              const name = member
                ? `${member.first_name} ${member.last_name}`
                : (userContact?.name || booking.walk_in_name);

              if (email) {
                supabase.functions.invoke('send-email', {
                  body: {
                    type: 'class_cancelled_by_admin',
                    to: email,
                    data: {
                      name: name || 'Member',
                      className: selectedSession.class_types?.name || 'Class',
                      date: sessionDate,
                      time: sessionTime,
                    },
                  },
                }).catch(err => console.error('Failed to send cancellation email:', err));
              } else {
                console.warn('[class-cancel] Could not resolve email for booking', booking.id, {
                  member_id: booking.member_id,
                  user_id: booking.user_id,
                });
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch bookings for cancellation emails:', err);
        }
      }
      
      setCancelDialogOpen(false);
      setCancellationReason("");
      setHideFromMembers(true);
      setSelectedSession(null);
      toast.success("Class cancelled");
    },
    onError: () => toast.error("Failed to cancel class"),
  });

  const openRoster = (sessionId: string) => {
    navigate(`/admin/class-roster/${sessionId}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Classes</h1>
            <p className="text-muted-foreground">Manage classes and attendance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive-sessions"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive-sessions" className="text-sm text-muted-foreground cursor-pointer">
                Show all
              </Label>
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
              <TabsList>
                <TabsTrigger value="list" className="gap-1.5">
                  <List className="h-3.5 w-3.5" /> Day View
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Week Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {view === "calendar" ? (
          <AdminSessionsCalendar
            onSelectSession={(session) => openRoster(session.id)}
          />
        ) : (
        <>
        {/* Date navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())} disabled={isToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-semibold">No Classes</p>
            <p className="text-sm mt-2">There are no active classes scheduled for {format(selectedDate, 'MMMM d, yyyy')}.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSessions.map((session) => {
              const status = getSessionStatus(session);
              const attendees = attendeePreviews[session.id] || [];
              const isFull = session.current_enrollment >= session.max_capacity;
              return (
                <Card
                  key={session.id}
                  className={cn(
                    "hover:shadow-md transition-shadow cursor-pointer",
                    session.is_cancelled && "opacity-60",
                    (session as any).is_hidden && "opacity-50"
                  )}
                  onClick={() => openRoster(session.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("font-semibold text-lg", session.is_cancelled && "line-through")}>{session.class_types?.name}</span>
                          <Badge className={getStatusColor(status)}>{getStatusLabel(status)}</Badge>
                          {(session as any).is_hidden && (
                            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                              <EyeOff className="h-3 w-3" /> Hidden
                            </Badge>
                          )}
                          {(session as any).is_invite_only && (
                            <Badge className="text-xs bg-purple-600 hover:bg-purple-700">Invite Only</Badge>
                          )}
                          {isFull && <Badge variant="destructive" className="text-xs">Full</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(session.start_time)} – {formatTime(session.end_time)}
                          </span>
                          {session.instructors && (
                            <span>{session.instructors.first_name} {session.instructors.last_name}</span>
                          )}
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="h-3.5 w-3.5" />
                            <span className={cn(isFull && "text-destructive")}>{session.current_enrollment}/{session.max_capacity}</span>
                          </span>
                          {session.room && <span>📍 {session.room}</span>}
                        </div>

                        {/* Attendee preview */}
                        {attendees.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">Booked:</span>
                            {attendees.slice(0, 4).map((a, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {a.name}
                              </Badge>
                            ))}
                            {attendees.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{attendees.length - 4} more</span>
                            )}
                          </div>
                        )}
                        {session.current_enrollment > 0 && attendees.length === 0 && (
                          <div className="mt-2 text-xs text-muted-foreground italic">
                            {session.current_enrollment} booked — loading names…
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!session.is_cancelled && (
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openRoster(session.id); }}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> Manage Roster
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); openRoster(session.id); }}
                          >
                            <UserPlus className="h-4 w-4 mr-1" /> Add Person
                          </Button>
                          {(status === 'upcoming' || status === 'in-progress' || status === 'completed') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); setSelectedSession(session); setCancelDialogOpen(true); }}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>

      {/* Cancel Class Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {selectedSession?.class_types?.name} at {selectedSession && formatTime(selectedSession.start_time)}? Members who have booked will be notified.
              {selectedSession && getSessionStatus(selectedSession) !== 'upcoming' && (
                <span className="mt-2 block font-medium text-destructive">
                  This class has already {getSessionStatus(selectedSession) === 'in-progress' ? 'started' : 'ended'}. Attendees who were checked in will also be refunded (credits/passes restored) and notified.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">Cancellation Reason (optional)</Label>
              <Input id="reason" value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} placeholder="e.g., Instructor unavailable" className="mt-2" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Hide from members & website</p>
                <p className="text-xs text-muted-foreground">When off, the class shows as "Cancelled" on the schedule</p>
              </div>
              <Switch checked={hideFromMembers} onCheckedChange={setHideFromMembers} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancellationReason(""); setHideFromMembers(true); setSelectedSession(null); }}>Keep Class</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelSessionMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={cancelSessionMutation.isPending}>
              {cancelSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
