import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRAINING_SERVICES } from "@/components/personal-training/TrainingRequestForm";
import { toast } from "sonner";
import { format } from "date-fns";
import { Mail, Phone, Loader2 } from "lucide-react";

interface Row {
  id: string;
  service: string;
  full_name: string;
  email: string;
  phone: string;
  preferred_times: string | null;
  experience_level: string | null;
  goals: string | null;
  is_member: boolean;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const SERVICE_LABEL: Record<string, string> = Object.fromEntries(
  TRAINING_SERVICES.map((s) => [s.value, s.label])
);

const STATUSES = ["new", "contacted", "scheduled", "closed"] as const;

const STATUS_STYLE: Record<string, string> = {
  new: "bg-accent/15 text-accent",
  contacted: "bg-blue-500/15 text-blue-600",
  scheduled: "bg-emerald-500/15 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

export default function TrainingRequestsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Failed to load training requests");
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setNotesDraft(selected?.admin_notes ?? "");
  }, [selected?.id]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("training_requests")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error("Failed to update status");
    toast.success("Status updated");
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    if (selected?.id === id) setSelected({ ...selected, status });
  }

  async function saveNotes() {
    if (!selected) return;
    const { error } = await supabase
      .from("training_requests")
      .update({ admin_notes: notesDraft })
      .eq("id", selected.id);
    if (error) return toast.error("Failed to save notes");
    toast.success("Notes saved");
    setRows((r) =>
      r.map((x) => (x.id === selected.id ? { ...x, admin_notes: notesDraft } : x))
    );
    setSelected({ ...selected, admin_notes: notesDraft });
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Training Requests</h1>
          <p className="text-sm text-muted-foreground">
            Inquiries submitted from the Personal Training pages.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
            No training requests yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_360px] gap-4">
            {/* List */}
            <div className="border border-border rounded-lg divide-y divide-border bg-card">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-4 hover:bg-muted/40 transition-colors ${
                    selected?.id === r.id ? "bg-muted/60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{r.full_name}</span>
                        {r.is_member && (
                          <Badge variant="outline" className="text-[10px]">
                            Member
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {SERVICE_LABEL[r.service] ?? r.service} ·{" "}
                        {format(new Date(r.created_at), "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                        STATUS_STYLE[r.status] ?? ""
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            <div className="border border-border rounded-lg p-4 bg-card h-fit sticky top-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a request to view details.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold text-lg">{selected.full_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(selected.created_at), "PPpp")}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <a
                      href={`mailto:${selected.email}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" /> {selected.email}
                    </a>
                    <a
                      href={`tel:${selected.phone}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" /> {selected.phone}
                    </a>
                  </div>

                  <div className="text-sm space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Service</div>
                      <div>{SERVICE_LABEL[selected.service] ?? selected.service}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Member?</div>
                      <div>{selected.is_member ? "Yes" : "No"}</div>
                    </div>
                    {selected.experience_level && (
                      <div>
                        <div className="text-xs text-muted-foreground">Experience</div>
                        <div className="capitalize">{selected.experience_level}</div>
                      </div>
                    )}
                    {selected.preferred_times && (
                      <div>
                        <div className="text-xs text-muted-foreground">Preferred times</div>
                        <div>{selected.preferred_times}</div>
                      </div>
                    )}
                    {selected.goals && (
                      <div>
                        <div className="text-xs text-muted-foreground">Goals</div>
                        <div className="whitespace-pre-wrap">{selected.goals}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => updateStatus(selected.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Admin notes</div>
                    <Textarea
                      rows={4}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={saveNotes}
                      disabled={notesDraft === (selected.admin_notes ?? "")}
                    >
                      Save notes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
