import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  CreditCard,
  Calendar,
  Loader2,
  Ticket,
  BookOpen,
  Sparkles,
  Ban,
  Baby,
  GraduationCap,
  Flame,
  MessageCircle,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { KioskPinGate } from "@/components/kiosk/KioskPinGate";
import { useUnifiedCheckInSearch, UnifiedSearchResult, VisitorType } from "@/hooks/useUnifiedCheckInSearch";
import { useUnifiedAttendance, AttendanceType } from "@/hooks/useUnifiedAttendance";
import { useMemberScanner, ScanResult } from "@/hooks/useMemberScanner";
import { EffectiveStatusBadge, getEffectiveStatus } from "@/components/admin/EffectiveStatusBadge";
import { useMembersBillingIssues } from "@/hooks/useMembersBillingIssues";
import stormLogo from "@/assets/storm-logo-gold.png";
import { Textarea } from "@/components/ui/textarea";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

// ─── Type badge config ───────────────────────────────────────────────
const typeBadgeConfig: Record<VisitorType | AttendanceType, { label: string; className: string; icon: typeof User }> = {
  member: { label: "Member", className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", icon: User },
  guest_pass: { label: "Guest Pass", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Ticket },
  guest: { label: "Guest", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Ticket },
  class_booking: { label: "Class", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: BookOpen },
  class: { label: "Class", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: BookOpen },
  spa_appointment: { label: "Spa", className: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300", icon: Sparkles },
  spa: { label: "Spa", className: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300", icon: Sparkles },
};

function TypeBadge({ type }: { type: VisitorType | AttendanceType }) {
  const cfg = typeBadgeConfig[type];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

// ─── Kiosk Support Panel ────────────────────────────────────────────
interface ConversationWithProfile {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  category: string;
  last_message_at: string | null;
  created_at: string;
  member_name: string;
  latest_message?: string;
}

function KioskConversationItem({
  conversation,
  onReply,
  onMarkDone,
}: {
  conversation: ConversationWithProfile;
  onReply: (id: string, message: string) => void;
  onMarkDone: (id: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
    : formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true });

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setIsSending(true);
    await onReply(conversation.id, replyText.trim());
    setReplyText("");
    setShowReply(false);
    setIsSending(false);
  };

  return (
    <div className="p-4 rounded-lg bg-secondary/30 border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{conversation.member_name || "Unknown"}</p>
          <p className="text-sm text-muted-foreground">{conversation.subject}</p>
          {conversation.latest_message && (
            <p className="text-sm text-muted-foreground/80 mt-2 italic line-clamp-3">
              "{conversation.latest_message.slice(0, 200)}{conversation.latest_message.length > 200 ? "…" : ""}"
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowReply(!showReply)}>
            <Send className="h-3.5 w-3.5 mr-1" /> Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMarkDone(conversation.id)}
            className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
          </Button>
        </div>
      </div>
      {showReply && (
        <div className="flex gap-3">
          <Textarea
            placeholder="Type your reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[80px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
            }}
          />
          <Button onClick={handleSend} disabled={!replyText.trim() || isSending} className="self-end">
            Send
          </Button>
        </div>
      )}
    </div>
  );
}

function KioskSupportPanel() {
  const queryClient = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ["kiosk-support-conversations"],
    queryFn: async () => {
      const { data: convos, error } = await supabase
        .from("email_conversations")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("last_message_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      if (!convos || convos.length === 0) return [] as ConversationWithProfile[];

      const userIds = [...new Set(convos.map((c) => c.user_id))];
      const convoIds = convos.map((c) => c.id);
      const [profilesRes, messagesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds),
        supabase
          .from("email_messages")
          .select("conversation_id, message_body, created_at, sender_type")
          .in("conversation_id", convoIds)
          .eq("sender_type", "member")
          .order("created_at", { ascending: false }),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p) => [p.user_id, `${p.first_name || ""} ${p.last_name || ""}`.trim()])
      );
      const latestMessageMap = new Map<string, string>();
      for (const msg of messagesRes.data || []) {
        if (!latestMessageMap.has(msg.conversation_id)) {
          latestMessageMap.set(msg.conversation_id, msg.message_body);
        }
      }

      return convos.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        subject: c.subject,
        status: c.status,
        category: c.category,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        member_name: profileMap.get(c.user_id) || "Unknown Member",
        latest_message: latestMessageMap.get(c.id),
      })) as ConversationWithProfile[];
    },
    refetchInterval: 15000,
  });

  const conciergeItems = conversations?.filter((c) => c.category === "concierge") || [];
  const classSupportItems = conversations?.filter((c) => c.category === "class_support") || [];
  const kidsCareItems = conversations?.filter((c) => c.category === "kids_care") || [];
  const supportItems = conversations?.filter((c) => c.category !== "concierge" && c.category !== "class_support" && c.category !== "kids_care") || [];

  const handleReply = useCallback(
    async (conversationId: string, message: string) => {
      // Use service-role-style insert — kiosk doesn't have a logged-in user
      const { error } = await supabase.from("email_messages").insert({
        conversation_id: conversationId,
        sender_type: "staff",
        sender_email: "frontdesk@stormwellness.com",
        sender_name: "Front Desk",
        message_body: message,
      });
      if (error) {
        toast.error("Failed to send reply");
        return;
      }
      await supabase
        .from("email_conversations")
        .update({ last_message_at: new Date().toISOString(), status: "in_progress" })
        .eq("id", conversationId);
      toast.success("Reply sent");
      queryClient.invalidateQueries({ queryKey: ["kiosk-support-conversations"] });
    },
    [queryClient]
  );

  const handleMarkDone = useCallback(
    async (conversationId: string) => {
      const { error } = await supabase
        .from("email_conversations")
        .update({ status: "resolved" })
        .eq("id", conversationId);
      if (error) {
        toast.error("Failed to resolve");
        return;
      }
      toast.success("Request resolved");
      queryClient.invalidateQueries({ queryKey: ["kiosk-support-conversations"] });
    },
    [queryClient]
  );

  const renderSection = (title: string, icon: React.ReactNode, items: ConversationWithProfile[], emptyText: string) => (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {items.length > 0 ? (
          items.map((item) => (
            <KioskConversationItem
              key={item.id}
              conversation={item}
              onReply={handleReply}
              onMarkDone={handleMarkDone}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {renderSection("In-Club Requests", <Flame className="h-5 w-5 text-amber-500" />, conciergeItems, "No in-club requests")}
      {renderSection("Member Support", <MessageCircle className="h-5 w-5 text-blue-500" />, supportItems, "No open support tickets")}
      {renderSection("Kids Care", <Baby className="h-5 w-5 text-pink-500" />, kidsCareItems, "No Kids Care messages")}
      {renderSection("Class Support", <GraduationCap className="h-5 w-5 text-green-500" />, classSupportItems, "No class support tickets")}
    </div>
  );
}

// ─── Today's Classes ────────────────────────────────────────────────
function TodaysClasses() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: sessions } = useQuery({
    queryKey: ["kiosk-todays-classes", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, current_enrollment, max_capacity, is_cancelled, class_type_id, class_types(name)")
        .eq("session_date", today)
        .eq("is_cancelled", false)
        .eq("is_hidden", false)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Today's Classes
          {sessions && sessions.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{sessions.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Booked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.class_types?.name || "Unknown"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.current_enrollment >= s.max_capacity ? "destructive" : "secondary"}>
                      {s.current_enrollment}/{s.max_capacity}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No classes scheduled today</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Today's Kids Care ──────────────────────────────────────────────
function TodaysKidsCare() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: bookings } = useQuery({
    queryKey: ["kiosk-todays-kidscare", today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_kids_care_bookings", {
        p_booking_date: today,
      });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Baby className="h-5 w-5" />
          Today's Kids Care
          {bookings && bookings.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{bookings.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookings && bookings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.child_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.parent_first_name} {b.parent_last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.status === "checked_in" ? "default" : "secondary"}>
                      {b.status?.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No kids care bookings today</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Front Desk Page ───────────────────────────────────────────
export default function FrontDeskPage() {
  const [isUnlocked, setIsUnlocked] = useState(
    () => sessionStorage.getItem("kioskUnlocked") === "true"
  );

  if (!isUnlocked) {
    return <KioskPinGate onUnlock={() => setIsUnlocked(true)} />;
  }

  return <FrontDeskKiosk />;
}

function FrontDeskKiosk() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<UnifiedSearchResult | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [memberCheckInCount, setMemberCheckInCount] = useState(0);
  const [memberScanResult, setMemberScanResult] = useState<ScanResult | null>(null);

  const { results, isSearching, search, clearResults } = useUnifiedCheckInSearch();
  const { entries, stats, refetch } = useUnifiedAttendance();
  const { data: billingIssues } = useMembersBillingIssues();
  const { scanMemberAsync } = useMemberScanner();

  const memberData = selected?.type === "member" ? selected.data : null;
  const effectiveStatus = memberData
    ? getEffectiveStatus(memberData.status, billingIssues?.memberIssues?.[memberData.id])
    : null;

  // ─── Search ────────────────────────────────────────────────────────
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSelected(null);
    search(searchQuery);
  };

  const selectResult = async (result: UnifiedSearchResult) => {
    setSelected(result);
    clearResults();
    setSearchQuery("");
    setMemberScanResult(null);

    if (result.type === "member") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .eq("member_id", result.data.id)
        .gte("checked_in_at", startOfMonth.toISOString());
      setMemberCheckInCount(count || 0);

      try {
        const preCheck = await scanMemberAsync({
          memberId: result.data.member_id || result.data.id,
          deviceType: "kiosk",
          autoCheckIn: false,
          override: false,
        });
        setMemberScanResult(preCheck);
      } catch (err) {
        console.error("Pre-validation failed:", err);
      }
    }
  };

  // ─── Check-in actions ─────────────────────────────────────────────
  const handleMemberCheckIn = async () => {
    if (!memberData) return;
    setIsCheckingIn(true);
    try {
      const result = await scanMemberAsync({
        memberId: memberData.member_id || memberData.id,
        deviceType: "kiosk",
        autoCheckIn: true,
        override: false,
      });
      setMemberScanResult(result);
      if (result.access_granted) {
        toast.success(`${memberData.first_name} ${memberData.last_name} checked in!`);
        setMemberCheckInCount((c) => c + 1);
        refetch();
      } else {
        toast.error(`Cannot check in: ${result.denial_reason?.replace(/_/g, " ") || "Access denied"}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleGuestCheckIn = async () => {
    if (!selected || selected.type !== "guest_pass") return;
    setIsCheckingIn(true);
    try {
      const { error } = await supabase
        .from("guest_passes")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", selected.data.id);
      if (error) throw error;
      toast.success(`${selected.data.guest_name} checked in as guest!`);
      refetch();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.message || "Guest check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleClassCheckIn = async () => {
    if (!selected || selected.type !== "class_booking") return;
    setIsCheckingIn(true);
    try {
      const { error } = await supabase
        .from("class_bookings")
        .update({ checked_in_at: new Date().toISOString(), status: "completed" as any })
        .eq("id", selected.data.id);
      if (error) throw error;
      toast.success(`${selected.data.memberName} checked in for ${selected.data.className}!`);
      refetch();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.message || "Class check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSpaCheckIn = async () => {
    if (!selected || selected.type !== "spa_appointment") return;
    setIsCheckingIn(true);
    try {
      const { error } = await (supabase.from as any)("spa_appointments")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", selected.data.id);
      if (error) throw error;
      toast.success(`${selected.data.memberName} checked in for ${selected.data.service_name}!`);
      refetch();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.message || "Spa check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckInAction = () => {
    if (!selected) return;
    switch (selected.type) {
      case "member": return handleMemberCheckIn();
      case "guest_pass": return handleGuestCheckIn();
      case "class_booking": return handleClassCheckIn();
      case "spa_appointment": return handleSpaCheckIn();
    }
  };

  // ─── Detail Panel ─────────────────────────────────────────────────
  const renderDetailPanel = () => {
    if (!selected) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <User className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No Visitor Selected</p>
          <p className="text-sm mt-1">Search and select someone to check in</p>
        </div>
      );
    }

    if (selected.type === "member" && memberData) {
      const backendGranted = memberScanResult ? memberScanResult.access_granted : null;
      const canCheckIn = backendGranted !== null ? backendGranted : (effectiveStatus?.canCheckIn ?? false);
      const statusDescription = memberScanResult && !memberScanResult.access_granted
        ? `Access denied: ${memberScanResult.denial_reason?.replace(/_/g, " ") || "billing issue"}`
        : effectiveStatus?.description || "";

      return (
        <div className="space-y-5">
          <div className={`p-5 rounded-lg border ${canCheckIn
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center gap-4">
              {canCheckIn ? (
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-xl">{canCheckIn ? "Check-In Approved" : "Cannot Check In"}</p>
                <p className="text-sm text-muted-foreground">{statusDescription}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20">
              {memberData.photo_url && <AvatarImage src={memberData.photo_url} />}
              <AvatarFallback className="text-xl">
                {memberData.first_name?.[0]}{memberData.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-2xl font-bold">{memberData.first_name} {memberData.last_name}</h3>
              <p className="text-muted-foreground">{memberData.member_id}</p>
              <p className="text-sm text-muted-foreground">{memberData.membership_type}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Check-ins This Month</p>
                <p className="text-lg font-semibold">{memberCheckInCount}</p>
              </div>
            </div>
          </div>

          {!canCheckIn && (
            <div className="p-5 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                <Ban className="h-5 w-5" />
                Cannot Check In
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{statusDescription}</p>
            </div>
          )}

          {canCheckIn && (
            <Button className="w-full h-14 text-lg" onClick={handleMemberCheckIn} disabled={isCheckingIn}>
              {isCheckingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <UserCheck className="h-5 w-5 mr-2" />}
              Check In Member
            </Button>
          )}
        </div>
      );
    }

    if (selected.type === "guest_pass") {
      const g = selected.data;
      return (
        <div className="space-y-5">
          <div className="p-5 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-4">
              <Ticket className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-xl">Guest Pass</p>
                <p className="text-sm text-muted-foreground">Ready to check in</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
              <Ticket className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{g.guest_name}</h3>
              <p className="text-muted-foreground">{g.guest_email || "No email"}</p>
            </div>
          </div>
          {g.valid_date && (
            <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Valid Date</p>
                <p className="font-medium">{format(new Date(g.valid_date), "MMM d, yyyy")}</p>
              </div>
            </div>
          )}
          <Button className="w-full h-14 text-lg" onClick={handleCheckInAction} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <UserCheck className="h-5 w-5 mr-2" />}
            Check In Guest
          </Button>
        </div>
      );
    }

    if (selected.type === "class_booking") {
      const cb = selected.data;
      return (
        <div className="space-y-5">
          <div className="p-5 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-4">
              <BookOpen className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              <div className="flex-1">
                <p className="font-semibold text-xl">Class Booking</p>
                <p className="text-sm text-muted-foreground">Ready to check in</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{cb.memberName}</h3>
              <p className="text-muted-foreground">{cb.className}</p>
              <p className="text-sm text-muted-foreground">{cb.session?.start_time?.slice(0, 5)} – {cb.session?.end_time?.slice(0, 5)}</p>
            </div>
          </div>
          <Button className="w-full h-14 text-lg" onClick={handleCheckInAction} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <UserCheck className="h-5 w-5 mr-2" />}
            Check In for Class
          </Button>
        </div>
      );
    }

    if (selected.type === "spa_appointment") {
      const sa = selected.data;
      return (
        <div className="space-y-5">
          <div className="p-5 rounded-lg border bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800">
            <div className="flex items-center gap-4">
              <Sparkles className="h-10 w-10 text-pink-600 dark:text-pink-400" />
              <div className="flex-1">
                <p className="font-semibold text-xl">Spa Appointment</p>
                <p className="text-sm text-muted-foreground">Ready to check in</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{sa.memberName}</h3>
              <p className="text-muted-foreground">{sa.service_name}</p>
              <p className="text-sm text-muted-foreground">{sa.appointment_time?.slice(0, 5)} · {sa.duration_minutes} min</p>
            </div>
          </div>
          <Button className="w-full h-14 text-lg" onClick={handleCheckInAction} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <UserCheck className="h-5 w-5 mr-2" />}
            Check In for Spa
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-8 py-4">
        <div className="flex items-center gap-4">
          <img src={stormLogo} alt="Storm Wellness" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Storm Wellness Club</h1>
            <p className="text-sm text-muted-foreground">Front Desk</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-medium">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(), "h:mm a")}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-8">
        {/* Check-In Section */}
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5" />
                Visitor Lookup
              </CardTitle>
              <CardDescription>
                Search members, guest passes, class bookings, and spa appointments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, member ID, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-11 h-14 text-lg"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching} className="h-14 px-8 text-lg">
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
                </Button>
              </div>

              {results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Search Results</p>
                  <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                    {results.map((r) => {
                      const cfg = typeBadgeConfig[r.type];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={r.id}
                          onClick={() => selectResult(r)}
                          className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors text-left w-full"
                        >
                          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <Icon className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-lg truncate">{r.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{r.subtitle}</p>
                          </div>
                          <TypeBadge type={r.type} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!selected && results.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Search for a visitor</p>
                  <p className="text-sm mt-1">Enter a name, member ID, email, or phone number</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Visitor Details</CardTitle>
            </CardHeader>
            <CardContent>{renderDetailPanel()}</CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="text-center p-6 bg-green-50 dark:bg-green-950/30 rounded-lg border">
            <p className="text-4xl font-bold text-green-700 dark:text-green-400">{stats.total}</p>
            <p className="text-sm text-green-600 dark:text-green-500 mt-1">Total Check-Ins</p>
          </div>
          <div className="text-center p-6 bg-secondary/50 rounded-lg border">
            <p className="text-4xl font-bold">{stats.currentlyIn}</p>
            <p className="text-sm text-muted-foreground mt-1">Currently In</p>
          </div>
          <div className="text-center p-6 bg-secondary/50 rounded-lg border">
            <p className="text-4xl font-bold">{stats.members}</p>
            <p className="text-sm text-muted-foreground mt-1">Members</p>
          </div>
          <div className="text-center p-6 bg-secondary/50 rounded-lg border">
            <p className="text-4xl font-bold">{stats.guests + stats.classes + stats.spa}</p>
            <p className="text-sm text-muted-foreground mt-1">Guests / Class / Spa</p>
          </div>
        </div>

        {/* Attendance Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Today's Attendance ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length > 0 ? (
              <div className="overflow-y-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const initials = entry.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              {entry.photoUrl && <AvatarImage src={entry.photoUrl} alt={entry.name} />}
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{entry.name}</TableCell>
                          <TableCell><TypeBadge type={entry.type} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.subtitle}</TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(entry.time), "h:mm a")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No check-ins today yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support */}
        <KioskSupportPanel />

        {/* Today's Classes + Kids Care */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TodaysClasses />
          <TodaysKidsCare />
        </div>
      </main>
    </div>
  );
}
