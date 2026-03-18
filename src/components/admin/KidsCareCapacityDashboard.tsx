import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminKidsCareBooking } from "@/hooks/useAdminKidsCareBookings";
import { formatTime12h } from "@/lib/timeFormat";

interface Props {
  bookings: AdminKidsCareBooking[];
  selectedDate: Date;
}

const ROOMS = [
  { name: "Little Stars", ageGroups: ["Infants", "Toddlers"], capacity: 8, emoji: "🍼" },
  { name: "Big Stars", ageGroups: ["Preschool", "School Age"], capacity: 6, emoji: "🌟" },
];

// Generate 2-hour blocks from 6am to 8pm
const TIME_BLOCKS = [
  { start: "06:00", end: "08:00" },
  { start: "08:00", end: "10:00" },
  { start: "10:00", end: "12:00" },
  { start: "12:00", end: "14:00" },
  { start: "14:00", end: "16:00" },
  { start: "16:00", end: "18:00" },
  { start: "18:00", end: "20:00" },
];

function getRoomForAgeGroup(ageGroup: string | null): string {
  if (!ageGroup) return "Little Stars";
  if (["Infants", "Toddlers"].includes(ageGroup)) return "Little Stars";
  return "Big Stars";
}

function timeOverlaps(bookingStart: string, bookingEnd: string, blockStart: string, blockEnd: string): boolean {
  const bs = bookingStart.slice(0, 5);
  const be = bookingEnd.slice(0, 5);
  return bs < blockEnd && be > blockStart;
}

export function KidsCareCapacityDashboard({ bookings, selectedDate }: Props) {
  const activeBookings = bookings.filter((b) => ["confirmed", "checked_in"].includes(b.status));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Room Capacity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-3 font-medium">Room</th>
                {TIME_BLOCKS.map((block) => (
                  <th key={block.start} className="text-center py-2 px-1 font-medium">
                    {formatTime12h(block.start).replace(" ", "\n")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOMS.map((room) => (
                <tr key={room.name} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">
                    {room.emoji} {room.name}
                    <span className="text-muted-foreground ml-1">({room.capacity})</span>
                  </td>
                  {TIME_BLOCKS.map((block) => {
                    const count = activeBookings.filter((b) => {
                      const bRoom = b.room || getRoomForAgeGroup(b.age_group);
                      return bRoom === room.name && timeOverlaps(b.start_time, b.end_time, block.start, block.end);
                    }).length;

                    const ratio = count / room.capacity;
                    let colorClass = "bg-success/10 text-success";
                    if (ratio >= 1) colorClass = "bg-destructive/10 text-destructive";
                    else if (ratio >= 0.75) colorClass = "bg-warning/10 text-warning";

                    return (
                      <td key={block.start} className="text-center py-2 px-1">
                        <Badge variant="outline" className={`${colorClass} text-xs px-1.5 py-0.5`}>
                          {count}/{room.capacity}
                        </Badge>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
