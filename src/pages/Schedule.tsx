import React, { useState, useMemo, useEffect, useRef } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  startOfWeek, addDays, addWeeks, format, isBefore, startOfDay, isToday,
} from "date-fns";
import { isSessionFinishedToday } from "@/lib/classSessionFilters";
import {
  ChevronLeft, ChevronRight, Clock, Users, Flame, Snowflake,
  CircleDot, Bike, Activity, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/booking/BookingModal";
import { ClassSession as BookableSession } from "@/hooks/useClassSessions";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMyBookings } from "@/hooks/useBooking";
import { useWaitlistStatus, useWaitlistCounts } from "@/hooks/useWaitlist";

type CategoryFilter = "all" | "pilates_cycling" | "aerobics" | "other";

const categoryConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  reformer: { icon: CircleDot, label: "Reformer Pilates", color: "bg-amber-900/10 text-amber-900" },
  pilates_cycling: { icon: CircleDot, label: "Pilates", color: "bg-amber-900/10 text-amber-900" },
  cycling: { icon: Bike, label: "Cycling", color: "bg-foreground/10 text-foreground" },
  aerobics: { icon: Activity, label: "Aerobics", color: "bg-amber-700/10 text-amber-700" },
};

interface ClassSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_enrollment: number;
  is_cancelled: boolean;
  room: string | null;
  class_types: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    duration_minutes: number;
    is_heated: boolean;
    image_url: string | null;
  };
  instructors: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function Schedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 0 }));
  const todayRef = React.useRef<HTMLDivElement>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedSession, setSelectedSession] = useState<BookableSession | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data: myBookings } = useMyBookings();
  const bookedSessionIds = useMemo(() => {
    if (!myBookings) return new Set<string>();
    return new Set(myBookings.filter(b => b.status === "confirmed").map(b => b.session_id));
  }, [myBookings]);

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ["public-schedule", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select(`
          id, session_date, start_time, end_time, max_capacity, current_enrollment, is_cancelled, room,
          class_types!inner(id, name, category, description, duration_minutes, is_heated, image_url),
          instructors(id, first_name, last_name)
        `)
        .gte("session_date", startStr)
        .lte("session_date", endStr)
        .eq("is_cancelled", false)
        .eq("is_hidden", false)
        .eq("class_types.is_active", true)
        .order("session_date")
        .order("start_time");
      if (error) throw error;
      return (data || []) as unknown as ClassSession[];
    },
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const allSessionIds = useMemo(() => sessions.map(s => s.id), [sessions]);
  const { data: waitlistStatus } = useWaitlistStatus(allSessionIds);
  const { data: waitlistCounts } = useWaitlistCounts(allSessionIds);

  const filteredSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((s) => !isSessionFinishedToday(s.session_date, s.start_time, s.class_types.duration_minutes || 50, now))
      .filter((s) => categoryFilter === "all" || s.class_types.category === categoryFilter);
  }, [sessions, categoryFilter]);

  // Group by date
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClassSession[]> = {};
    for (const day of weekDays) {
      map[format(day, "yyyy-MM-dd")] = [];
    }
    for (const s of filteredSessions) {
      if (map[s.session_date]) {
        map[s.session_date].push(s);
      }
    }
    return map;
  }, [filteredSessions, weekDays]);

  const canGoPrev = !isBefore(addWeeks(weekStart, -1), startOfWeek(today, { weekStartsOn: 0 }));

  const visibleWeekDays = useMemo(() => {
    return weekDays.filter((day) => !isBefore(day, today) || isToday(day));
  }, [weekDays, today]);

  useEffect(() => {
    if (todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [weekStart]);

  return (
    <Layout>
      <SEOHead
        title="Class Schedule"
        description="View the weekly class schedule at Storm Wellness Club. Reformer Pilates, Indoor Cycling, Aerobics, and more."
        path="/schedule"
      />

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Weekly Schedule</p>
            <h1 className="heading-display mb-4">Class Schedule</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Browse our weekly class offerings. Sign in to book your spot.
            </p>
          </div>
        </div>
      </section>

      {/* Filters + Week Navigation */}
      <section className="py-6 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Category filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all" as const, label: "All Classes", icon: null },
                { value: "pilates_cycling" as const, label: "Pilates & Cycling", icon: CircleDot },
                { value: "aerobics" as const, label: "Aerobics", icon: Activity },
                { value: "other" as const, label: "Other", icon: Bike },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={`filter-badge flex items-center gap-1.5 ${categoryFilter === cat.value ? "filter-badge-active" : ""}`}
                >
                  {cat.icon && <cat.icon className="w-3.5 h-3.5" />}
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart((w) => addWeeks(w, -1))}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center">
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule Grid */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-6">
          {error ? (
            <div className="text-center py-16">
              <p className="text-destructive">Failed to load schedule. Please try again later.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {visibleWeekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const daySessions = sessionsByDate[dateStr] || [];

                return (
                  <div key={dateStr} ref={isToday(day) ? todayRef : undefined}>
                    <div className="flex items-center gap-3 mb-4">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                      <h2 className="font-serif text-xl">
                        {format(day, "EEEE, MMMM d")}
                        {isToday(day) && (
                          <Badge variant="outline" className="ml-2 text-xs border-accent text-accent">
                            Today
                          </Badge>
                        )}
                      </h2>
                    </div>

                    {daySessions.length === 0 ? (
                      <p className="text-muted-foreground text-sm pl-8">No classes scheduled</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {daySessions.map((session) => {
                          const ct = session.class_types;
                          const config = categoryConfig[ct.category] || { icon: Activity, label: ct.category, color: "bg-muted text-muted-foreground" };
                          const Icon = config.icon;
                          const spotsLeft = session.max_capacity - session.current_enrollment;
                          const isFull = spotsLeft <= 0;
                          const instructor = session.instructors;

                          return (
                            <div
                              key={session.id}
                              className="card-luxury p-4 flex gap-3"
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.color.split(" ")[0]}`}>
                                <Icon className={`w-5 h-5 ${config.color.split(" ")[1]}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-serif text-base font-medium truncate">{ct.name}</h3>
                                  {ct.category !== "cycling" && (
                                    ct.is_heated ? (
                                      <Badge variant="outline" className="text-[10px] shrink-0 border-accent/50 text-accent bg-accent/10">
                                        <Flame className="w-2.5 h-2.5 mr-0.5" /> Hot
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] shrink-0">
                                        <Snowflake className="w-2.5 h-2.5 mr-0.5" /> Cool
                                      </Badge>
                                    )
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(session.start_time)} – {formatTime(session.end_time)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {isFull ? (
                                      <span className="text-destructive font-medium">Full{waitlistCounts?.[session.id] ? ` · ${waitlistCounts[session.id]} waitlisted` : ""}</span>
                                    ) : (
                                      `${spotsLeft} spots`
                                    )}
                                  </span>
                                </div>

                                {instructor && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {instructor.first_name} {instructor.last_name}
                                  </p>
                                )}

                                {session.room && (
                                  <p className="text-xs text-muted-foreground/70 mt-0.5">{session.room}</p>
                                )}

                                {(
                                  <div className="mt-2">
                                    {bookedSessionIds.has(session.id) ? (
                                      <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                        Booked
                                      </Badge>
                                    ) : waitlistStatus?.[session.id] ? (
                                      <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700">
                                        Waitlist #{waitlistStatus[session.id].position}
                                      </Badge>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant={isFull ? "outline" : "default"}
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          if (!user) {
                                            navigate("/auth?redirect=/schedule");
                                            return;
                                          }
                                          const bookable: BookableSession = {
                                            id: session.id,
                                            session_date: session.session_date,
                                            start_time: session.start_time,
                                            end_time: session.end_time,
                                            max_capacity: session.max_capacity,
                                            current_enrollment: session.current_enrollment,
                                            room: session.room,
                                            is_cancelled: session.is_cancelled,
                                            class_type: {
                                              id: ct.id,
                                              name: ct.name,
                                              category: ct.category,
                                              description: ct.description,
                                              duration_minutes: ct.duration_minutes,
                                              is_heated: ct.is_heated,
                                              image_url: ct.image_url,
                                            },
                                            instructor: instructor ? {
                                              id: instructor.id,
                                              first_name: instructor.first_name,
                                              last_name: instructor.last_name,
                                              photo_url: null,
                                            } : null,
                                          };
                                          setSelectedSession(bookable);
                                          setBookingOpen(true);
                                        }}
                                      >
                                        {isFull ? "Join Waitlist" : "Book"}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <BookingModal
        session={selectedSession}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
      />
    </Layout>
  );
}
