import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, User, ArrowRight, Check } from "lucide-react";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface StaffTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  medium: "bg-accent/20 text-accent-foreground border-accent/30",
  low: "bg-muted text-muted-foreground",
};

const STATUS_COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export function TaskBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("staff_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTasks(data as StaffTask[]);
      // Fetch profile names for assigned users
      const userIds = [...new Set(data.map(t => t.assigned_to).filter(Boolean) as string[])];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        if (profileData) {
          const map: Record<string, string> = {};
          profileData.forEach((p: any) => {
            map[p.user_id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Staff";
          });
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("task-board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredTasks = tasks.filter(task => {
    if (filter === "mine") return task.assigned_to === user?.id;
    if (filter === "created") return task.created_by === user?.id;
    return true;
  });

  const moveTask = async (taskId: string, newStatus: string) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "done") updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    const { error } = await supabase.from("staff_tasks").update(updates).eq("id", taskId);
    if (error) {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="mine">Assigned to Me</SelectItem>
            <SelectItem value="created">Created by Me</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                {col.label}
                <span className="text-xs bg-muted rounded-full px-2 py-0.5">{colTasks.length}</span>
              </h3>
              <div className="space-y-2 min-h-[100px]">
                {colTasks.map(task => (
                  <Card key={task.id} className="border border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{task.title}</p>
                        <Badge className={`text-[10px] shrink-0 ${PRIORITY_COLORS[task.priority] || ""}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {task.assigned_to && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {profiles[task.assigned_to] || "Staff"}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "MMM d")}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {col.key !== "done" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => moveTask(task.id, col.key === "todo" ? "in_progress" : "done")}
                          >
                            {col.key === "todo" ? (
                              <><ArrowRight className="h-3 w-3 mr-1" />Start</>
                            ) : (
                              <><Check className="h-3 w-3 mr-1" />Done</>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border rounded-md">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateTaskDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchTasks} />
    </div>
  );
}
