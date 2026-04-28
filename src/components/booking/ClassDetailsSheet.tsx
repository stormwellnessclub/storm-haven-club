import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, Users, Flame, Snowflake, MapPin, User, CalendarDays } from "lucide-react";
import { format, parse, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { ClassReviewsList } from "@/components/reviews/ClassReviewsList";
import { StarRating } from "@/components/reviews/StarRating";
import { useClassTypeRatings } from "@/hooks/useClassReviews";
import { useAuth } from "@/contexts/AuthContext";

export interface ClassDetailsData {
  sessionId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  spotsLeft: number;
  isFull: boolean;
  waitlistCount?: number;
  room: string | null;
  classType: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    duration_minutes: number;
    is_heated: boolean;
  };
  instructor: { first_name: string; last_name: string } | null;
  isBooked?: boolean;
  isOnWaitlist?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: ClassDetailsData | null;
  onBook: (details: ClassDetailsData) => void;
}

function fmtTime(t: string) {
  return format(parse(t, "HH:mm:ss", new Date()), "h:mm a");
}

export function ClassDetailsSheet({ open, onOpenChange, details, onBook }: Props) {
  const { user } = useAuth();
  const { data: ratings } = useClassTypeRatings();

  if (!details) return null;
  const rating = ratings?.[details.classType.id];

  const cta = (() => {
    if (details.isBooked) return <Button disabled className="w-full" size="lg">Booked</Button>;
    if (details.isOnWaitlist) return <Button disabled className="w-full" size="lg">On Waitlist</Button>;
    if (!user) {
      return (
        <Button asChild className="w-full" size="lg">
          <Link to={`/auth?redirect=/schedule`}>
            {details.isFull ? "Sign in to Join Waitlist" : "Sign in to Book"}
          </Link>
        </Button>
      );
    }
    return (
      <Button
        className="w-full"
        size="lg"
        variant={details.isFull ? "outline" : "default"}
        onClick={() => onBook(details)}
      >
        {details.isFull ? "Join Waitlist" : "Book Class"}
      </Button>
    );
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="font-serif text-2xl">{details.classType.name}</SheetTitle>
            {details.classType.category !== "cycling" && (
              details.classType.is_heated ? (
                <Badge variant="outline" className="border-accent/50 text-accent bg-accent/10 shrink-0">
                  <Flame className="w-3 h-3 mr-1" /> Hot
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0">
                  <Snowflake className="w-3 h-3 mr-1" /> Cool
                </Badge>
              )
            )}
          </div>
          {rating && rating.review_count > 0 && (
            <div className="pt-1">
              <StarRating rating={rating.average_rating} size="sm" showValue count={rating.review_count} />
            </div>
          )}
          {details.classType.description && (
            <SheetDescription className="pt-2">{details.classType.description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
            <span>{format(parseISO(details.sessionDate), "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{fmtTime(details.startTime)} – {fmtTime(details.endTime)} · {details.classType.duration_minutes} min</span>
          </div>
          {details.instructor && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{details.instructor.first_name} {details.instructor.last_name}</span>
            </div>
          )}
          {details.room && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{details.room}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {details.isFull ? (
              <span className="text-destructive font-medium">
                Full{details.waitlistCount ? ` · ${details.waitlistCount} waitlisted` : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">{details.spotsLeft} spots left</span>
            )}
          </div>
        </div>

        <div className="mt-6">{cta}</div>

        <Separator className="my-6" />

        <div>
          <h4 className="font-serif text-lg mb-3">
            Member Reviews
            {rating && rating.review_count > 0 && (
              <span className="text-sm text-muted-foreground font-sans ml-2">
                ({rating.review_count})
              </span>
            )}
          </h4>
          <ClassReviewsList classTypeId={details.classType.id} initialLimit={5} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
