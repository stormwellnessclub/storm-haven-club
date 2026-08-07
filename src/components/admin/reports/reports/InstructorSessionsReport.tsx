import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText } from "lucide-react";
import { downloadCsv } from "@/lib/ptExport";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

interface SessionRow {
  id: string;
  date: string;
  time: string;
  instructorId: string | null;
  instructorName: string;
  className: string;
  room: string;
  booked: number;
  attended: number;
  capacity: number;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

function formatDate(date: string): string {
  return format(new Date(`${date}T12:00:00`), "EEE, MMM d yyyy");
}

export function InstructorSessionsReport({ dateRange }: Props) {
  const [instructorId, setInstructorId] = useState<string>("all");
  const [includeEmpty, setIncludeEmpty] = useState(false);

  const startDate = format(dateRange.start, "yyyy-MM-dd");
  const endDate = format(dateRange.end, "yyyy-MM-dd");

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructor-sessions-report-instructors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, first_name, last_name, is_active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["instructor-sessions-report", startDate, endDate],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select(
          `id, session_date, start_time, room, max_capacity, is_cancelled, is_hidden,
           instructor_id,
           instructors ( first_name, last_name ),
           class_types ( name ),
           class_bookings ( id, checked_in_at )`
        )
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (error) throw error;

      return ((data || []) as any[])
        .filter((s) => !s.is_cancelled && !s.is_hidden)
        .map((s) => {
          const bookings = (s.class_bookings || []) as any[];
          return {
            id: s.id,
            date: s.session_date,
            time: s.start_time,
            instructorId: s.instructor_id,
            instructorName: s.instructors
              ? `${s.instructors.first_name} ${s.instructors.last_name}`
              : "Unassigned",
            className: s.class_types?.name || "—",
            room: s.room || "—",
            booked: bookings.length,
            attended: bookings.filter((b) => b.checked_in_at).length,
            capacity: s.max_capacity || 0,
          };
        });
    },
  });

  const filtered = useMemo(() => {
    let list = rows;
    if (instructorId !== "all") {
      list = list.filter((r) => r.instructorId === instructorId);
    }
    if (!includeEmpty) {
      list = list.filter((r) => r.attended > 0);
    }
    return list;
  }, [rows, instructorId, includeEmpty]);

  const summary = useMemo(() => {
    const taught = filtered.filter((r) => r.attended > 0);
    const totalAttended = taught.reduce((sum, r) => sum + r.attended, 0);
    const totalCapacity = taught.reduce((sum, r) => sum + r.capacity, 0);
    return {
      classesTaught: taught.length,
      totalAttended,
      avgAttendance: taught.length
        ? Math.round((totalAttended / taught.length) * 10) / 10
        : 0,
      fillRate: totalCapacity
        ? Math.round((totalAttended / totalCapacity) * 100)
        : 0,
    };
  }, [filtered]);

  const byInstructor = useMemo(() => {
    const map = new Map<
      string,
      { name: string; taught: number; attendees: number; capacity: number }
    >();
    for (const r of filtered) {
      if (r.attended === 0) continue;
      const key = r.instructorId || "unassigned";
      const entry =
        map.get(key) ||
        { name: r.instructorName, taught: 0, attendees: 0, capacity: 0 };
      entry.taught += 1;
      entry.attendees += r.attended;
      entry.capacity += r.capacity;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.taught - a.taught);
  }, [filtered]);

  const selectedName =
    instructorId === "all"
      ? "All Instructors"
      : instructors.find((i) => i.id === instructorId)
      ? `${instructors.find((i) => i.id === instructorId)!.first_name} ${
          instructors.find((i) => i.id === instructorId)!.last_name
        }`
      : "Instructor";

  const exportRows = () =>
    filtered.map((r) => ({
      Date: formatDate(r.date),
      Time: formatTime12h(r.time),
      Instructor: r.instructorName,
      Class: r.className,
      Room: r.room,
      Booked: r.booked,
      Attended: r.attended,
      Capacity: r.capacity,
      "Fill %": r.capacity
        ? `${Math.round((r.attended / r.capacity) * 100)}%`
        : "—",
    }));

  const handleCsv = () => {
    downloadCsv(
      `instructor-sessions-${selectedName.replace(/\s+/g, "-").toLowerCase()}-${startDate}-to-${endDate}.csv`,
      exportRows()
    );
  };

  const handlePdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Instructor Sessions Report", 14, 16);
    doc.setFontSize(10);
    doc.text(selectedName, 14, 23);
    doc.text(
      `${format(dateRange.start, "MMM d, yyyy")} – ${format(dateRange.end, "MMM d, yyyy")}`,
      14,
      29
    );
    doc.text(
      `Classes taught: ${summary.classesTaught}   Attendees: ${summary.totalAttended}   Avg: ${summary.avgAttendance}   Fill: ${summary.fillRate}%`,
      14,
      35
    );

    const data = exportRows();
    autoTable(doc, {
      startY: 41,
      head: [Object.keys(data[0] || { Date: "" })],
      body: data.map((r) => Object.values(r).map((v) => String(v))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    doc.save(
      `instructor-sessions-${selectedName.replace(/\s+/g, "-").toLowerCase()}-${startDate}.pdf`
    );
  };

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={instructorId} onValueChange={setInstructorId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select instructor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All instructors</SelectItem>
            {instructors.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.first_name} {i.last_name}
                {!i.is_active ? " (inactive)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="include-empty"
            checked={includeEmpty}
            onCheckedChange={setIncludeEmpty}
          />
          <Label htmlFor="include-empty" className="text-sm">
            Include empty / no-show sessions
          </Label>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCsv}
            disabled={!filtered.length}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdf}
            disabled={!filtered.length}
          >
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Classes Taught
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.classesTaught}</div>
            <p className="text-xs text-muted-foreground mt-1">
              At least one attendee
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Attendees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAttended}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgAttendance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fill Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.fillRate}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedName}
            <Badge variant="secondary">{filtered.length} sessions</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sessions with attendance in this range.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  {instructorId === "all" && <TableHead>Instructor</TableHead>}
                  <TableHead>Class</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Booked</TableHead>
                  <TableHead className="text-right">Attended</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Fill %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={r.attended === 0 ? "opacity-60" : ""}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(r.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTime12h(r.time)}
                    </TableCell>
                    {instructorId === "all" && (
                      <TableCell>{r.instructorName}</TableCell>
                    )}
                    <TableCell>{r.className}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.room}
                    </TableCell>
                    <TableCell className="text-right">{r.booked}</TableCell>
                    <TableCell className="text-right font-medium">
                      {r.attended}
                    </TableCell>
                    <TableCell className="text-right">{r.capacity}</TableCell>
                    <TableCell className="text-right">
                      {r.capacity
                        ? `${Math.round((r.attended / r.capacity) * 100)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
