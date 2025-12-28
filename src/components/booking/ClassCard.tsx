import { ClassSession } from "@/hooks/useClassSessions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, User, Flame, Users } from "lucide-react";
import { format, parse } from "date-fns";

interface ClassCardProps {
  session: ClassSession;
  onBook: (session: ClassSession) => void;
  isBooked?: boolean;
}

export function ClassCard({ session, onBook, isBooked = false }: ClassCardProps) {
  const spotsRemaining = session.max_capacity - session.current_enrollment;
  const isFull = spotsRemaining <= 0;
  const isLowSpots = spotsRemaining > 0 && spotsRemaining <= 3;

  const startTime = parse(session.start_time, "HH:mm:ss", new Date());
  const formattedTime = format(startTime, "h:mm a");

  // Determine category label based on class name
  const name = session.class_type.name.toLowerCase();
  let categoryLabel = "Other";
  if (name.includes("pilates") || name.includes("reformer")) {
    categoryLabel = "Pilates";
  } else if (name.includes("cycle")) {
    categoryLabel = "Cycling";
  } else {
    categoryLabel = "Aerobics";
  }

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {session.class_type.name}
              </h3>
              {session.class_type.is_heated && (
                <Badge variant="destructive" className="text-xs">
                  <Flame className="h-3 w-3 mr-1" />
                  Hot
                </Badge>
              )}
            </div>
            <Badge variant="secondary" className="text-xs mb-2">
              {categoryLabel}
            </Badge>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">{formattedTime}</span>
          </div>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{session.class_type.duration_minutes} min</span>
          </div>
          {session.instructor && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>
                {session.instructor.first_name} {session.instructor.last_name}
              </span>
            </div>
          )}
          {session.room && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{session.room}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span
              className={
                isFull
                  ? "text-destructive"
                  : isLowSpots
                  ? "text-orange-500"
                  : ""
              }
            >
              {isFull
                ? "Full"
                : `${spotsRemaining} spot${spotsRemaining !== 1 ? "s" : ""} left`}
            </span>
          </div>
        </div>

        <Button
          onClick={() => onBook(session)}
          disabled={isFull || isBooked}
          variant={isBooked ? "secondary" : isFull ? "outline" : "default"}
          className="w-full"
          size="sm"
        >
          {isBooked ? "Booked" : isFull ? "Join Waitlist" : "Book Class"}
        </Button>
      </CardContent>
    </Card>
  );
}
