import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Hash, Send, Shield, Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Channel {
  id: string;
  name: string;
  channel_type: string;
  member_ids: string[];
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message_body: string;
  is_read_by: string[];
  created_at: string;
}

interface Props {
  onUnreadChange: (count: number) => void;
}

const DEFAULT_CHANNELS = [
  { name: "General", channel_type: "general", visible_to_roles: [] as string[] },
  { name: "Front Desk", channel_type: "department", visible_to_roles: ["super_admin", "admin", "manager", "front_desk"] },
  { name: "Classes", channel_type: "department", visible_to_roles: ["super_admin", "admin", "manager", "class_instructor"] },
  { name: "Cafe", channel_type: "department", visible_to_roles: ["super_admin", "admin", "cafe_staff"] },
  { name: "Spa", channel_type: "department", visible_to_roles: ["super_admin", "admin", "spa_staff"] },
  { name: "Childcare", channel_type: "department", visible_to_roles: ["super_admin", "admin", "childcare_staff"] },
];

export function StaffChat({ onUnreadChange }: Props) {
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const isSuperAdmin = roles.includes("super_admin");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Seed default channels and fetch
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // Check if channels exist
      const { data: existing } = await supabase.from("staff_channels").select("id, name");
      if (!existing || existing.length === 0) {
        // Seed defaults
        for (const ch of DEFAULT_CHANNELS) {
        await supabase.from("staff_channels").insert([{
            name: ch.name,
            channel_type: ch.channel_type as any,
            visible_to_roles: ch.visible_to_roles as any,
            member_ids: [],
            created_by: user.id,
          }]);
        }
      }
      // Fetch channels
      const { data } = await supabase.from("staff_channels").select("*").order("created_at");
      if (data) {
        setChannels(data as Channel[]);
        if (data.length > 0 && !selectedChannel) {
          setSelectedChannel(data[0].id);
        }
      }
    };
    init();
  }, [user]);

  // Fetch messages for selected channel
  useEffect(() => {
    if (!selectedChannel) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("staff_messages")
        .select("*")
        .eq("channel_id", selectedChannel)
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) {
        setMessages(data as Message[]);
        // Fetch profiles for senders
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        if (senderIds.length > 0) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", senderIds);
          if (profileData) {
            const map: Record<string, string> = {};
            profileData.forEach((p: any) => {
              map[p.user_id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Staff";
            });
            setProfiles(prev => ({ ...prev, ...map }));
          }
        }
        // Mark as read
        const unread = data.filter(m => m.sender_id !== user?.id && !m.is_read_by?.includes(user?.id || ""));
        for (const msg of unread) {
          await supabase
            .from("staff_messages")
            .update({ is_read_by: [...(msg.is_read_by || []), user?.id] })
            .eq("id", msg.id);
        }
      }
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${selectedChannel}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "staff_messages",
        filter: `channel_id=eq.${selectedChannel}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        // Fetch sender profile if needed
        if (!profiles[newMsg.sender_id]) {
          supabase
            .from("profiles")
            .select("user_id, first_name, last_name")
            .eq("user_id", newMsg.sender_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setProfiles(prev => ({
                  ...prev,
                  [(data as any).user_id]: `${(data as any).first_name || ""} ${(data as any).last_name || ""}`.trim() || "Staff",
                }));
              }
            });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel, user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedChannel || sending) return;
    setSending(true);
    const { error } = await supabase.from("staff_messages").insert([{
      channel_id: selectedChannel,
      sender_id: user.id,
      message_body: newMessage.trim(),
      is_read_by: [user.id],
    }]);
    setSending(false);
    if (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } else {
      setNewMessage("");
    }
  };

  const selectedChannelData = channels.find(c => c.id === selectedChannel);

  return (
    <div className="flex border border-border rounded-lg overflow-hidden h-[500px]">
      {/* Channel list */}
      <div className="w-48 md:w-56 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channels</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors ${
                  selectedChannel === ch.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="h-12 flex items-center px-4 border-b border-border gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{selectedChannelData?.name || "Select a channel"}</span>
          {isSuperAdmin && (
            <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
              <Shield className="h-3 w-3" />
              Monitored
            </Badge>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                No messages yet. Start the conversation!
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"} rounded-lg px-3 py-2`}>
                    {!isMe && (
                      <p className="text-xs font-medium mb-0.5 opacity-70">
                        {profiles[msg.sender_id] || "Staff"}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message_body}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "opacity-60" : "text-muted-foreground"}`}>
                      {format(new Date(msg.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Message #${selectedChannelData?.name || "channel"}...`}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="flex-1"
            />
            <Button size="icon" aria-label="Send message" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <Shield className="h-3 w-3" /> All messages are monitored by management
          </p>
        </div>
      </div>
    </div>
  );
}
