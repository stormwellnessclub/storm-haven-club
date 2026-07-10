import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pin, Plus, Globe, Users, User } from "lucide-react";
import { CreateNoteDialog } from "./CreateNoteDialog";
import { format } from "date-fns";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StaffNote {
  id: string;
  title: string;
  content: string;
  created_by: string;
  visibility: string;
  visible_to_roles: string[];
  is_pinned: boolean;
  created_at: string;
}

const VISIBILITY_ICONS: Record<string, React.ElementType> = {
  all_staff: Globe,
  specific_roles: Users,
  specific_users: User,
};

export function NotesBoard() {
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const isSuperAdmin = roles.includes("super_admin");
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedNote, setSelectedNote] = useState<StaffNote | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from("staff_notes")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotes(data as StaffNote[]);
      const userIds = [...new Set(data.map(n => n.created_by))];
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
    fetchNotes();
    const channel = supabase
      .channel("notes-board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_notes" }, () => fetchNotes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const togglePin = async (noteId: string, currentPin: boolean) => {
    await supabase.from("staff_notes").update({ is_pinned: !currentPin }).eq("id", noteId);
  };

  const deleteNote = async (noteId: string) => {
    await supabase.from("staff_notes").delete().eq("id", noteId);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No notes yet. Create one to share with your team.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => {
            const VisIcon = VISIBILITY_ICONS[note.visibility] || Globe;
            const isOwner = note.created_by === user?.id;

            return (
              <Card key={note.id} className={`border ${note.is_pinned ? "border-accent shadow-sm" : "border-border"}`}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      {note.is_pinned && <Pin className="h-3 w-3 text-accent shrink-0" />}
                      <span className="truncate">{note.title}</span>
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                    <VisIcon className="h-3 w-3" />
                    {note.visibility === "all_staff" ? "All" : note.visibility === "specific_roles" ? "Roles" : "Users"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>{profiles[note.created_by] || "Staff"} · {format(new Date(note.created_at), "MMM d")}</span>
                    <div className="flex gap-1">
                      {(isSuperAdmin || isOwner) && (
                        <>
                          <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5" onClick={() => togglePin(note.id, note.is_pinned)}>
                            {note.is_pinned ? "Unpin" : "Pin"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-destructive" onClick={() => deleteNote(note.id)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateNoteDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchNotes} />
    </div>
  );
}
