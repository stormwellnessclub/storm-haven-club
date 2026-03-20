import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, CheckCircle, Dumbbell, XCircle, UserCheck, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

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
  } | null;
  instructors: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

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
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-class-sessions-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('class_sessions')
        .select(`
          *,
          class_types!inner (id, name, category),
          instructors (id, first_name, last_name)
        `)
        .eq('session_date', today)
        .eq('class_types.is_active', true)
        .order('start_time');
      
      if (error) throw error;
      return data as ClassSession[];
    },
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['session-bookings', selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return [];
      const { data, error } = await supabase
        .from('class_bookings')
        .select(`
          id, user_id, member_id, status, checked_in_at,
          members (id, first_name, last_name, photo_url)
        `)
        .eq('session_id', selectedSession.id)
        .in('status', ['confirmed', 'completed']);
      
      if (error) throw error;
      return data as ClassBooking[];
    },
    enabled: !!selectedSession?.id && rosterDialogOpen,
  });

  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('class_bookings')
        .update({ status: 'completed' as const, checked_in_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-bookings', selectedSession?.id] });
      toast.success("Member checked in");
    },
    onError: () => toast.error("Failed to check in member"),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSession) return;
      const { error } = await supabase.rpc('admin_cancel_class_session', {
        _session_id: selectedSession.id,
        _reason: cancellationReason || 'Class cancelled by admin',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-today'] });
      setCancelDialogOpen(false);
      setCancellationReason("");
      setSelectedSession(null);
      toast.success("Class cancelled");
    },
    onError: () => toast.error("Failed to cancel class"),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Today's Classes</h1>
            <p className="text-muted-foreground">
              View today's classes and manage attendance
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(), 'EEEE, MMMM d')}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-semibold">No Classes Today</p>
            <p className="text-sm mt-2">There are no active classes scheduled for today.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const status = getSessionStatus(session);
              return (
                <Card key={session.id} className={session.is_cancelled ? "opacity-60" : ""}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{session.class_types?.name}</span>
                          <Badge className={getStatusColor(status)}>{getStatusLabel(status)}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(session.start_time)} – {formatTime(session.end_time)}
                          </span>
                          {session.instructors && (
                            <span>{session.instructors.first_name} {session.instructors.last_name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {session.current_enrollment}/{session.max_capacity}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!session.is_cancelled && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedSession(session); setRosterDialogOpen(true); }}
                        >
                          <Eye className="h-4 w-4 mr-1" /> Roster
                        </Button>
                        {status === 'upcoming' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => { setSelectedSession(session); setCancelDialogOpen(true); }}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Roster/Attendance Dialog */}
      <Dialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSession?.class_types?.name} - {selectedSession && format(parseISO(selectedSession.session_date), 'MMM d')} at {selectedSession && formatTime(selectedSession.start_time)}
            </DialogTitle>
            <DialogDescription>
              {bookings.length} members registered
            </DialogDescription>
          </DialogHeader>
          
          {bookingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
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
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
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
                      {booking.status === 'completed' || booking.checked_in_at ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" /> Checked In
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Registered</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {booking.status === 'confirmed' && !booking.checked_in_at && (
                        <Button size="sm" variant="outline" onClick={() => checkInMutation.mutate(booking.id)} disabled={checkInMutation.isPending}>
                          <UserCheck className="h-4 w-4 mr-1" /> Check In
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Class Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {selectedSession?.class_types?.name} at {selectedSession && formatTime(selectedSession.start_time)}? Members who have booked will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Cancellation Reason (optional)</Label>
            <Input id="reason" value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} placeholder="e.g., Instructor unavailable" className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancellationReason(""); setSelectedSession(null); }}>Keep Class</AlertDialogCancel>
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
