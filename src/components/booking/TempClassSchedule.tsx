import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { CircleDot } from "lucide-react";

// Placeholder schedule — will be replaced with actual times once provided
const TEMP_SCHEDULE: { day: string; times: string[] }[] = [
  { day: "Sunday", times: ["TBA"] },
  { day: "Monday", times: ["TBA"] },
  { day: "Tuesday", times: ["TBA"] },
  { day: "Wednesday", times: ["TBA"] },
  { day: "Thursday", times: ["TBA"] },
];

export function TempClassSchedule() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CircleDot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reformer Pilates — Soft Launch Schedule</h2>
          <p className="text-sm text-muted-foreground">Instructor: <span className="font-medium text-foreground">Duha</span></p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[140px]">Day</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Instructor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TEMP_SCHEDULE.map((entry) => (
              <TableRow key={entry.day}>
                <TableCell className="font-medium">{entry.day}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {entry.times.map((time, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">Duha</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        This is a temporary soft launch schedule. The full class schedule with booking will be available soon.
      </p>
    </div>
  );
}
