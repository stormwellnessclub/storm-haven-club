import { useState } from "react";
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
import { MessageCircle, Send, Clock, CheckCircle2, AlertCircle, Loader2, User, Mail } from "lucide-react";
import { format } from "date-fns";
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
  open: { label: 'Open', variant: 'default', icon: <AlertCircle className="h-3 w-3" /> },
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
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all conversations with user profiles
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

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return (conversations as EmailConversation[]).map(conv => ({
        ...conv,
        profile: profileMap.get(conv.user_id) || null,
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

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('email_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: 'staff',
          sender_email: user.email || '',
          sender_name: 'Storm Wellness Staff',
          message_body: message,
        });

      if (error) throw error;

      // Update conversation status to in_progress and last_message_at
      await supabase
        .from('email_conversations')
        .update({ 
          status: 'in_progress',
          last_message_at: new Date().toISOString() 
        })
        .eq('id', conversationId);

      // TODO: Send actual email via send-email edge function
      const conversation = conversationsWithProfiles?.find(c => c.id === conversationId);
      if (conversation?.profile?.email) {
        // Could trigger email notification here
        console.log(`Would send email reply to: ${conversation.profile.email}`);
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
      toast({
        title: "Status updated",
        description: "Conversation status has been updated.",
      });
    },
  });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    await sendMessage.mutateAsync({
      conversationId: selectedConversation,
      message: newMessage.trim(),
    });
  };

  const filteredConversations = conversationsWithProfiles?.filter(conv => 
    statusFilter === 'all' || conv.status === statusFilter
  );

  const selectedConv = conversationsWithProfiles?.find(c => c.id === selectedConversation);
  const unreadCount = conversationsWithProfiles?.filter(c => c.status === 'open').length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email Management</h1>
            <p className="text-muted-foreground">
              Manage member support conversations
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">{unreadCount} open</Badge>
              )}
            </p>
          </div>
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
                      return (
                        <button
                          key={conversation.id}
                          onClick={() => setSelectedConversation(conversation.id)}
                          className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                            selectedConversation === conversation.id ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm line-clamp-1">
                                {conversation.subject}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {memberName}
                                </p>
                              </div>
                            </div>
                            <Badge variant={status.variant} className="shrink-0 text-xs">
                              {status.icon}
                              <span className="ml-1">{status.label}</span>
                            </Badge>
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
