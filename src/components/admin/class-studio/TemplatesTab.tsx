import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Copy } from "lucide-react";
import { formatTimeLabel, normalizeRoom, studioAccent, STUDIOS } from "@/lib/studios";
import type { StudioTemplate } from "@/hooks/useClassStudio";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TemplatesTab({ templates }: { templates: StudioTemplate[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [studio, setStudio] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(
    () =>
      templates.filter(
        (t) =>
          (showInactive || t.is_active) &&
          (studio === "all" || normalizeRoom(t.room) === studio),
      ),
    [templates, studio, showInactive],
  );

  const grouped = useMemo(() => {
    const m = new Map<number, StudioTemplate[]>();
    filtered.forEach((t) => m.set(t.day_of_week, [...(m.get(t.day_of_week) || []), t]));
    m.forEach((l) => l.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const toggleActive = async (t: StudioTemplate) => {
    const { error } = await supabase
      .from("class_schedules")
      .update({ is_active: !t.is_active, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(t.is_active ? "Template deactivated" : "Template activated");
    qc.invalidateQueries({ queryKey: ["class-studio-templates"] });
  };

  const clone = async (t: StudioTemplate) => {
    const { error } = await supabase.from("class_schedules").insert({
      class_type_id: t.class_type_id,
      instructor_id: t.instructor_id,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      end_time: t.end_time,
      room: t.room,
      max_capacity: t.max_capacity,
      is_active: false,
      effective_from: t.effective_from,
      effective_until: t.effective_until,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Template cloned (inactive) — edit it in Class Schedules");
    qc.invalidateQueries({ queryKey: ["class-studio-templates"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={studio} onValueChange={setStudio}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All studios</SelectItem>
            {STUDIOS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive
        </label>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/class-schedules")}>
          Full schedule editor <ExternalLink className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([day, list]) => (
          <Card key={day}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {DAYS[day]} <span className="text-muted-foreground font-normal">({list.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-md border border-border border-l-4 px-2 py-1.5 ${studioAccent(t.room)} ${
                    t.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.class_types?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatTimeLabel(t.start_time)}–{formatTimeLabel(t.end_time)} · {normalizeRoom(t.room)} · cap {t.max_capacity}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.instructors ? `${t.instructors.first_name} ${t.instructors.last_name}` : "Unstaffed"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.effective_from && (
                          <Badge variant="outline" className="text-[10px]">from {t.effective_from}</Badge>
                        )}
                        {t.effective_until && (
                          <Badge variant="outline" className="text-[10px]">until {t.effective_until}</Badge>
                        )}
                        {t.is_one_time && <Badge variant="secondary" className="text-[10px]">one-off</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                      <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => clone(t)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {grouped.length === 0 && <p className="text-sm text-muted-foreground">No templates match.</p>}
      </div>
    </div>
  );
}
