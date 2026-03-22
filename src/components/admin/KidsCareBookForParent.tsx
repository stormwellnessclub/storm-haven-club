import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCreateKidsCareBooking } from "@/hooks/useAdminKidsCareBookings";
import { format } from "date-fns";
import { toast } from "sonner";

interface MemberResult {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ChildResult {
  id: string;
  full_name: string;
  date_of_birth: string | null;
}

interface PassResult {
  id: string;
  classes_remaining: number;
  classes_total: number;
  expires_at: string;
}

export function KidsCareBookForParent() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [children, setChildren] = useState<ChildResult[]>([]);
  const [passes, setPasses] = useState<PassResult[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [selectedPass, setSelectedPass] = useState<string>("");
  const [bookingDate, setBookingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [notes, setNotes] = useState("");

  const createBooking = useAdminCreateKidsCareBooking();

  const searchMembers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from("members")
        .select("id, user_id, first_name, last_name, email")
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .eq("status", "active")
        .limit(10);
      setMembers((data as MemberResult[]) || []);
    } finally {
      setSearching(false);
    }
  };

  const selectMember = async (member: MemberResult) => {
    setSelectedMember(member);
    setMembers([]);
    // Fetch children and passes
    const [childRes, passRes] = await Promise.all([
      (supabase.from as any)("kids_care_children")
        .select("id, full_name, date_of_birth")
        .eq("user_id", member.user_id)
        .eq("is_active", true),
      supabase
        .from("class_passes")
        .select("id, classes_remaining, classes_total, expires_at")
        .eq("user_id", member.user_id)
        .eq("category", "kids_care")
        .eq("status", "active")
        .gt("classes_remaining", 0),
    ]);
    setChildren(childRes.data || []);
    setPasses(passRes.data || []);
  };

  const getChildAge = (child: ChildResult) => {
    if (!child.date_of_birth) return 3;
    const dob = new Date(child.date_of_birth);
    return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const handleSubmit = () => {
    if (!selectedMember || !selectedChild || !selectedPass) {
      toast.error("Please fill in all required fields");
      return;
    }
    const child = children.find(c => c.full_name === selectedChild);
    if (!child) return;

    createBooking.mutate({
      userId: selectedMember.user_id,
      memberId: selectedMember.id,
      childName: selectedChild,
      childAge: getChildAge(child),
      bookingDate,
      startTime: startTime + ":00",
      endTime: endTime + ":00",
      passId: selectedPass,
      specialInstructions: notes || undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSearchQuery("");
    setSelectedMember(null);
    setChildren([]);
    setPasses([]);
    setSelectedChild("");
    setSelectedPass("");
    setBookingDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("10:00");
    setEndTime("12:00");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Book for Parent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book Kids Care for Parent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!selectedMember ? (
            <div className="space-y-2">
              <Label>Search Member</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchMembers()}
                />
                <Button size="sm" onClick={searchMembers} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {members.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => selectMember(m)}
                    >
                      {m.first_name} {m.last_name} — {m.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="font-medium">{selectedMember.first_name} {selectedMember.last_name}</span>
                <span className="text-muted-foreground ml-2">{selectedMember.email}</span>
                <Button variant="ghost" size="sm" className="ml-2 h-6 text-xs" onClick={() => { setSelectedMember(null); setChildren([]); setPasses([]); }}>
                  Change
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Child</Label>
                {children.length > 0 ? (
                  <Select value={selectedChild} onValueChange={setSelectedChild}>
                    <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                    <SelectContent>
                      {children.map((c) => (
                        <SelectItem key={c.id} value={c.full_name}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No registered children found. Parent needs to register first.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Pass</Label>
                {passes.length > 0 ? (
                  <Select value={selectedPass} onValueChange={setSelectedPass}>
                    <SelectTrigger><SelectValue placeholder="Select pass" /></SelectTrigger>
                    <SelectContent>
                      {passes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.classes_remaining}/{p.classes_total} sessions — exp {new Date(p.expires_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No active pass found. Parent needs to purchase one first.</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!selectedChild || !selectedPass || createBooking.isPending}
              >
                {createBooking.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create Booking
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
