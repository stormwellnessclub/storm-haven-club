import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SupportNotifications {
  openCount: number;
  unreadCount: number;
  totalActiveCount: number;
  /** Open/in-progress requests that no staff member has marked "received" yet. */
  unacknowledgedCount: number;
}

export function useAdminSupportNotifications() {
  return useQuery({
    queryKey: ['admin-support-notifications'],
    queryFn: async (): Promise<SupportNotifications> => {
      try {
        // Front desk / kiosk has no auth session; RLS on email_conversations
        // would return 0. Use the SECURITY DEFINER kiosk RPC in that case.
        const { data: sessionData } = await supabase.auth.getSession();
        const hasAuth = !!sessionData?.session?.user;

        if (!hasAuth) {
          const { data, error } = await (supabase.rpc as any)(
            'kiosk_support_notification_counts',
          );
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          const openCount = row?.open_count ?? 0;
          const unreadCount = row?.unread_count ?? 0;
          const unacknowledgedCount = row?.unacknowledged_count ?? 0;
          return {
            openCount,
            unreadCount,
            totalActiveCount: openCount + unreadCount,
            unacknowledgedCount,
          };
        }

        const { count: openCount, error: openError } = await supabase
          .from('email_conversations')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress']);

        if (openError) throw openError;

        const { data: activeConvos, error: activeError } = await supabase
          .from('email_conversations')
          .select('id, acknowledged_at')
          .in('status', ['open', 'in_progress']);

        if (activeError) throw activeError;

        const activeIds = (activeConvos || []).map(c => c.id);
        const unacknowledgedIds = (activeConvos || [])
          .filter((c: any) => !c.acknowledged_at)
          .map(c => c.id);

        let unreadCount = 0;
        if (activeIds.length > 0) {
          const { count, error: unreadError } = await supabase
            .from('email_messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_type', 'member')
            .eq('is_read', false)
            .in('conversation_id', activeIds);

          if (unreadError) throw unreadError;
          unreadCount = count || 0;
        }

        return {
          openCount: openCount || 0,
          unreadCount,
          totalActiveCount: (openCount || 0) + unreadCount,
          unacknowledgedCount: unacknowledgedIds.length,
        };
      } catch (error) {
        console.error('Failed to load admin support notifications:', error);
        return {
          openCount: 0,
          unreadCount: 0,
          totalActiveCount: 0,
          unacknowledgedCount: 0,
        };
      }
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
