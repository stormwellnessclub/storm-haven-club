import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, Users } from "lucide-react";
import {
  formatTimeLabel, normalizeRoom, studioAccent, studioColumnsFor, timeToMinutes,
} from "@/lib/studios";
import type { StudioSession } from "@/hooks/useClassStudio";

const PX_PER_MIN = 1.5;
const SNAP = 5;

interface Props {
  sessions: StudioSession[];
  waitlistCounts: Record<string, number>;
  onSelect: (session: StudioSession) => void;
  onMove: (session: StudioSession, startMinutes: number, room: string) => void;
  onCreate: (room: string, startMinutes: number) => void;
}

export function StudioDayGrid({ sessions, waitlistCounts, onSelect, onMove, onCreate }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  const columns = useMemo(() => studioColumnsFor(sessions.map((s) => s.room)), [sessions]);

  const { startMin, endMin } = useMemo(() => {
    if (!sessions.length) return { startMin: 6 * 60, endMin: 20 * 60 };
    const starts = sessions.map((s) => timeToMinutes(s.start_time));
    const ends = sessions.map((s) => timeToMinutes(s.end_time));
    return {
      startMin: Math.min(6 * 60, Math.floor(Math.min(...starts) / 60) * 60),
      endMin: Math.max(20 * 60, Math.ceil(Math.max(...ends) / 60) * 60),
    };
  }, [sessions]);

  const height = (endMin - startMin) * PX_PER_MIN;
  const hours = Array.from({ length: Math.ceil((endMin - startMin) / 60) + 1 }, (_, i) => startMin + i * 60);

  const dropMinutes = (e: React.DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const raw = startMin + y / PX_PER_MIN;
    return Math.round(raw / SNAP) * SNAP;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* header */}
        <div className="flex sticky top-0 z-10 bg-background border-b border-border">
          <div className="w-16 shrink-0" />
          {columns.map((col) => {
            const inCol = sessions.filter((s) => normalizeRoom(s.room) === col && !s.is_cancelled);
            const cap = inCol.reduce((a, s) => a + s.max_capacity, 0);
            const booked = inCol.reduce((a, s) => a + s.current_enrollment, 0);
            return (
              <div key={col} className="flex-1 px-2 py-2 border-l border-border">
                <p className="text-sm font-semibold truncate">{col}</p>
                <p className="text-xs text-muted-foreground">
                  {inCol.length} classes · {cap ? Math.round((booked / cap) * 100) : 0}% full
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex relative" style={{ height }}>
          {/* time axis */}
          <div className="w-16 shrink-0 relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-1 text-[11px] text-muted-foreground text-right pr-1"
                style={{ top: (h - startMin) * PX_PER_MIN - 6 }}
              >
                {formatTimeLabel(`${String(Math.floor(h / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`)}
              </div>
            ))}
          </div>

          {columns.map((col) => (
            <div
              key={col}
              className="flex-1 relative border-l border-border"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const s = sessions.find((x) => x.id === dragId);
                setDragId(null);
                if (s) onMove(s, dropMinutes(e), col);
              }}
              onDoubleClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mins = Math.round((startMin + (e.clientY - rect.top) / PX_PER_MIN) / 15) * 15;
                onCreate(col, mins);
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-border/40"
                  style={{ top: (h - startMin) * PX_PER_MIN }}
                />
              ))}

              {sessions
                .filter((s) => normalizeRoom(s.room) === col)
                .map((s) => {
                  const top = (timeToMinutes(s.start_time) - startMin) * PX_PER_MIN;
                  const h = Math.max(46, (timeToMinutes(s.end_time) - timeToMinutes(s.start_time)) * PX_PER_MIN);
                  const full = s.current_enrollment >= s.max_capacity;
                  const wl = waitlistCounts[s.id] ?? 0;
                  return (
                    <button
                      key={s.id}
                      draggable={!s.is_cancelled}
                      onDragStart={() => setDragId(s.id)}
                      onClick={() => onSelect(s)}
                      style={{ top, height: h }}
                      className={cn(
                        "absolute left-1 right-1 rounded-md border border-border border-l-4 bg-card px-2 py-1 text-left overflow-hidden hover:ring-1 hover:ring-ring transition",
                        studioAccent(s.room),
                        s.is_cancelled && "opacity-50 line-through",
                        s.is_hidden && !s.is_cancelled && "border-dashed opacity-80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-medium truncate">
                          {formatTimeLabel(s.start_time)} {s.class_types?.name}
                        </span>
                        <span className={cn("text-xs font-semibold shrink-0", full && "text-destructive")}>
                          {s.current_enrollment}/{s.max_capacity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {s.instructors ? (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {s.instructors.first_name} {s.instructors.last_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-destructive flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> Unstaffed
                          </span>
                        )}
                        {wl > 0 && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            <Users className="h-2.5 w-2.5 mr-0.5" />
                            {wl}
                          </Badge>
                        )}
                        {s.is_hidden && !s.is_cancelled && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">Draft</Badge>
                        )}
                        {s.is_cancelled && (
                          <Badge variant="destructive" className="h-4 px-1 text-[10px]">Cancelled</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground px-2 py-2">
          Drag a class to move it to another time or studio · double-click empty space to add a class
        </p>
      </div>
    </div>
  );
}
