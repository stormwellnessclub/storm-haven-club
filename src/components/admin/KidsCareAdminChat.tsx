import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Send, MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface KidsCareConversation {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  member_name: string;
  latest_message?: string;
  unread_count: number;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_email: string;
  sender_name: string | null;
  message_body: string;
  is_read: boolean;
  created_at: string;
}

export function KidsCareAdminChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["kids-care-admin-chat"],
    queryFn: async () => {
      const { data: convos, error } = await supabase
        .from("email_conversations")
        .select("*")
        .eq("category", "kids_care")
        .in("status", ["open", "in_progress"])
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!convos || convos.length === 0) return [] as KidsCareConversation[];

      const userIds = [...new Set(convos.map((c) => c.user_id))];
      const convoIds = convos.map((c) => c.id);

      const [profilesRes, messagesRes, unreadRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds),
        supabase
          .from("email_messages")
          .select("conversation_id, message_body, created_at")
          .in("conversation_id", convoIds)
          .eq("sender_type", "member")
          .order("created_at", { ascending: false }),
        supabase
          .from("email_messages")
          .select("conversation_id, id")
          .in("conversation_id", convoIds)
          .eq("sender_type", "member")
          .eq("is_read", false),
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

      const unreadCountMap = new Map<string, number>();
      for (const msg of unreadRes.data || []) {
        unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) || 0) + 1);
      }

      return convos.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        subject: c.subject,
        status: c.status,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        member_name: profileMap.get(c.user_id) || "Unknown Parent",
        latest_message: latestMessageMap.get(c.id),
        unread_count: unreadCountMap.get(c.id) || 0,
      })) as KidsCareConversation[];
    },
    refetchInterval: 10000,
  });

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["kids-care-chat-messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from("email_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Mark unread messages as read
      await supabase
        .from("email_messages")
        .update({ is_read: true })
        .eq("conversation_id", selectedConversation)
        .eq("sender_type", "member")
        .eq("is_read", false);

      return data as ChatMessage[];
    },
    enabled: !!selectedConversation,
    refetchInterval: 5000,
  });

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !selectedConversation || !user) return;
    setIsSending(true);
    const { error } = await supabase.from("email_messages").insert({
      conversation_id: selectedConversation,
      sender_type: "staff",
      sender_email: user.email || "",
      sender_name: null,
      message_body: replyText.trim(),
    });
    if (error) {
      toast.error("Failed to send reply");
      setIsSending(false);
      return;
    }
    await supabase
      .from("email_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "in_progress" })
      .eq("id", selectedConversation);

    setReplyText("");
    setIsSending(false);
    toast.success("Reply sent");
    queryClient.invalidateQueries({ queryKey: ["kids-care-chat-messages", selectedConversation] });
    queryClient.invalidateQueries({ queryKey: ["kids-care-admin-chat"] });
  }, [replyText, selectedConversation, user, queryClient]);

  const handleResolve = useCallback(async (conversationId: string) => {
    const { error } = await supabase
      .from("email_conversations")
      .update({ status: "resolved" })
      .eq("id", conversationId);
    if (error) {
      toast.error("Failed to resolve");
      return;
    }
    toast.success("Conversation resolved");
    setSelectedConversation(null);
    queryClient.invalidateQueries({ queryKey: ["kids-care-admin-chat"] });
  }, [queryClient]);

  const selectedConvo = conversations?.find((c) => c.id === selectedConversation);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No open parent conversations</p>
        <p className="text-sm mt-1">Messages from parents about Kids Care will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 h-[600px]">
      {/* Conversation list */}
      <Card className={`md:col-span-1 ${selectedConversation ? "hidden md:block" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Parent Messages</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <div className="space-y-1 px-3 pb-3">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConversation(convo.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedConversation === convo.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{convo.member_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{convo.subject}</p>
                      {convo.latest_message && (
                        <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                          {convo.latest_message.slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {convo.unread_count > 0 && (
                        <Badge className="bg-pink-500 text-white text-[10px] px-1.5 py-0">
                          {convo.unread_count}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {convo.last_message_at
                          ? formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })
                          : ""}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message thread */}
      <Card className={`md:col-span-2 flex flex-col ${!selectedConversation ? "hidden md:flex" : ""}`}>
        {selectedConvo ? (
          <>
            <CardHeader className="pb-3 border-b flex-row items-center gap-3">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm">{selectedConvo.member_name}</CardTitle>
                <p className="text-xs text-muted-foreground truncate">{selectedConvo.subject}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResolve(selectedConvo.id)}
                className="text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Resolve
              </Button>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === "staff" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.sender_type === "staff"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message_body}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.sender_type === "staff" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {format(new Date(msg.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Textarea
                placeholder="Reply to parent..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[60px] text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
                }}
              />
              <Button
                size="sm"
                onClick={handleReply}
                disabled={!replyText.trim() || isSending}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function useKidsCareUnreadCount() {
  return useQuery({
    queryKey: ["kids-care-unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("email_conversations")
        .select("id", { count: "exact", head: true })
        .eq("category", "kids_care")
        .in("status", ["open", "in_progress"]);
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 15000,
  });
}
