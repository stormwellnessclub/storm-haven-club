import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, UserCheck, Clock, CheckCircle2, XCircle, User,
  Calendar, Loader2, Ticket, BookOpen, Sparkles, Ban, Baby,
  GraduationCap, Flame, MessageCircle, Send, ChevronDown, ChevronRight, PartyPopper, RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KioskPinGate } from "@/components/kiosk/KioskPinGate";
import { useKioskSearch, KioskSearchResult, KioskVisitorType } from "@/hooks/useKioskSearch";
import { useKioskAttendance, KioskAttendanceType } from "@/hooks/useKioskAttendance";
import { useKioskCheckIn } from "@/hooks/useKioskCheckIn";
import stormLogo from "@/assets/storm-logo-gold.png";
import { Textarea } from "@/components/ui/textarea";
import { KioskClassRoster } from "@/components/kiosk/KioskClassRoster";
import { AdminSupportChime } from "@/components/admin/AdminSupportChime";
import { AdminCafeChime } from "@/components/admin/AdminCafeChime";
import { AudioUnlocker } from "@/components/admin/AudioUnlocker";
import { formatTime12h } from "@/lib/timeFormat";
import { NoIndex } from "@/components/seo/NoIndex";
import { SignedMemberPhoto } from "@/components/member/SignedMemberPhoto";

