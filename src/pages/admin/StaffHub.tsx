import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { TaskBoard } from "@/components/staff-hub/TaskBoard";
import { NotesBoard } from "@/components/staff-hub/NotesBoard";
import { StaffChat } from "@/components/staff-hub/StaffChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, StickyNote, MessageCircle, Shield } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";

export default function StaffHub() {
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const isSuperAdmin = roles.includes("super_admin");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);

  // Fetch unread counts
  useEffect(() => {
    if (!user) return;
    
    const fetchCounts = async () => {
      // Count tasks assigned to me that are not done
      const { count: taskCount } = await supabase
        .from("staff_tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .neq("status", "done");
      setPendingTasks(taskCount || 0);
    };

    fetchCounts();

    // Subscribe to new tasks
    const taskChannel = supabase
      .channel("staff-hub-tasks")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_tasks" }, () => {
        fetchCounts();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "staff_tasks" }, () => {
        fetchCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
    };
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 flex items-center border-b border-border px-4 gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Staff Hub</h1>
              {isSuperAdmin && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Shield className="h-3 w-3" />
                  Monitoring
                </span>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 md:p-6">
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="tasks" className="gap-1.5">
                  <ClipboardList className="h-4 w-4" />
                  Tasks
                  {pendingTasks > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                      {pendingTasks}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-1.5">
                  <StickyNote className="h-4 w-4" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                  {unreadMessages > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
                      {unreadMessages}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <TaskBoard />
              </TabsContent>
              <TabsContent value="notes">
                <NotesBoard />
              </TabsContent>
              <TabsContent value="chat">
                <StaffChat onUnreadChange={setUnreadMessages} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
