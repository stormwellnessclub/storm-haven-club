import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Users, CheckCircle, Loader2, UserPlus, Trash2, UserCheck, DollarSign,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseTimeToDb } from "@/lib/softLaunchSchedule";
import type { ClassEntry } from "@/lib/softLaunchSchedule";

interface ScheduleSlot {
  entry: ClassEntry;
  dateStr: string;
  dbSessionId: string | null;
  enrolled: number;
  maxCapacity: number;
  isCancelled: boolean;
}

interface ClassBooking {
  id: string;
  user_id: string;
  member_id: string | null;
  status: string;
  checked_in_at: string | null;
  walk_in_name: string | null;
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

interface ClassRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot: ScheduleSlot | null;
  selectedDate: Date;
  dateStr: string;
}

export function ClassRosterDialog({
  open,
  onOpenChange,
  selectedSlot,
  selectedDate,
  dateStr,
}: ClassRosterDialogProps) {
  const queryClient = useQueryClient();
  const [addTab, setAddTab] = useState<"member" | "walkin">("member");
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Walk-in form state
  const [walkInFirst, setWalkInFirst] = useState("");
  const [walkInLast, setWalkInLast] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [chargeDropIn, setChargeDropIn] = useState(false);

  const resetForm = () => {
    setAddMemberSearch("");
    setShowAddPanel(false);
    setAddTab("member");
    setWalkInFirst("");
    setWalkInLast("");
    setWalkInEmail("");
    setWalkInPhone("");
    setChargeDropIn(false);
  };

  // Fetch bookings for selected slot
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId],
    queryFn: async () => {
      if (!selectedSlot?.dbSessionId) return [];
      const { data, error } = await supabase
        .from("class_bookings")
        .select(
          "id, user_id, member_id, status, checked_in_at, walk_in_name, members (id, first_name, last_name, photo_url)"
        )
        .eq("session_id", selectedSlot.dbSessionId)
        .in("status", ["confirmed", "completed"]);
      if (error) throw error;
      return data as ClassBooking[];
    },
    enabled: !!selectedSlot?.dbSessionId && open,
  });

  // Search members
  const { data: memberResults = [] } = useQuery({
    queryKey: ["member-search", addMemberSearch],
    queryFn: async () => {
      if (addMemberSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, user_id, first_name, last_name, email, member_id")
        .or(
          `first_name.ilike.%${addMemberSearch}%,last_name.ilike.%${addMemberSearch}%,email.ilike.%${addMemberSearch}%,member_id.ilike.%${addMemberSearch}%`
        )
        .eq("status", "active")
        .limit(10);
      if (error) throw error;
      return data as MemberSearchResult[];
    },
    enabled: addMemberSearch.length >= 2 && showAddPanel && addTab === "member",
  });

  // Helper to ensure session exists
  const ensureSession = async () => {
    if (!selectedSlot) throw new Error("No slot selected");
    const dbTime = parseTimeToDb(selectedSlot.entry.time);
    const [h, m] = dbTime.split(":").map(Number);
    const totalMin = h * 60 + m + 50;
    const endTime = `${Math.floor(totalMin / 60).toString().padStart(2, "0")}:${(totalMin % 60).toString().padStart(2, "0")}:00`;

    const { data: sessionId, error } = await (supabase.rpc as any)(
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
    if (error) throw error;
    if (!sessionId) throw new Error("Failed to create session");
    return sessionId;
  };

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "completed" as const, checked_in_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId] });
      toast.success("Member checked in");
    },
    onError: () => toast.error("Failed to check in"),
  });

  // Remove booking mutation
  const removeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "cancelled" as const, cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
      if (selectedSlot?.dbSessionId) {
        await supabase
          .from("class_sessions")
          .update({ current_enrollment: Math.max(0, selectedSlot.enrolled - 1) })
          .eq("id", selectedSlot.dbSessionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId] });
      queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions", dateStr] });
      toast.success("Removed from class");
    },
    onError: () => toast.error("Failed to remove"),
  });

  // Add existing member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (member: MemberSearchResult) => {
      if (!member.user_id) throw new Error("Member has no account");
      const sessionId = await ensureSession();

      const { data: existing } = await supabase
        .from("class_bookings")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", member.user_id)
        .eq("status", "confirmed")
        .maybeSingle();
      if (existing) throw new Error("Member already booked");

      const { error } = await supabase.from("class_bookings").insert({
        session_id: sessionId,
        user_id: member.user_id,
        member_id: member.id,
        status: "confirmed",
        payment_method: "admin_add",
        booked_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId] });
      queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions", dateStr] });
      setAddMemberSearch("");
      toast.success("Member added to class");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add member"),
  });

  // Add walk-in mutation
  const addWalkInMutation = useMutation({
    mutationFn: async () => {
      if (!walkInFirst.trim() || !walkInLast.trim()) throw new Error("Name is required");
      const sessionId = await ensureSession();
      const fullName = `${walkInFirst.trim()} ${walkInLast.trim()}`;

      // Check if this person has an account via email
      let userId: string | null = null;
      let memberId: string | null = null;
      if (walkInEmail.trim()) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("email", walkInEmail.trim())
          .maybeSingle();
        if (profile) {
          userId = profile.user_id;
          const { data: member } = await supabase
            .from("members")
            .select("id")
            .eq("user_id", profile.user_id)
            .eq("status", "active")
            .maybeSingle();
          if (member) memberId = member.id;
        }
      }

      // Insert the booking
      const insertData: any = {
        session_id: sessionId,
        status: "confirmed",
        payment_method: "walk_in",
        walk_in_name: fullName,
        booked_at: new Date().toISOString(),
      };
      if (userId) insertData.user_id = userId;
      if (memberId) insertData.member_id = memberId;

      const { error } = await supabase.from("class_bookings").insert(insertData);
      if (error) throw error;

      // Handle charge if toggled
      if (chargeDropIn) {
        const amountCents = memberId ? 2500 : 3000; // $25 member, $30 non-member
        if (memberId) {
          // Try to charge via Stripe
          try {
            const { data, error: chargeErr } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "charge_saved_card",
                memberId,
                amount: amountCents,
                description: `Drop-in: ${selectedSlot?.entry.name} on ${selectedSlot?.dateStr}`,
              },
            });
            if (chargeErr || !data?.success) {
              toast.info("Booking added but charge failed — collect payment at desk", { duration: 5000 });
              return;
            }
          } catch {
            toast.info("Booking added but charge failed — collect payment at desk", { duration: 5000 });
            return;
          }
        } else {
          // No card on file — just flag it
          toast.info(`Booking added — collect $${(amountCents / 100).toFixed(2)} drop-in fee at desk`, { duration: 5000 });
          return;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId] });
      queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions", dateStr] });
      resetForm();
      toast.success("Walk-in added to class");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add walk-in"),
  });

  const getDisplayName = (booking: ClassBooking) => {
    if (booking.members) {
      return `${booking.members.first_name} ${booking.members.last_name}`;
    }
    return booking.walk_in_name || "Unknown";
  };

  const getInitials = (booking: ClassBooking) => {
    if (booking.members) {
      return `${booking.members.first_name?.[0] || ""}${booking.members.last_name?.[0] || ""}`;
    }
    if (booking.walk_in_name) {
      const parts = booking.walk_in_name.split(" ");
      return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`;
    }
    return "?";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selectedSlot?.entry.name} — {format(selectedDate, "MMM d")} at{" "}
            {selectedSlot?.entry.time}
          </DialogTitle>
          <DialogDescription>
            {selectedSlot?.dbSessionId
              ? `${bookings.length} registered`
              : "No bookings yet"}
          </DialogDescription>
        </DialogHeader>

        {/* Add Button */}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddPanel(!showAddPanel)}
          >
            <UserPlus className="h-4 w-4 mr-1" />{" "}
            {showAddPanel ? "Close" : "Add to Class"}
          </Button>
        </div>

        {/* Add Panel with Tabs */}
        {showAddPanel && (
          <div className="border rounded-sm p-3 space-y-3">
            <Tabs
              value={addTab}
              onValueChange={(v) => setAddTab(v as "member" | "walkin")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="member">Existing Member</TabsTrigger>
                <TabsTrigger value="walkin">Walk-In / New</TabsTrigger>
              </TabsList>

              <TabsContent value="member" className="space-y-2 mt-2">
                <Label>Search by name, email, or ID</Label>
                <Input
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="e.g. Jane Smith or STM-000001"
                />
                {memberResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {memberResults.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted text-sm"
                      >
                        <span>
                          {m.first_name} {m.last_name}{" "}
                          <span className="text-muted-foreground">
                            ({m.member_id})
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={addMemberMutation.isPending || !m.user_id}
                          onClick={() => addMemberMutation.mutate(m)}
                        >
                          {!m.user_id ? "No account" : "Add"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="walkin" className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>First Name *</Label>
                    <Input
                      value={walkInFirst}
                      onChange={(e) => setWalkInFirst(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Input
                      value={walkInLast}
                      onChange={(e) => setWalkInLast(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={walkInEmail}
                      onChange={(e) => setWalkInEmail(e.target.value)}
                      placeholder="Optional"
                      type="email"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      placeholder="Optional"
                      type="tel"
                    />
                  </div>
                </div>

                {/* Charge toggle */}
                <div className="flex items-center justify-between rounded-sm border p-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Charge drop-in fee</p>
                      <p className="text-xs text-muted-foreground">
                        $25 member / $30 non-member
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={chargeDropIn}
                    onCheckedChange={setChargeDropIn}
                  />
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  disabled={
                    !walkInFirst.trim() ||
                    !walkInLast.trim() ||
                    addWalkInMutation.isPending
                  }
                  onClick={() => addWalkInMutation.mutate()}
                >
                  {addWalkInMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Add Walk-In
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Roster Table */}
        {bookingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !selectedSlot?.dbSessionId || bookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No one registered for this class yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const isCheckedIn =
                  booking.status === "completed" || !!booking.checked_in_at;
                const isWalkIn = !booking.member_id && !!booking.walk_in_name;
                return (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {getInitials(booking)}
                        </div>
                        <span>{getDisplayName(booking)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isWalkIn ? (
                        <Badge variant="outline" className="text-xs">
                          Walk-In
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Member
                        </Badge>
                      )}
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
                            onClick={() =>
                              checkInMutation.mutate(booking.id)
                            }
                            disabled={checkInMutation.isPending}
                          >
                            <UserCheck className="h-4 w-4 mr-1" /> Check In
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              removeMutation.mutate(booking.id)
                            }
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
  );
}
