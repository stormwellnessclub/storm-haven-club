import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, User, Users, ChevronLeft, ChevronRight, CalendarDays, Check, Loader2, Star } from "lucide-react";
import { useClassTypeRatings } from "@/hooks/useClassReviews";
import { StarRating } from "@/components/reviews/StarRating";
import { startOfWeek, addDays, addWeeks, format, isSameDay, isBefore, startOfDay } from "date-fns";
import { useTempClassBooking } from "@/hooks/useTempClassBooking";
import { useWaitlistStatus, useJoinWaitlist } from "@/hooks/useWaitlist";
import {
  SOFT_LAUNCH_START, SOFT_LAUNCH_END,
  getClassesForDate, parseTimeToDb,
  type ClassEntry,
} from "@/lib/softLaunchSchedule";

interface TempClassCardProps {
  entry: ClassEntry;
  date: Date;
  readOnly?: boolean;
  isLoggedIn: boolean;
  canBook: boolean;
  isBooked: boolean;
  isBooking: boolean;
  enrolled: number;
  maxCapacity: number;
  isFull: boolean;
  isOnWaitlist: boolean;
  isJoiningWaitlist: boolean;
  onBook: () => void;
  onGetPass: () => void;
  onSignIn: () => void;
  onJoinWaitlist: () => void;
  ratingInfo?: { average_rating: number; review_count: number } | null;
}

