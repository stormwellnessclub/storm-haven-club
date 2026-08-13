import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  Send,
  Flame,
  MessageCircle,
  GraduationCap,
  Baby,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

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
  acknowledged_at?: string | null;
  acknowledged_by_name?: string | null;
}


function ConversationItem({
  conversation,
  variant,
  onReply,
  onMarkDone,
  onAcknowledge,
}: {
  conversation: ConversationWithProfile;
  variant: "concierge" | "support";
  onReply: (id: string, message: string) => void;
  onMarkDone: (id: string) => void;
  onAcknowledge: (id: string, acknowledged: boolean) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const memberName = conversation.member_name || "Unknown Member";

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
    <div className={`p-3 rounded-lg space-y-2 ${conversation.acknowledged_at ? "bg-secondary/20 opacity-80" : variant === "concierge" ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50" : "bg-secondary/30"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium text-sm truncate">{memberName}</p>
            {conversation.acknowledged_at && (
              <Badge variant="secondary" className="text-[10px] shrink-0">Received</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{conversation.subject}</p>
          {conversation.latest_message && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 italic">
              "{conversation.latest_message.slice(0, 120)}{conversation.latest_message.length > 120 ? "…" : ""}"
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {timeAgo}
            {conversation.acknowledged_at && (
              <> · received by {conversation.acknowledged_by_name || "staff"} {formatDistanceToNow(new Date(conversation.acknowledged_at), { addSuffix: true })}</>
            )}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant={conversation.acknowledged_at ? "ghost" : "outline"}
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => onAcknowledge(conversation.id, !conversation.acknowledged_at)}
            title={conversation.acknowledged_at ? "Undo received (bell resumes)" : "Mark received (silences reminder bell)"}
          >
            <BellOff className="h-3.5 w-3.5 mr-1" />
            {conversation.acknowledged_at ? "Undo" : "Received"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowReply(!showReply)}
            title="Reply"
          >
            <Send className="h-3.5 w-3.5" />

          </Button>
          {variant === "concierge" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onMarkDone(conversation.id)}
              title="Mark Done"
              className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon-sm" asChild title="View Full">
              <Link to="/admin/emails">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      {showReply && (
        <div className="flex gap-2">
          <Textarea
            placeholder="Quick reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[60px] text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!replyText.trim() || isSending}
            className="self-end"
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
}

export function CheckInSupportPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [conciergeOpen, setConciergeOpen] = useState(true);
  const [classSupportOpen, setClassSupportOpen] = useState(true);
  const [supportOpen, setSupportOpen] = useState(true);
  const [kidsCareOpen, setKidsCareOpen] = useState(true);

  // Fetch open conversations and join with profiles for member names
  const { data: conversations } = useQuery({
    queryKey: ["checkin-support-conversations"],
    queryFn: async () => {
      const { data: convos, error } = await supabase
        .from("email_conversations")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("last_message_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!convos || convos.length === 0) return [] as ConversationWithProfile[];

      // Fetch profile names for user_ids
      const userIds = [...new Set(convos.map((c) => c.user_id))];
      const convoIds = convos.map((c) => c.id);

      const [profilesRes, messagesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds),
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

      // Get the latest member message per conversation
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
        acknowledged_at: (c as any).acknowledged_at ?? null,
        acknowledged_by_name: (c as any).acknowledged_by_name ?? null,
      })) as ConversationWithProfile[];
    },
    refetchInterval: 15000,
  });

  const conciergeItems = conversations?.filter((c) => c.category === "concierge") || [];
  const classSupportItems = conversations?.filter((c) => c.category === "class_support") || [];
  const kidsCareItems = conversations?.filter((c) => c.category === "kids_care") || [];
  const supportItems = conversations?.filter((c) => c.category !== "concierge" && c.category !== "class_support" && c.category !== "kids_care") || [];
  const totalCount = (conversations?.length || 0);

  const handleReply = useCallback(
    async (conversationId: string, message: string) => {
      if (!user) return;
      const { error } = await (supabase.rpc as any)("kiosk_send_staff_reply", {
        p_conversation_id: conversationId,
        p_message: message,
      });
      if (error) {
        toast.error("Failed to send reply");
        return;
      }

      toast.success("Reply sent");
      queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
    },
    [user, queryClient]
  );

  const handleMarkDone = useCallback(
    async (conversationId: string) => {
      const { data, error } = await supabase.rpc("kiosk_resolve_conversation", {
        p_conversation_id: conversationId,
        p_resolved: true,
      });

      if (error || data === false) {
        toast.error("Couldn't resolve — you may not have permission");
        return;
      }
      toast.success("Request resolved");
      queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
    },
    [queryClient]
  );


  const handleAcknowledge = useCallback(
    async (conversationId: string, acknowledged: boolean) => {
      const staffName = user?.email || "Staff";
      const { error } = await (supabase.rpc as any)("kiosk_acknowledge_conversation", {
        p_conversation_id: conversationId,
        p_staff_name: staffName,
        p_acknowledged: acknowledged,
      });

      if (error) {
        toast.error("Failed to update");
        return;
      }
      toast.success(acknowledged ? "Marked received — reminder silenced" : "Reminder re-enabled");
      queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
    },
    [queryClient, user]
  );

  if (!conversations || totalCount === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* In-Club Requests (Concierge) */}
      <Collapsible open={conciergeOpen} onOpenChange={setConciergeOpen}>
        <Card className="border-amber-200/50 dark:border-amber-800/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Flame className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">In-Club Requests</CardTitle>
                {conciergeItems.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-xs">
                    {conciergeItems.length}
                  </Badge>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    conciergeOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-2 px-4 pb-4 space-y-2">
              {conciergeItems.length > 0 ? (
                conciergeItems.map((item) => (
                  <ConversationItem
                    key={item.id}
                    conversation={item}
                    variant="concierge"
                    onReply={handleReply}
                    onMarkDone={handleMarkDone}
                    onAcknowledge={handleAcknowledge}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No in-club requests
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Class Support */}
      <Collapsible open={classSupportOpen} onOpenChange={setClassSupportOpen}>
        <Card className="border-green-200/50 dark:border-green-800/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm font-semibold">Class Support</CardTitle>
              {classSupportItems.length > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs">
                  {classSupportItems.length}
                </Badge>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  classSupportOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-2 px-4 pb-4 space-y-2">
              {classSupportItems.length > 0 ? (
                classSupportItems.map((item) => (
                  <ConversationItem
                    key={item.id}
                    conversation={item}
                    variant="support"
                    onReply={handleReply}
                    onMarkDone={handleMarkDone}
                    onAcknowledge={handleAcknowledge}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No class support tickets
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Kids Care */}
      <Collapsible open={kidsCareOpen} onOpenChange={setKidsCareOpen}>
        <Card className="border-pink-200/50 dark:border-pink-800/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Baby className="h-4 w-4 text-pink-500" />
              <CardTitle className="text-sm font-semibold">Kids Care</CardTitle>
              {kidsCareItems.length > 0 && (
                <Badge className="bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300 text-xs">
                  {kidsCareItems.length}
                </Badge>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  kidsCareOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-2 px-4 pb-4 space-y-2">
              {kidsCareItems.length > 0 ? (
                kidsCareItems.map((item) => (
                  <ConversationItem
                    key={item.id}
                    conversation={item}
                    variant="support"
                    onReply={handleReply}
                    onMarkDone={handleMarkDone}
                    onAcknowledge={handleAcknowledge}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No Kids Care messages
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={supportOpen} onOpenChange={setSupportOpen}>
        <Card className="border-blue-200/50 dark:border-blue-800/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">Support Tickets</CardTitle>
              {supportItems.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs">
                  {supportItems.length}
                </Badge>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  supportOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-2 px-4 pb-4 space-y-2">
              {supportItems.length > 0 ? (
                supportItems.map((item) => (
                  <ConversationItem
                    key={item.id}
                    conversation={item}
                    variant="support"
                    onReply={handleReply}
                    onMarkDone={handleMarkDone}
                    onAcknowledge={handleAcknowledge}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No open support tickets
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
