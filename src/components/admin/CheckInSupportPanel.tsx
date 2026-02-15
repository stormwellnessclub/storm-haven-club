import { useState, useEffect, useRef, useCallback } from "react";
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
  Bell,
  BellOff,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  Send,
  Flame,
  MessageCircle,
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
}

function playNotificationChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // AudioContext may not be available
  }
}

function ConversationItem({
  conversation,
  variant,
  onReply,
  onMarkDone,
}: {
  conversation: ConversationWithProfile;
  variant: "concierge" | "support";
  onReply: (id: string, message: string) => void;
  onMarkDone: (id: string) => void;
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
    <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{memberName}</p>
          <p className="text-xs text-muted-foreground truncate">{conversation.subject}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{timeAgo}</p>
        </div>
        <div className="flex gap-1 shrink-0">
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
            loading={isSending}
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
  const [isMuted, setIsMuted] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(true);
  const [supportOpen, setSupportOpen] = useState(true);
  const prevCountRef = useRef<number | null>(null);

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
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, `${p.first_name || ""} ${p.last_name || ""}`.trim()])
      );

      return convos.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        subject: c.subject,
        status: c.status,
        category: c.category,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        member_name: profileMap.get(c.user_id) || "Unknown Member",
      })) as ConversationWithProfile[];
    },
    refetchInterval: 15000,
  });

  const conciergeItems = conversations?.filter((c) => c.category === "concierge") || [];
  const supportItems = conversations?.filter((c) => c.category !== "concierge") || [];
  const totalCount = (conversations?.length || 0);

  // Sound notification when new items appear
  useEffect(() => {
    if (prevCountRef.current !== null && totalCount > prevCountRef.current && !isMuted) {
      playNotificationChime();
    }
    prevCountRef.current = totalCount;
  }, [totalCount, isMuted]);

  const handleReply = useCallback(
    async (conversationId: string, message: string) => {
      if (!user) return;
      const { error } = await supabase.from("email_messages").insert({
        conversation_id: conversationId,
        sender_type: "staff",
        sender_email: user.email || "",
        sender_name: null,
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
      queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
    },
    [user, queryClient]
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
      queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
    },
    [queryClient]
  );

  if (!conversations || totalCount === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Unmute notifications" : "Mute notifications"}
              >
                {isMuted ? (
                  <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Bell className="h-3.5 w-3.5 text-amber-500" />
                )}
              </Button>
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

      {/* Support Tickets */}
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