function TempClassCard({ entry, readOnly, isLoggedIn, canBook, isBooked, isBooking, enrolled, maxCapacity, isFull, isOnWaitlist, isJoiningWaitlist, onBook, onGetPass, onSignIn, onJoinWaitlist, ratingInfo }: TempClassCardProps) {
  const renderButton = () => {
    if (readOnly) return null;

    if (isBooked) {
      return (
        <Button size="sm" className="w-full" disabled variant="secondary">
          <Check className="h-4 w-4 mr-1" />
          Booked
        </Button>
      );
    }

    if (isFull) {
      if (!isLoggedIn) {
        return (
          <Button size="sm" className="w-full" variant="outline" onClick={onSignIn}>
            Sign In to Join Waitlist
          </Button>
        );
      }
      if (isOnWaitlist) {
        return (
          <Button size="sm" className="w-full" disabled variant="secondary">
            On Waitlist
          </Button>
        );
      }
      return (
        <Button size="sm" className="w-full" variant="outline" onClick={onJoinWaitlist} disabled={isJoiningWaitlist}>
          {isJoiningWaitlist ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          {isJoiningWaitlist ? "Joining..." : "Join Waitlist"}
        </Button>
      );
    }

    if (!isLoggedIn) {
      return (
        <Button size="sm" className="w-full" variant="outline" onClick={onSignIn}>
          Sign In to Book
        </Button>
      );
    }

    if (!canBook) {
      return (
        <Button size="sm" className="w-full" variant="outline" onClick={onGetPass}>
          Get a Pass
        </Button>
      );
    }

    return (
      <Button size="sm" className="w-full" onClick={onBook} disabled={isBooking}>
        {isBooking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        {isBooking ? "Booking..." : "Book Class"}
      </Button>
    );
  };

  return (
    <Card className={`group hover:shadow-md transition-shadow ${isBooked ? "border-primary/50 bg-primary/5" : ""}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {entry.name}
            </h3>
            <Badge variant="secondary" className="text-xs mt-1">Pilates</Badge>
            {ratingInfo && ratingInfo.review_count > 0 && (
              <div className="mt-1">
                <StarRating rating={ratingInfo.average_rating} size="sm" showValue count={ratingInfo.review_count} />
              </div>
            )}
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">{entry.time}</span>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>50 min</span></div>
          <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>Duha</span></div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>Reformer Studio</span></div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className={isFull ? "text-destructive font-medium" : ""}>
              {isFull ? "Class Full" : `${maxCapacity - enrolled} of ${maxCapacity} spots left`}
            </span>
          </div>
        </div>
        {renderButton()}
      </CardContent>
    </Card>
  );
}

export function TempClassSchedule({ readOnly = false, showHistory = false }: { readOnly?: boolean; showHistory?: boolean }) {
  const navigate = useNavigate();
  const { isLoggedIn, canBook, isBooked, bookClass, isBooking } = useTempClassBooking();

  const baseWeekStart = startOfWeek(SOFT_LAUNCH_START, { weekStartsOn: 0 });
  const today = startOfDay(new Date());

  // Minimum week offset: the current week (unless showHistory allows going back)
  const currentWeekOffset = Math.max(0, Math.round(
    (startOfWeek(new Date(), { weekStartsOn: 0 }).getTime() - baseWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  ));
  const minWeekOffset = showHistory ? 0 : currentWeekOffset;

  function getInitialWeekOffset() {
    return Math.max(minWeekOffset, currentWeekOffset);
  }

  const [weekOffset, setWeekOffset] = useState(getInitialWeekOffset);
  const todayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, []);

  const weekStart = addWeeks(baseWeekStart, weekOffset);
  const maxWeekStart = startOfWeek(SOFT_LAUNCH_END, { weekStartsOn: 0 });
  const totalWeeks = Math.round((maxWeekStart.getTime() - baseWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      dayName: format(date, "EEE"),
      dayNum: format(date, "d"),
      month: format(date, "MMM"),
      classes: getClassesForDate(date),
      isToday: isSameDay(date, new Date()),
      outOfRange: getClassesForDate(date).length === 0,
      isPast: isBefore(date, today),
    };
  });

  // Query live enrollment for sessions in the current week
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
  
  const { data: liveEnrollment = [] } = useQuery({
    queryKey: ["temp-schedule-enrollment", weekStartStr, weekEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, current_enrollment, max_capacity, is_cancelled, is_hidden, class_type_id, class_types!inner(name)")
        .gte("session_date", weekStartStr)
        .lte("session_date", weekEndStr)
        .in("class_types.name", ["Signature Flow", "Reformer Flow", "Reformer Sculpt"]);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // refresh every 30s
  });

  // Helper to find enrollment for a specific class slot
  function getEnrollmentForSlot(dateStr: string, time: string, className: string): { enrolled: number; maxCapacity: number; isCancelled: boolean; isHidden: boolean; sessionId: string | null } {
    const dbTime = parseTimeToDb(time);
    const match = liveEnrollment.find((s: any) => {
      const typeName = Array.isArray(s.class_types) ? s.class_types[0]?.name : s.class_types?.name;
      return s.session_date === dateStr && s.start_time === dbTime && typeName === className;
    });
    if (match) return { enrolled: match.current_enrollment, maxCapacity: match.max_capacity, isCancelled: match.is_cancelled, isHidden: match.is_hidden, sessionId: match.id };
    return { enrolled: 0, maxCapacity: 8, isCancelled: false, isHidden: false, sessionId: null };
  }

  // Collect all session IDs for waitlist status check
  const allSessionIds = liveEnrollment.map((s: any) => s.id).filter(Boolean);
  const { data: waitlistMap = {} } = useWaitlistStatus(allSessionIds);
  const joinWaitlistMutation = useJoinWaitlist();

  return (
    <div className="space-y-6">
      {/* Soft Launch banner */}
      <div className="bg-primary/10 border-2 border-primary/40 rounded-xl py-5 px-6">
        <div className="flex items-start gap-4">
          <CalendarDays className="h-7 w-7 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-foreground">
              🎉 Booking is Now Live — Reformer Pilates Soft Launch
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              February 20 – March 18, 2026
            </p>
            <Link to="/class-passes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-2">
              Don't have a class pass? View class pass pricing
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((p) => Math.max(p - 1, minWeekOffset))} disabled={weekOffset <= minWeekOffset}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          Week of {format(weekStart, "MMM d, yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((p) => Math.min(p + 1, totalWeeks))} disabled={weekOffset >= totalWeeks}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const hidePast = day.isPast && !showHistory;
          return (
            <div key={day.dateStr} ref={day.isToday ? todayRef : undefined} className={`space-y-3 ${day.outOfRange || hidePast ? "opacity-40" : ""}`}>
              <div className={`text-center p-2 rounded-lg ${day.isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-xs font-medium uppercase">{day.dayName}</div>
                <div className="text-lg font-bold">{day.dayNum}</div>
                <div className="text-xs">{day.month}</div>
              </div>
              <div className="space-y-2">
                {hidePast ? (
                  <div className="text-center text-muted-foreground text-xs py-8">Past</div>
                ) : day.classes.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">No classes</div>
                ) : (
                  day.classes.map((cls, i) => {
                    const { enrolled, maxCapacity, isCancelled, isHidden, sessionId } = getEnrollmentForSlot(day.dateStr, cls.time, cls.name);
                    const slotIsFull = enrolled >= maxCapacity;
                    // For customer view: completely hide cancelled or hidden classes
                    if (!showHistory && (isCancelled || isHidden)) return null;
                    if (isCancelled) {
                      return (
                        <Card key={i} className="opacity-60 border-destructive/30">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold text-foreground line-through">{cls.name}</h3>
                              <span className="text-lg font-bold text-muted-foreground">{cls.time}</span>
                            </div>
                            <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                          </CardContent>
                        </Card>
                      );
                    }
                    if (isHidden) {
                      return (
                        <Card key={i} className="opacity-50 border-muted">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold text-muted-foreground line-through">{cls.name}</h3>
                              <span className="text-lg font-bold text-muted-foreground">{cls.time}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">Removed</Badge>
                          </CardContent>
                        </Card>
                      );
                    }
                    return (
                      <TempClassCard
                        key={i}
                        entry={cls}
                        date={day.date}
                        readOnly={readOnly || day.isPast}
                        isLoggedIn={isLoggedIn}
                        canBook={canBook}
                        isBooked={isBooked(day.date, cls.time)}
                        isBooking={isBooking}
                        enrolled={enrolled}
                        maxCapacity={maxCapacity}
                        isFull={slotIsFull}
                        isOnWaitlist={sessionId ? !!waitlistMap[sessionId] : false}
                        isJoiningWaitlist={joinWaitlistMutation.isPending}
                        onBook={() => bookClass({ className: cls.name, date: day.date, time: cls.time })}
                        onGetPass={() => navigate("/class-passes")}
                        onSignIn={() => navigate("/auth")}
                        onJoinWaitlist={() => sessionId && joinWaitlistMutation.mutate({ sessionId })}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Soft launch schedule: Feb 20 – Mar 18, 2026. {!readOnly && 'Click "Book Class" to reserve your spot.'}
      </p>
    </div>
  );
}