// ─── Type badge config ───────────────────────────────────────────────
type AnyType = KioskVisitorType | KioskAttendanceType;
const typeBadgeConfig: Record<string, { label: string; className: string; icon: typeof User }> = {
  member: { label: "Member", className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", icon: User },
  guest_pass: { label: "Guest Pass", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Ticket },
  guest: { label: "Guest", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Ticket },
  class_booking: { label: "Class", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: BookOpen },
  class: { label: "Class", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: BookOpen },
  spa_appointment: { label: "Spa", className: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300", icon: Sparkles },
  spa: { label: "Spa", className: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300", icon: Sparkles },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = typeBadgeConfig[type] || typeBadgeConfig.member;
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
  conversation, onReply, onMarkDone,
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
            variant="outline" size="sm"
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
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
          />
          <Button onClick={handleSend} disabled={!replyText.trim() || isSending} className="self-end">Send</Button>
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
        id: c.id, user_id: c.user_id, subject: c.subject, status: c.status,
        category: c.category, last_message_at: c.last_message_at, created_at: c.created_at,
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

  const handleReply = useCallback(async (conversationId: string, message: string) => {
    const { error } = await supabase.from("email_messages").insert({
      conversation_id: conversationId, sender_type: "staff",
      sender_email: "frontdesk@stormwellness.com", sender_name: "Front Desk",
      message_body: message,
    });
    if (error) { toast.error("Failed to send reply"); return; }
    await supabase.from("email_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "in_progress" })
      .eq("id", conversationId);
    toast.success("Reply sent");
    queryClient.invalidateQueries({ queryKey: ["kiosk-support-conversations"] });
  }, [queryClient]);

  const handleMarkDone = useCallback(async (conversationId: string) => {
    const { error } = await supabase.from("email_conversations")
      .update({ status: "resolved" }).eq("id", conversationId);
    if (error) { toast.error("Failed to resolve"); return; }
    toast.success("Request resolved");
    queryClient.invalidateQueries({ queryKey: ["kiosk-support-conversations"] });
  }, [queryClient]);

  const renderSection = (title: string, icon: React.ReactNode, items: ConversationWithProfile[], emptyText: string) => (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon} {title}
          {items.length > 0 && <Badge variant="secondary" className="ml-auto">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {items.length > 0 ? items.map((item) => (
          <KioskConversationItem key={item.id} conversation={item} onReply={handleReply} onMarkDone={handleMarkDone} />
        )) : (
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: sessions } = useQuery({
    queryKey: ["kiosk-todays-classes", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, current_enrollment, max_capacity, is_cancelled, class_type_id, class_types(name)")
        .eq("session_date", today).eq("is_cancelled", false).eq("is_hidden", false)
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
          <BookOpen className="h-5 w-5" /> Today's Classes
          {sessions && sessions.length > 0 && <Badge variant="secondary" className="ml-auto">{sessions.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.map((s: any) => {
              const isExpanded = expandedId === s.id;
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left hover:bg-muted/50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-sm flex-1 truncate">{s.class_types?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatTime12h(s.start_time)} – {formatTime12h(s.end_time)}</span>
                    <Badge variant={s.current_enrollment >= s.max_capacity ? "destructive" : "secondary"} className="shrink-0">
                      {s.current_enrollment}/{s.max_capacity}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="ml-6 border-l-2 border-muted pl-3 mb-2">
                      <KioskClassRoster sessionId={s.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
  const queryClient = useQueryClient();
  const { checkInKidsCare, checkOutKidsCare, isCheckingIn } = useKioskCheckIn();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: bookings } = useQuery({
    queryKey: ["kiosk-todays-kidscare", today],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("kiosk_kids_care_roster", {
        p_booking_date: today,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  const handleCheckIn = async (id: string) => {
    setBusyId(id);
    const ok = await checkInKidsCare(id);
    if (ok) {
      toast.success("Child checked in");
      queryClient.invalidateQueries({ queryKey: ["kiosk-todays-kidscare", today] });
    }
    setBusyId(null);
  };

  const handleCheckOut = async (id: string) => {
    setBusyId(id);
    const ok = await checkOutKidsCare(id);
    if (ok) {
      toast.success("Child checked out");
      queryClient.invalidateQueries({ queryKey: ["kiosk-todays-kidscare", today] });
    }
    setBusyId(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Baby className="h-5 w-5" /> Today's Kids Care
          {bookings && bookings.length > 0 && <Badge variant="secondary" className="ml-auto">{bookings.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookings && bookings.length > 0 ? (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Child</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bookings.map((b: any) => {
                const status = b.status as string;
                const isBusy = busyId === b.id && isCheckingIn;
                const parentName = [b.parent_first_name, b.parent_last_name].filter(Boolean).join(" ") || "—";
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.child_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{parentName}</div>
                      {b.parent_phone && <div className="text-xs text-muted-foreground/70">{b.parent_phone}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatTime12h(b.start_time)} – {formatTime12h(b.end_time)}</TableCell>
                    <TableCell>
                      {status === "checked_in" ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> In
                        </Badge>
                      ) : status === "checked_out" ? (
                        <Badge variant="secondary">Checked out</Badge>
                      ) : (
                        <Badge variant="secondary">{status?.replace(/_/g, " ")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(status === "confirmed" || status === "pending") && (
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleCheckIn(b.id)}
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check In"}
                        </Button>
                      )}
                      {status === "checked_in" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => handleCheckOut(b.id)}
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check Out"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
// Access is enforced by ProtectedFrontDeskRoute (authenticated staff session +
// front_desk/manager/admin role). No PIN gate here.
export default function FrontDeskPage() {


  return (
    <>
      <NoIndex />
      <AudioUnlocker />
      <AdminSupportChime />
      <AdminCafeChime />
      <FrontDeskKiosk />
    </>
  );
}

function FrontDeskKiosk() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<KioskSearchResult | null>(null);
  const [firstVisit, setFirstVisit] = useState<{
    checkInId?: string;
    name: string;
    kind: "first_ever" | "first_as_member";
  } | null>(null);
  const [tourSaving, setTourSaving] = useState(false);

  const { results, isSearching, search, clearResults } = useKioskSearch();
  const { entries, stats, error: attendanceError, refetch } = useKioskAttendance();
  const { checkInMember, checkInGuest, checkInClass, checkInSpa, isCheckingIn } = useKioskCheckIn();

  // ─── Search ────────────────────────────────────────────────────────
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSelected(null);
    search(searchQuery);
  };

  const selectResult = (result: KioskSearchResult) => {
    setSelected(result);
    clearResults();
    setSearchQuery("");
  };

  // ─── Check-in actions ─────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!selected) return;

    if (selected.type === "member") {
      const idText = selected.member_id_text || selected.name;
      const result = await checkInMember(idText);
      if (result.access_granted) {
        const fullName = `${result.member?.first_name ?? ""} ${result.member?.last_name ?? ""}`.trim();
        if (result.already_in) {
          toast.info(`${fullName} is already checked in today`);
        } else if (result.is_first_visit) {
          const kind = (result.first_visit_kind === "first_as_member" ? "first_as_member" : "first_ever") as
            | "first_ever"
            | "first_as_member";
          setFirstVisit({ checkInId: result.check_in_id, name: fullName, kind });
        } else {
          toast.success(`${fullName} checked in!`);
        }
        refetch();
      } else {
        toast.error(`Cannot check in: ${result.denial_reason?.replace(/_/g, " ") || result.error || "Access denied"}`);
      }
      return;
    }

    if (selected.type === "guest_pass" && selected.guest_pass_id) {
      const ok = await checkInGuest(selected.guest_pass_id);
      if (ok) { toast.success(`${selected.name} checked in as guest!`); refetch(); setSelected(null); }
      return;
    }

    if (selected.type === "class_booking" && selected.booking_id) {
      const ok = await checkInClass(selected.booking_id);
      if (ok) { toast.success(`${selected.name} checked in for class!`); refetch(); setSelected(null); }
      return;
    }

    if (selected.type === "spa_appointment" && selected.spa_id) {
      const ok = await checkInSpa(selected.spa_id);
      if (ok) { toast.success(`${selected.name} checked in for spa!`); refetch(); setSelected(null); }
      return;
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

    // Billing block: past-due, unpaid dues, or broken subscription
    const blockReason = selected.type === "member" ? selected.billing_block_reason : null;
    const isBillingBlocked = !!blockReason;

    const statusOk = selected.type !== "member" || selected.status === "active";
    const isActive = statusOk && !isBillingBlocked;
    const statusLabel = selected.type === "member" && !statusOk
      ? `Status: ${selected.status?.replace(/_/g, " ") || "inactive"}`
      : "";

    // Human-readable block reason
    const blockReasonMap: Record<string, { title: string; detail: string }> = {
      payment_past_due: {
        title: "PAYMENT PAST DUE",
        detail: "This member's payment is past due. They cannot check in until payment is updated.",
      },
      unpaid_dues: {
        title: "UNPAID DUES",
        detail: "This member has an outstanding balance. Direct them to update payment before check-in.",
      },
      subscription_past_due: {
        title: "SUBSCRIPTION PAST DUE",
        detail: "Recurring payment failed. Direct member to update their payment method.",
      },
      subscription_unpaid: {
        title: "SUBSCRIPTION UNPAID",
        detail: "Membership subscription is unpaid. Direct member to front desk manager.",
      },
      subscription_canceled: {
        title: "SUBSCRIPTION CANCELED",
        detail: "This member's subscription has been canceled. Direct them to front desk manager.",
      },
      subscription_incomplete_expired: {
        title: "SUBSCRIPTION INCOMPLETE",
        detail: "Initial payment failed. Direct member to front desk manager.",
      },
    };
    const blockInfo = blockReason ? blockReasonMap[blockReason] : null;

    const Icon = typeBadgeConfig[selected.type]?.icon || User;
    const typeLabel = typeBadgeConfig[selected.type]?.label || "Visitor";

    return (
      <div className="space-y-5">
        {/* Big red BILLING BLOCK banner — takes priority over status banner */}
        {isBillingBlocked && blockInfo && (
          <div className="p-6 rounded-lg border-4 border-red-600 bg-red-600 text-white shadow-lg animate-pulse-slow">
            <div className="flex items-start gap-4">
              <Ban className="h-12 w-12 flex-shrink-0" strokeWidth={2.5} />
              <div className="flex-1">
                <p className="text-2xl font-black tracking-wide leading-tight">
                  ⛔ CANNOT CHECK IN
                </p>
                <p className="text-lg font-bold mt-1">{blockInfo.title}</p>
                <p className="text-sm mt-2 text-red-50">{blockInfo.detail}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status banner (only when not billing-blocked) */}
        {!isBillingBlocked && (
          <div className={`p-5 rounded-lg border ${isActive
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center gap-4">
              {isActive ? (
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-xl">{isActive ? "Ready to Check In" : "Cannot Check In"}</p>
                {statusLabel && <p className="text-sm text-muted-foreground">{statusLabel}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Visitor info */}
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20">
            <SignedMemberPhoto photoUrl={selected.photo_url} alt={selected.name} />
            <AvatarFallback className="text-xl">
              {selected.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-2xl font-bold">{selected.name}</h3>
            <p className="text-muted-foreground">{selected.subtitle}</p>
            <TypeBadge type={selected.type} />
          </div>
        </div>

        {/* Status-based denial banner (non-billing) */}
        {!isBillingBlocked && !statusOk && (
          <div className="p-5 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
              <Ban className="h-5 w-5" /> Cannot Check In
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              This member's status is "{selected.status?.replace(/_/g, " ")}". Please direct them to the front desk manager.
            </p>
          </div>
        )}

        {/* Check-in button — hidden entirely when blocked */}
        {isActive && (
          <Button className="w-full h-14 text-lg" onClick={handleCheckIn} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <UserCheck className="h-5 w-5 mr-2" />}
            Check In {typeLabel}
          </Button>
        )}
      </div>
    );
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
                <Search className="h-5 w-5" /> Visitor Lookup
              </CardTitle>
              <CardDescription>Search members, guest passes, class bookings, and spa appointments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
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
                      const cfg = typeBadgeConfig[r.type] || typeBadgeConfig.member;
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={r.id}
                          onClick={() => selectResult(r)}
                          className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors text-left w-full"
                        >
                          <Avatar className="h-12 w-12 shrink-0">
                            <SignedMemberPhoto photoUrl={r.photo_url} alt={r.name} />
                            <AvatarFallback>
                              <Icon className="h-6 w-6 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-lg truncate">{r.name}</p>
                              {r.sub_type && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">{r.sub_type}</Badge>
                              )}
                            </div>
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
                  <p className="text-sm mt-1">Enter a name, email, or phone number</p>
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
            <p className="text-4xl font-bold">{stats.currently_in}</p>
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
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" /> Today's Attendance ({entries.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8">
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceError && (
              <div className="mb-3 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm flex items-center justify-between gap-3">
                <span>Couldn't load attendance: {attendanceError}</span>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7">Retry</Button>
              </div>
            )}
            {entries.length > 0 ? (
              <div className="overflow-y-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const initials = entry.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <SignedMemberPhoto photoUrl={entry.photo_url} alt={entry.name} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{entry.name}</span>
                              {entry.first_visit_kind === "first_ever" && (
                                <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-400 text-amber-950 hover:bg-amber-400 border-amber-500">
                                  ⭐ 1st Visit
                                </Badge>
                              )}
                              {entry.first_visit_kind === "first_as_member" && (
                                <Badge className="text-[10px] px-1.5 py-0 h-5 bg-blue-500 text-white hover:bg-blue-500 border-blue-600">
                                  🆕 New Member
                                </Badge>
                              )}
                              {entry.sub_type && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">{entry.sub_type}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell><TypeBadge type={entry.type} /></TableCell>
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

      {/* First-visit celebration + tour prompt */}
      <Dialog open={!!firstVisit} onOpenChange={(open) => { if (!open) setFirstVisit(null); }}>
        <DialogContent
          className={
            firstVisit?.kind === "first_as_member"
              ? "max-w-md border-4 border-blue-500 bg-gradient-to-br from-blue-50 to-white"
              : "max-w-md border-4 border-amber-400 bg-gradient-to-br from-amber-50 to-white"
          }
        >
          <DialogHeader>
            <div
              className={
                firstVisit?.kind === "first_as_member"
                  ? "mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg"
                  : "mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg"
              }
            >
              <PartyPopper className="h-9 w-9" />
            </div>
            <DialogTitle
              className={
                firstVisit?.kind === "first_as_member"
                  ? "text-center text-2xl font-bold text-blue-900"
                  : "text-center text-2xl font-bold text-amber-900"
              }
            >
              {firstVisit?.kind === "first_as_member"
                ? "⭐ First Visit as a Member!"
                : "🎉 First Club Visit!"}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              <span className="font-semibold text-foreground">{firstVisit?.name}</span>{" "}
              {firstVisit?.kind === "first_as_member" ? (
                <>
                  has been here before, but this is their first visit as a member.
                  <br />
                  Walk them through member perks — app, credits, booking, and offer a quick tour.
                </>
              ) : (
                <>
                  is here for their very first time.
                  <br />
                  Offer them a full tour of the club?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setFirstVisit(null)}
              disabled={tourSaving}
            >
              Skip
            </Button>
            <Button
              className={
                firstVisit?.kind === "first_as_member"
                  ? "bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  : "bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold"
              }
              disabled={tourSaving}
              onClick={async () => {
                if (!firstVisit?.checkInId) { setFirstVisit(null); return; }
                setTourSaving(true);
                try {
                  await (supabase.rpc as any)("mark_first_visit_tour_offered", {
                    p_check_in_id: firstVisit.checkInId,
                    p_staff_name: null,
                  });
                  toast.success(
                    firstVisit.kind === "first_as_member"
                      ? `Member walkthrough offered to ${firstVisit.name}`
                      : `Tour offered to ${firstVisit.name}`
                  );
                  refetch();
                } catch (err: any) {
                  toast.error(err?.message || "Could not save tour note");
                } finally {
                  setTourSaving(false);
                  setFirstVisit(null);
                }
              }}
            >
              {tourSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {firstVisit?.kind === "first_as_member" ? "Walkthrough offered ✓" : "Tour offered ✓"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
