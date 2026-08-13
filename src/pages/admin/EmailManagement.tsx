import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, Clock, CheckCircle2, AlertCircle, Loader2, User, Mail, CircleDot } from "lucide-react";
import { format, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface EmailConversation {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

interface EmailMessage {
  id: string;
  conversation_id: string;
  sender_type: 'member' | 'staff';
  sender_email: string;
  sender_name: string | null;
  message_body: string;
  resend_message_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
}

const statusConfig: Record<EmailConversation['status'], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }> = {
  open: { label: 'Open', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  in_progress: { label: 'In Progress', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  resolved: { label: 'Resolved', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
  closed: { label: 'Closed', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
};

export default function EmailManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch all conversations with user profiles and unread counts
  const { data: conversationsWithProfiles, isLoading: loadingConversations } = useQuery({
    queryKey: ['admin-email-conversations'],
    queryFn: async () => {
      const { data: conversations, error: convError } = await supabase
        .from('email_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      // Fetch profiles for all user_ids
      const userIds = [...new Set((conversations as EmailConversation[]).map(c => c.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (profileError) throw profileError;

      // Fetch unread message counts per conversation
      const { data: unreadMessages, error: unreadError } = await supabase
        .from('email_messages')
        .select('conversation_id')
        .eq('sender_type', 'member')
        .eq('is_read', false);

      if (unreadError) throw unreadError;

      const unreadCountMap = new Map<string, number>();
      (unreadMessages || []).forEach(msg => {
        const count = unreadCountMap.get(msg.conversation_id) || 0;
        unreadCountMap.set(msg.conversation_id, count + 1);
      });

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return (conversations as EmailConversation[]).map(conv => ({
        ...conv,
        profile: profileMap.get(conv.user_id) || null,
        unreadCount: unreadCountMap.get(conv.id) || 0,
      }));
    },
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['admin-email-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as EmailMessage[];
    },
    enabled: !!selectedConversation,
  });

  // Mark messages as read when conversation is selected
  useEffect(() => {
    const markAsRead = async () => {
      if (!selectedConversation) return;
      
      // Routed through the SECURITY DEFINER RPC so front desk staff (who only
      // have SELECT on email_messages) can clear the unread badge too.
      const { error } = await (supabase.rpc as any)('kiosk_mark_conversation_read', {
        p_conversation_id: selectedConversation,
      });

      if (!error) {
        // Invalidate to refresh counts
        queryClient.invalidateQueries({ queryKey: ['admin-email-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['admin-support-notifications'] });
      }
    };

    markAsRead();
  }, [selectedConversation, queryClient]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      if (!user) throw new Error('User not authenticated');

      // RPC insert (also bumps status/last_message_at server-side) so all
      // staff roles including front_desk can reply.
      const { error } = await (supabase.rpc as any)('kiosk_send_staff_reply', {
        p_conversation_id: conversationId,
        p_message: message,
      });

      if (error) throw error;

      // Send actual email via send-email edge function
      const conversation = conversationsWithProfiles?.find(c => c.id === conversationId);
      if (conversation?.profile?.email) {
        try {
          // Make sure we send a fresh access token — an expired/refreshing
          // session makes the client fall back to the anon key and the
          // edge function rejects it as unauthorized.
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;

          const { error: emailError } = await supabase.functions.invoke("send-email", {
            ...(accessToken
              ? { headers: { Authorization: `Bearer ${accessToken}` } }
              : {}),
            body: {
              type: "staff_reply",
              to: conversation.profile.email,
              data: {
                name: conversation.profile.first_name || "Member",
                message: message,
                subject: conversation.subject,
                conversationId: conversationId,
              },
            },
          });

          if (emailError) {
            console.error("Failed to send email:", emailError);
            // Don't throw - message is saved in DB even if email fails
            toast({
              title: "Warning",
              description: "Message saved but email delivery failed. Please check email service configuration.",
              variant: "destructive",
            });
          }
        } catch (emailErr) {
          console.error("Error invoking send-email function:", emailErr);
          // Don't throw - message is saved in DB even if email fails
          toast({
            title: "Warning",
            description: "Message saved but email delivery failed. Please check email service configuration.",
            variant: "destructive",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['admin-email-conversations'] });
      setNewMessage("");
      toast({
        title: "Reply sent",
        description: "Your message has been sent.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: EmailConversation['status'] }) => {
      const { error } = await supabase
        .from('email_conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-notifications'] });
      toast({
        title: "Status updated",
        description: "Conversation status has been updated.",
      });
    },
  });

  // Quick mark as resolved
  const handleMarkResolved = () => {
    if (selectedConversation) {
      updateStatus.mutate({ conversationId: selectedConversation, status: 'resolved' });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    await sendMessage.mutateAsync({
      conversationId: selectedConversation,
      message: newMessage.trim(),
    });
  };

  const filteredConversations = conversationsWithProfiles?.filter(conv => {
    const statusMatch = statusFilter === 'all' || conv.status === statusFilter;
    const categoryMatch = categoryFilter === 'all' || (conv as any).category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  const selectedConv = conversationsWithProfiles?.find(c => c.id === selectedConversation);
  
  // Stats
  const openCount = conversationsWithProfiles?.filter(c => c.status === 'open').length || 0;
  const inProgressCount = conversationsWithProfiles?.filter(c => c.status === 'in_progress').length || 0;
  const resolvedTodayCount = conversationsWithProfiles?.filter(c => 
    c.status === 'resolved' && isToday(new Date(c.updated_at))
  ).length || 0;

  return (
    <AdminLayout title="Member Support">
      <div className="space-y-6">
        {/* Stats Summary */}
        <div className="grid gap-4 grid-cols-3">
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'open' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('open')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{openCount}</p>
                  <p className="text-xs text-muted-foreground">Open Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'in_progress' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-secondary">
                  <Clock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'resolved' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('resolved')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-accent">
                  <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resolvedTodayCount}</p>
                  <p className="text-xs text-muted-foreground">Resolved Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support Inbox</h1>
            <p className="text-muted-foreground text-sm">
              Manage and respond to member support requests
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="concierge">Concierge</SelectItem>
                <SelectItem value="class_support">Class Support</SelectItem>
                <SelectItem value="kids_care">Kids Care</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Conversation List */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <CardDescription>
                {filteredConversations?.length || 0} conversation(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {loadingConversations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredConversations?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <Mail className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No conversations found
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredConversations?.map((conversation) => {
                      const status = statusConfig[conversation.status];
                      const memberName = conversation.profile 
                        ? `${conversation.profile.first_name} ${conversation.profile.last_name}`.trim()
                        : 'Unknown Member';
                      const hasUnread = conversation.unreadCount > 0;
                      return (
                        <button
                          key={conversation.id}
                          onClick={() => setSelectedConversation(conversation.id)}
                          className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                            selectedConversation === conversation.id ? 'bg-muted' : ''
                          } ${hasUnread ? 'border-l-2 border-l-primary' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {hasUnread && (
                                  <CircleDot className="h-3 w-3 text-primary shrink-0" />
                                )}
                                <p className={`font-medium text-sm line-clamp-1 ${hasUnread ? 'font-semibold' : ''}`}>
                                  {conversation.subject}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {memberName}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {(conversation as any).category === 'concierge' && (
                                <Badge variant="outline" className="text-xs bg-accent/20">Concierge</Badge>
                              )}
                              {(conversation as any).category === 'class_support' && (
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Class Support</Badge>
                              )}
                              <Badge variant={status.variant} className="text-xs">
                                {status.icon}
                                <span className="ml-1">{status.label}</span>
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(conversation.last_message_at), 'MMM d, h:mm a')}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Message Thread */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {selectedConv?.subject || 'Select a conversation'}
                  </CardTitle>
                  {selectedConv && (
                    <CardDescription>
                      {selectedConv.profile ? (
                        <>
                          {selectedConv.profile.first_name} {selectedConv.profile.last_name} • {selectedConv.profile.email}
                        </>
                      ) : (
                        'Unknown member'
                      )}
                    </CardDescription>
                  )}
                </div>
                {selectedConv && (
                  <div className="flex items-center gap-2">
                    {selectedConv.status !== 'resolved' && selectedConv.status !== 'closed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleMarkResolved}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Resolved
                      </Button>
                    )}
                    <Select
                      value={selectedConv.status}
                      onValueChange={(value) => updateStatus.mutate({ 
                        conversationId: selectedConv.id, 
                        status: value as EmailConversation['status']
                      })}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedConversation ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center px-4">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Select a conversation to view and respond
                  </p>
                </div>
              ) : loadingMessages ? (
                <div className="flex items-center justify-center h-[500px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[450px] px-4">
                    <div className="space-y-4 py-4">
                      {messages?.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender_type === 'staff' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.sender_type === 'staff'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <div className={`text-xs mb-1 ${
                              message.sender_type === 'staff'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}>
                              {message.sender_type === 'staff' ? 'Staff' : message.sender_name || message.sender_email}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.message_body}</p>
                            <p className={`text-xs mt-1 ${
                              message.sender_type === 'staff'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}>
                              {format(new Date(message.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <Separator />
                  <div className="p-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your reply..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={3}
                        className="resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendMessage.isPending}
                        className="shrink-0 self-end"
                      >
                        {sendMessage.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Press Ctrl/Cmd+Enter to send
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
