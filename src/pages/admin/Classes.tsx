import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, CheckCircle, Dumbbell, XCircle, UserCheck, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, isAfter, isBefore, addMinutes } from "date-fns";
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
import { SoftLaunchClassManagement } from "@/components/admin/SoftLaunchClassManagement";

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
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'soft-launch';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const queryClient = useQueryClient();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  // Fetch today's class sessions with real data
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-class-sessions-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('class_sessions')
        .select(`
          *,
          class_types (id, name, category),
          instructors (id, first_name, last_name)
        `)
        .eq('session_date', today)
        .order('start_time');
      
      if (error) throw error;
      return data as ClassSession[];
    },
  });

  // Fetch bookings for the selected session roster
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['session-bookings', selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return [];
      const { data, error } = await supabase
        .from('class_bookings')
        .select(`
          id,
          user_id,
          member_id,
          status,
          checked_in_at,
          members (id, first_name, last_name, photo_url)
        `)
        .eq('session_id', selectedSession.id)
        .in('status', ['confirmed', 'completed']); // 'completed' = checked in
      
      if (error) throw error;
      return data as ClassBooking[];
    },
    enabled: !!selectedSession?.id && rosterDialogOpen,
  });

  // Check in a member for a class
  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      // Update to 'completed' status with check-in timestamp
      const { error } = await supabase
        .from('class_bookings')
        .update({ 
          status: 'completed' as const,
          checked_in_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-bookings', selectedSession?.id] });
      toast.success("Member checked in");
    },
    onError: (error) => {
      console.error('Check-in error:', error);
      toast.error("Failed to check in member");
    },
  });

  // Cancel a class session
  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSession) return;
      const { error } = await supabase
        .from('class_sessions')
        .update({ 
          is_cancelled: true,
          cancellation_reason: cancellationReason || null
        })
        .eq('id', selectedSession.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-today'] });
      setCancelDialogOpen(false);
      setCancellationReason("");
      setSelectedSession(null);
      toast.success("Class cancelled");
    },
    onError: (error) => {
      console.error('Cancel error:', error);
      toast.error("Failed to cancel class");
    },
  });

  const attendedCount = (sessionId: string) => {
    // This would need a separate query or be included in the main query
    return 0; // Placeholder - will show from bookings when roster is loaded
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Schedule</h1>
            <p className="text-muted-foreground">
              View today's classes and manage attendance
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(), 'EEEE, MMMM d')}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="soft-launch">Soft Launch Schedule</TabsTrigger>
            <TabsTrigger value="full-schedule">Full Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="soft-launch">
            <SoftLaunchClassManagement />
          </TabsContent>

          <TabsContent value="full-schedule">
            <div className="text-center py-12 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-semibold">Coming Soon</p>
              <p className="text-sm mt-2">
                The full class schedule will be available after the soft launch period ends on March 18, 2026.
              </p>
            </div>
          </TabsContent>
        </Tabs>
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
                        <span>
                          {booking.members?.first_name} {booking.members?.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {booking.status === 'completed' || booking.checked_in_at ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Registered</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {booking.status === 'confirmed' && !booking.checked_in_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkInMutation.mutate(booking.id)}
                          disabled={checkInMutation.isPending}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Check In
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
              Are you sure you want to cancel {selectedSession?.class_types?.name} at {selectedSession && formatTime(selectedSession.start_time)}? 
              Members who have booked will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Cancellation Reason (optional)</Label>
            <Input
              id="reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g., Instructor unavailable"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setCancellationReason("");
              setSelectedSession(null);
            }}>
              Keep Class
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelSessionMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelSessionMutation.isPending}
            >
              {cancelSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Cancel Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
