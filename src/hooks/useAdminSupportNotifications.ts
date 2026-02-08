import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SupportNotifications {
  openCount: number;
  unreadCount: number;
  totalActiveCount: number;
}

export function useAdminSupportNotifications() {
  return useQuery({
    queryKey: ['admin-support-notifications'],
    queryFn: async (): Promise<SupportNotifications> => {
      // Count open and in_progress conversations
      const { count: openCount, error: openError } = await supabase
        .from('email_conversations')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);

      if (openError) throw openError;

      // Count unread messages from members
      const { count: unreadCount, error: unreadError } = await supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_type', 'member')
        .eq('is_read', false);

      if (unreadError) throw unreadError;

      return {
        openCount: openCount || 0,
        unreadCount: unreadCount || 0,
        totalActiveCount: (openCount || 0) + (unreadCount || 0),
      };
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

export function useMarkMessagesAsRead() {
  return async (conversationId: string) => {
    const { error } = await supabase
      .from('email_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'member')
      .eq('is_read', false);

    if (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };
}
