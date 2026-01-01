import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailConversation {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
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

export function useEmailConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['email-conversations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data as EmailConversation[];
    },
    enabled: !!user,
  });
}

export function useEmailMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['email-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as EmailMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ subject, message }: { subject: string; message: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('email_conversations')
        .insert({
          user_id: user.id,
          subject,
          status: 'open',
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add initial message
      const { error: msgError } = await supabase
        .from('email_messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'member',
          sender_email: user.email || '',
          sender_name: null,
          message_body: message,
        });

      if (msgError) throw msgError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-conversations'] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      message,
      senderType = 'member'
    }: { 
      conversationId: string; 
      message: string;
      senderType?: 'member' | 'staff';
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('email_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: senderType,
          sender_email: user.email || '',
          sender_name: null,
          message_body: message,
        });

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from('email_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['email-conversations'] });
    },
  });
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      status 
    }: { 
      conversationId: string; 
      status: EmailConversation['status'];
    }) => {
      const { error } = await supabase
        .from('email_conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-conversations'] });
    },
  });
}

export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['email-messages', conversationId] });
    },
  });
}
