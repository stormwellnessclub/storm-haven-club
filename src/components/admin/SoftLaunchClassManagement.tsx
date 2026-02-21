import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, addDays, subDays, isBefore, isAfter } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar, Clock, Users, CheckCircle, Dumbbell, XCircle,
  UserCheck, Eye, Loader2, ChevronLeft, ChevronRight, UserPlus, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TempClassSchedule } from "@/components/booking/TempClassSchedule";
import {
  SOFT_LAUNCH_START, SOFT_LAUNCH_END,
  getClassesForDate, parseTimeToDb,
  type ClassEntry,
} from "@/lib/softLaunchSchedule";

interface ClassBooking {
  id: string;
  user_id: string;
  member_id: string | null;
  status: string;
  checked_in_at: string | null;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
}

interface MemberSearchResult {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  member_id: string;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

// Represents a scheduled class slot from the hardcoded timetable, enriched with DB data
interface ScheduleSlot {
  entry: ClassEntry;
  dateStr: string;
  dbSessionId: string | null;
  enrolled: number;
  maxCapacity: number;
  isCancelled: boolean;
}

export function SoftLaunchClassManagement() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    if (isBefore(today, SOFT_LAUNCH_START)) return SOFT_LAUNCH_START;
    if (isAfter(today, SOFT_LAUNCH_END)) return SOFT_LAUNCH_END;
    return today;
  });
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [refScheduleOpen, setRefScheduleOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const canGoPrev = !isBefore(subDays(selectedDate, 1), SOFT_LAUNCH_START);
  const canGoNext = !isAfter(addDays(selectedDate, 1), SOFT_LAUNCH_END);

  // Get the hardcoded classes for the selected date (source of truth)
  const hardcodedClasses = getClassesForDate(selectedDate);

  // Fetch DB sessions for overlay (enrollment data)
  const { data: dbSessions = [], isLoading } = useQuery({
    queryKey: ['soft-launch-sessions', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select(`id, start_time, current_enrollment, max_capacity, is_cancelled, cancellation_reason, class_types!inner(name)`)
        .eq('session_date', dateStr)
        .eq('is_cancelled', false)
        .in('class_types.name', ['Signature Flow', 'Reformer Flow', 'Reformer Sculpt']);
      if (error) throw error;
      return data || [];
    },
  });

  // Merge hardcoded schedule with DB data
  const slots: ScheduleSlot[] = hardcodedClasses.map((entry) => {
    const dbTime = parseTimeToDb(entry.time);
    const match = dbSessions.find((s: any) => {
      const typeName = Array.isArray(s.class_types) ? s.class_types[0]?.name : s.class_types?.name;
      return s.start_time === dbTime && typeName === entry.name;
    });
    return {
      entry,
      dateStr,
      dbSessionId: match?.id || null,
      enrolled: match?.current_enrollment || 0,
      maxCapacity: match?.max_capacity || 8,
      isCancelled: match?.is_cancelled || false,
    };
  });

  // Fetch bookings for selected slot's DB session
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['soft-launch-bookings', selectedSlot?.dbSessionId],
    queryFn: async () => {
      if (!selectedSlot?.dbSessionId) return [];
      const { data, error } = await supabase
        .from('class_bookings')
        .select(`id, user_id, member_id, status, checked_in_at, members (id, first_name, last_name, photo_url)`)
        .eq('session_id', selectedSlot.dbSessionId)
        .in('status', ['confirmed', 'completed']);
      if (error) throw error;
      return data as ClassBooking[];
    },
    enabled: !!selectedSlot?.dbSessionId && rosterDialogOpen,
  });

  // Search members for add-member feature
  const { data: memberResults = [] } = useQuery({
    queryKey: ['member-search', addMemberSearch],
    queryFn: async () => {
      if (addMemberSearch.length < 2) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, user_id, first_name, last_name, email, member_id')
        .or(`first_name.ilike.%${addMemberSearch}%,last_name.ilike.%${addMemberSearch}%,email.ilike.%${addMemberSearch}%,member_id.ilike.%${addMemberSearch}%`)
        .eq('status', 'active')
        .limit(10);
      if (error) throw error;
      return data as MemberSearchResult[];
    },
    enabled: addMemberSearch.length >= 2 && showAddMember,
  });

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('class_bookings')
        .update({ status: 'completed' as const, checked_in_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-bookings', selectedSlot?.dbSessionId] });
      toast.success("Member checked in");
    },
    onError: () => toast.error("Failed to check in member"),
  });

  // Remove booking mutation
  const removeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('class_bookings')
        .update({ status: 'cancelled' as const, cancelled_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
      if (selectedSlot?.dbSessionId) {
        await supabase
          .from('class_sessions')
          .update({ current_enrollment: Math.max(0, selectedSlot.enrolled - 1) })
          .eq('id', selectedSlot.dbSessionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-bookings', selectedSlot?.dbSessionId] });
      queryClient.invalidateQueries({ queryKey: ['soft-launch-sessions', dateStr] });
      toast.success("Member removed from class");
    },
    onError: () => toast.error("Failed to remove member"),
  });

  // Add member mutation (uses find_or_create_temp_class_session to ensure session exists)
  const addMemberMutation = useMutation({
    mutationFn: async (member: MemberSearchResult) => {
      if (!selectedSlot || !member.user_id) throw new Error("Missing data");

      const dbTime = parseTimeToDb(selectedSlot.entry.time);
      const endTime = (() => {
        const [h, m] = dbTime.split(':').map(Number);
        const totalMin = h * 60 + m + 50;
        return `${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}:00`;
      })();

      // Ensure session exists
      const { data: sessionId, error: sessionError } = await (supabase.rpc as any)(
        "find_or_create_temp_class_session",
        {
          p_class_name: selectedSlot.entry.name,
          p_session_date: selectedSlot.dateStr,
          p_start_time: dbTime,
          p_end_time: endTime,
          p_max_capacity: 8,
          p_room: "Reformer Studio",
        }
      );
      if (sessionError) throw sessionError;
      if (!sessionId) throw new Error("Failed to create session");

      // Check for existing booking
      const { data: existing } = await supabase
        .from('class_bookings')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', member.user_id)
        .eq('status', 'confirmed')
        .maybeSingle();
      if (existing) throw new Error("Member already booked");

      const { error } = await supabase.from('class_bookings').insert({
        session_id: sessionId,
        user_id: member.user_id,
        member_id: member.id,
        status: 'confirmed',
        payment_method: 'admin_add',
        booked_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-bookings', selectedSlot?.dbSessionId] });
      queryClient.invalidateQueries({ queryKey: ['soft-launch-sessions', dateStr] });
      setAddMemberSearch("");
      setShowAddMember(false);
      toast.success("Member added to class");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add member"),
  });

  // Cancel session mutation
  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot?.dbSessionId) return;
      const { error } = await supabase
        .from('class_sessions')
        .update({ is_cancelled: true, cancellation_reason: cancellationReason || null })
        .eq('id', selectedSlot.dbSessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-sessions', dateStr] });
      setCancelDialogOpen(false);
      setCancellationReason("");
      setSelectedSlot(null);
      toast.success("Class cancelled");
    },
    onError: () => toast.error("Failed to cancel class"),
  });

  return (
    <div className="space-y-6">
      {/* Date Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" disabled={!canGoPrev} onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </div>
        <Button variant="outline" size="icon" disabled={!canGoNext} onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slots from hardcoded schedule */}
      {slots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No soft-launch classes on this date</p>
          <p className="text-sm mt-1">The soft-launch schedule runs Feb 20 – Mar 18, 2026.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot, idx) => (
            <Card
              key={`${slot.dateStr}-${slot.entry.time}-${slot.entry.name}`}
              className={`transition-colors hover:border-primary/50 ${slot.isCancelled ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{slot.entry.name}</CardTitle>
                    <CardDescription>Duha · Reformer Studio</CardDescription>
                  </div>
                  <Badge variant="secondary">{slot.entry.time}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    50 min
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {slot.enrolled}/{slot.maxCapacity} enrolled
                </div>
                {!slot.isCancelled && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() => { setSelectedSlot(slot); setRosterDialogOpen(true); }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {slot.enrolled > 0 ? 'View Roster' : 'Manage'}
                    </Button>
                    {slot.dbSessionId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setSelectedSlot(slot); setCancelDialogOpen(true); }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reference Schedule */}
      <Collapsible open={refScheduleOpen} onOpenChange={setRefScheduleOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground">
            Reference: Planned Timetable
            <ChevronRight className={`h-4 w-4 transition-transform ${refScheduleOpen ? 'rotate-90' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TempClassSchedule readOnly />
        </CollapsibleContent>
      </Collapsible>

      {/* Roster Dialog */}
      <Dialog open={rosterDialogOpen} onOpenChange={(open) => { setRosterDialogOpen(open); if (!open) { setShowAddMember(false); setAddMemberSearch(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSlot?.entry.name} — {format(selectedDate, 'MMM d')} at {selectedSlot?.entry.time}
            </DialogTitle>
            <DialogDescription>
              {selectedSlot?.dbSessionId ? `${bookings.length} members registered` : 'No bookings yet'}
            </DialogDescription>
          </DialogHeader>

          {/* Add Member */}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
              <UserPlus className="h-4 w-4 mr-1" /> Add Member
            </Button>
          </div>
          {showAddMember && (
            <div className="space-y-2 border rounded-sm p-3">
              <Label>Search member by name, email, or ID</Label>
              <Input
                value={addMemberSearch}
                onChange={(e) => setAddMemberSearch(e.target.value)}
                placeholder="e.g. Jane Smith or STM-000001"
              />
              {memberResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {memberResults.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted text-sm">
                      <span>{m.first_name} {m.last_name} <span className="text-muted-foreground">({m.member_id})</span></span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={addMemberMutation.isPending || !m.user_id}
                        onClick={() => addMemberMutation.mutate(m)}
                      >
                        {!m.user_id ? 'No account' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {bookingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !selectedSlot?.dbSessionId || bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No members registered for this class</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const isCheckedIn = booking.status === 'completed' || !!booking.checked_in_at;
                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {booking.members?.first_name?.[0]}{booking.members?.last_name?.[0]}
                          </div>
                          <span>{booking.members?.first_name} {booking.members?.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isCheckedIn ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" /> Checked In
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Registered</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!isCheckedIn && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => checkInMutation.mutate(booking.id)}
                              disabled={checkInMutation.isPending}
                            >
                              <UserCheck className="h-4 w-4 mr-1" /> Check In
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeMutation.mutate(booking.id)}
                              disabled={removeMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {selectedSlot?.entry.name} at {selectedSlot?.entry.time}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="sl-reason">Cancellation Reason (optional)</Label>
            <Input
              id="sl-reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g., Instructor unavailable"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancellationReason(""); setSelectedSlot(null); }}>
              Keep Class
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelSessionMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelSessionMutation.isPending}
            >
              {cancelSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
