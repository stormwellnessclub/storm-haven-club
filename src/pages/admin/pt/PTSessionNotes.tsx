import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format as fmtDate } from "date-fns";
import { NotebookPen, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { usePTPeople, usePTTrainerMap } from "@/hooks/pt/usePTPortal";
import { Input } from "@/components/ui/input";

interface NoteRow {
  id: string;
  user_id: string;
  instructor_id: string | null;
  session_date: string;
  subjective: string | null;
  objective: string | null;
  next_focus: string | null;
  rpe: number | null;
  is_draft: boolean;
}

export default function PTSessionNotes() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["pt-session-notes-all"],
    queryFn: async (): Promise<NoteRow[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_session_notes")
        .select("id, user_id, instructor_id, session_date, subjective, objective, next_focus, rpe, is_draft")
        .order("session_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: people = {} } = usePTPeople(notes.map((n) => n.user_id));
  const trainerMap = usePTTrainerMap();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return notes;
    return notes.filter((n) => (people[n.user_id]?.name ?? "").toLowerCase().includes(term));
  }, [notes, people, q]);

  const columns: PTColumn<NoteRow>[] = [
    { key: "date", header: "Date", render: (n) => fmtDate(new Date(`${n.session_date}T12:00:00`), "MMM d, yyyy") },
    { key: "client", header: "Client", render: (n) => people[n.user_id]?.name ?? "—" },
    { key: "trainer", header: "Trainer", render: (n) => (n.instructor_id ? trainerMap[n.instructor_id] ?? "—" : "—") },
    {
      key: "summary",
      header: "Summary",
      render: (n) => (
        <span className="text-pt-muted line-clamp-1">{n.subjective || n.objective || n.next_focus || "—"}</span>
      ),
    },
    { key: "rpe", header: "RPE", align: "right", render: (n) => (n.rpe ?? "—") },
    { key: "state", header: "", align: "right", render: (n) => (n.is_draft ? <PTBadge tone="amber">Draft</PTBadge> : <PTBadge tone="green">Signed</PTBadge>) },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Coaching"
        title="Session Notes"
        subtitle="Every documented session across the training floor."
        actions={
          <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/pt/clients")}>
            Pick a client
          </button>
        }
      />
      <PTCard padded={false}>
        <div className="p-3 border-b border-pt-line flex items-center gap-2">
          <Search className="h-4 w-4 text-pt-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by client name"
            className="h-8 border-pt-line bg-white text-[13px]"
          />
        </div>
        <PTTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          getRowKey={(n) => n.id}
          onRowClick={(n) => navigate(`/admin/pt/clients/${n.user_id}`)}
          empty={
            <PTEmptyState
              icon={NotebookPen}
              title="No session notes yet"
              description="Notes written after a session appear here and on the client profile."
            />
          }
        />
      </PTCard>
    </PTShell>
  );
}
