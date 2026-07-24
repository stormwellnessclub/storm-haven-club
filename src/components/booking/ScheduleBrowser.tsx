import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  startOfWeek, addDays, addWeeks, format, isBefore, startOfDay, isToday, parseISO,
} from "date-fns";
import { isSessionFinishedToday } from "@/lib/classSessionFilters";
import {
  ChevronLeft, ChevronRight, Clock, Users, Flame, Snowflake, Heart,
  CircleDot, Bike, Activity, CalendarDays, CalendarIcon, MapPin, Info, Crown,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/booking/BookingModal";
import { ResumeBookingBanner } from "@/components/booking/ResumeBookingBanner";
import { ClassDetailsSheet, ClassDetailsData } from "@/components/booking/ClassDetailsSheet";
import { ClassSession as BookableSession } from "@/hooks/useClassSessions";
import type { ClassBookingDraft } from "@/lib/bookingDraft";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useMyBookings } from "@/hooks/useBooking";
import { useWaitlistStatus, useWaitlistCounts } from "@/hooks/useWaitlist";

type RoomFilter = "all" | "Reformer Studio" | "Cycle Studio" | "Aerobics Studio";
type HeatFilter = "all" | "heated" | "non_heated";
type SignatureFilter = "all" | "signature";

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
  is_fundraiser?: boolean;
  is_invite_only?: boolean;
  fundraiser_beneficiary?: string | null;
  session_notes?: string | null;
  override_price_cents?: number | null;
  class_types: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    duration_minutes: number;
    is_heated: boolean;
    is_signature: boolean;
    image_url: string | null;
  };
  instructors: {
    id: string;
    first_name: string;
    last_name: string;
    is_master: boolean;
  } | null;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

interface ScheduleBrowserProps {
  /**
   * When embedded inside a portal page (Book Class), we drop the sticky offset
   * and outer padding so it sits flush with the surrounding container.
   */
  embedded?: boolean;
  /** Path used for the auth redirect param when the user is not signed in. */
  authRedirect?: string;
}

export function ScheduleBrowser({ embedded = false, authRedirect = "/schedule" }: ScheduleBrowserProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const todayRef = React.useRef<HTMLDivElement>(null);
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");
  const [heatFilter, setHeatFilter] = useState<HeatFilter>("all");
  const [signatureFilter, setSignatureFilter] = useState<SignatureFilter>("all");
  const [selectedSession, setSelectedSession] = useState<BookableSession | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<ClassDetailsData | null>(null);
  const sessionMapRef = useRef<Map<string, BookableSession>>(new Map());

  const buildBookable = (session: ClassSession): BookableSession => {
    const ct = session.class_types;
    return {
      id: session.id,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      max_capacity: session.max_capacity,
      current_enrollment: session.current_enrollment,
      room: session.room,
      is_cancelled: session.is_cancelled,
      is_fundraiser: session.is_fundraiser,
      fundraiser_beneficiary: session.fundraiser_beneficiary,
      session_notes: session.session_notes,
      override_price_cents: session.override_price_cents,
      class_type: {
        id: ct.id,
        name: ct.name,
        category: ct.category,
        description: ct.description,
        duration_minutes: ct.duration_minutes,
        is_heated: ct.is_heated,
        is_signature: ct.is_signature,
        image_url: ct.image_url,
      },
      instructor: session.instructors
        ? {
            id: session.instructors.id,
            first_name: session.instructors.first_name,
            last_name: session.instructors.last_name,
            photo_url: null,
            is_master: session.instructors.is_master,
          }
        : null,
    };
  };

  const openDetailsFor = (
    session: ClassSession,
    extras: { isBooked: boolean; isOnWaitlist: boolean; waitlistCount?: number }
  ) => {
    const ct = session.class_types;
    const spotsLeft = session.max_capacity - session.current_enrollment;
    sessionMapRef.current.set(session.id, buildBookable(session));
    setDetailsData({
      sessionId: session.id,
      sessionDate: session.session_date,
      startTime: session.start_time,
      endTime: session.end_time,
      spotsLeft,
      isFull: spotsLeft <= 0,
      waitlistCount: extras.waitlistCount,
      room: session.room,
      classType: {
        id: ct.id,
        name: ct.name,
        category: ct.category,
        description: ct.description,
        duration_minutes: ct.duration_minutes,
        is_heated: ct.is_heated,
      },
      instructor: session.instructors
        ? { first_name: session.instructors.first_name, last_name: session.instructors.last_name }
        : null,
      isBooked: extras.isBooked,
      isOnWaitlist: extras.isOnWaitlist,
    });
    setDetailsOpen(true);
  };

  const handleBookFromDetails = (d: ClassDetailsData) => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(authRedirect)}`);
      return;
    }
    const bookable = sessionMapRef.current.get(d.sessionId);
    if (!bookable) return;
    setDetailsOpen(false);
    setSelectedSession(bookable);
    setBookingOpen(true);
  };

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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
          is_fundraiser, fundraiser_beneficiary, session_notes, override_price_cents, is_invite_only,
          class_types!inner(id, name, category, description, duration_minutes, is_heated, is_signature, image_url),
          instructors(id, first_name, last_name, is_master)
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
      .filter((s) => roomFilter === "all" || s.room === roomFilter)
      .filter((s) => {
        if (heatFilter === "all") return true;
        if (heatFilter === "heated") return s.class_types.is_heated === true;
        return s.class_types.is_heated === false;
      })
      .filter((s) => {
        if (signatureFilter === "all") return true;
        return s.class_types.is_signature === true || s.instructors?.is_master === true;
      });
  }, [sessions, roomFilter, heatFilter, signatureFilter]);

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

  const canGoPrev = !isBefore(addWeeks(weekStart, -1), startOfWeek(today, { weekStartsOn: 1 }));
  const maxWeekStart = useMemo(() => startOfWeek(addWeeks(today, 3), { weekStartsOn: 1 }), [today]);
  const maxSelectableDate = useMemo(() => addDays(addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 4), -1), [today]);
  const canGoNext = isBefore(weekStart, maxWeekStart);
  const atHorizon = !canGoNext;

  const visibleWeekDays = useMemo(() => {
    if (selectedDate) {
      return [startOfDay(selectedDate)];
    }
    return weekDays.filter((day) => !isBefore(day, today) || isToday(day));
  }, [weekDays, today, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const d = startOfDay(date);
      setSelectedDate(d);
      setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
      setCalendarOpen(false);
    }
  };

  useEffect(() => {
    if (todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [weekStart]);

  const handleResumeBooking = (draft: ClassBookingDraft) => {
    if (!draft?.sessionId) return;
    const found = sessions.find((s) => s.id === draft.sessionId);
    if (found) {
      const bookable = buildBookable(found);
      sessionMapRef.current.set(found.id, bookable);
      setSelectedSession(bookable);
      setBookingOpen(true);
      return;
    }
    if (draft.sessionDate) {
      try {
        const d = startOfDay(parseISO(draft.sessionDate));
        setSelectedDate(d);
        setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <>
      {/* Filters + Week Navigation */}
      <section
        className={
          embedded
            ? "py-3 bg-background border-b border-border sticky top-0 z-30"
            : "py-6 bg-background border-b border-border sticky top-20 z-40"
        }
      >
        <div className={embedded ? "" : "container mx-auto px-6"}>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all" as const, label: "All Studios", icon: null },
                  { value: "Reformer Studio" as const, label: "Reformer Pilates", icon: CircleDot },
                  { value: "Cycle Studio" as const, label: "Cycling", icon: Bike },
                  { value: "Aerobics Studio" as const, label: "Aerobics", icon: Activity },
                ].map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRoomFilter(r.value)}
                    className={`filter-badge flex items-center gap-1.5 ${roomFilter === r.value ? "filter-badge-active" : ""}`}
                  >
                    {r.icon && <r.icon className="w-3.5 h-3.5" />}
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {[
                  { value: "all" as const, label: "All", icon: null },
                  { value: "heated" as const, label: "Heated", icon: Flame },
                  { value: "non_heated" as const, label: "Non-heated", icon: Snowflake },
                ].map((h) => (
                  <button
                    key={h.value}
                    onClick={() => setHeatFilter(h.value)}
                    className={`filter-badge flex items-center gap-1.5 ${heatFilter === h.value ? "filter-badge-active" : ""}`}
                  >
                    {h.icon && <h.icon className="w-3.5 h-3.5" />}
                    {h.label}
                  </button>
                ))}
                <button
                  onClick={() => setSignatureFilter(signatureFilter === "signature" ? "all" : "signature")}
                  className={`filter-badge flex items-center gap-1.5 ${
                    signatureFilter === "signature"
                      ? "bg-gradient-to-r from-amber-500 to-amber-700 text-white border-amber-600 shadow-sm"
                      : "border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                  title="Classes taught by Storm's Master Instructors"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Signature
                </button>
                {(roomFilter !== "all" || heatFilter !== "all" || signatureFilter !== "all") && (
                  <button
                    onClick={() => { setRoomFilter("all"); setHeatFilter("all"); setSignatureFilter("all"); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedDate ? (
                <>
                  <span className="text-sm font-medium">
                    {format(selectedDate, "EEE, MMM d")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(null)}>
                    Week view
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, -1))} disabled={!canGoPrev}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[140px] sm:min-w-[180px] text-center">
                    {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))} disabled={!canGoNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const t = startOfDay(new Date());
                  setSelectedDate(t);
                  setWeekStart(startOfWeek(t, { weekStartsOn: 1 }));
                }}
              >
                Today
              </Button>

              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    weekStartsOn={1}
                    selected={selectedDate || undefined}
                    onSelect={handleDateSelect}
                    disabled={(date) => isBefore(startOfDay(date), today) || isBefore(maxSelectableDate, startOfDay(date))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule Grid */}
      <section className={embedded ? "py-6 bg-background" : "py-12 bg-background"}>
        <div className={embedded ? "" : "container mx-auto px-6"}>
          <ResumeBookingBanner kind="class" onResume={handleResumeBooking} />
          {!selectedDate && (
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 text-accent shrink-0" />
              <span>
                Booking is open through{" "}
                <span className="font-medium text-foreground">
                  {format(addDays(maxWeekStart, 6), "EEE, MMM d")}
                </span>
                . The next 4 weeks release{" "}
                <span className="font-medium text-foreground">
                  {format(addWeeks(maxWeekStart, 1), "EEE, MMM d")}
                </span>
                .
              </span>
            </div>
          )}
          {atHorizon && !selectedDate && (
            <div className="mb-6 flex items-start gap-3 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm">
              <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
              <p className="text-muted-foreground leading-relaxed">
                You've reached the end of the current booking window. More classes release on{" "}
                <span className="font-medium text-foreground">
                  {format(addWeeks(maxWeekStart, 1), "EEEE, MMMM d")}
                </span>
                . We release the schedule in <span className="font-medium text-foreground">4-week blocks</span> so instructors and room assignments stay accurate — check back then to book the next block.
              </p>
            </div>
          )}
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
              {/* Compact week strip — clickable day navigator */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 rounded-xl border border-border bg-card/50 p-1.5 sm:p-2">
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const count = (sessionsByDate[dateStr] || []).length;
                  const isPast = isBefore(day, today) && !isToday(day);
                  const isSelected = selectedDate && format(selectedDate, "yyyy-MM-dd") === dateStr;
                  const isTodayDay = isToday(day);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (isPast) return;
                        setSelectedDate(startOfDay(day));
                      }}
                      disabled={isPast}
                      className={[
                        "flex flex-col items-center justify-center rounded-lg py-2 px-1 text-center transition-all",
                        "border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : isTodayDay
                          ? "bg-accent/10 border-accent/40 text-foreground hover:bg-accent/15"
                          : isPast
                          ? "bg-transparent border-transparent text-muted-foreground/40 cursor-not-allowed"
                          : "bg-transparent border-transparent text-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                        {format(day, "EEE")}
                      </span>
                      <span className="text-lg sm:text-xl font-serif leading-none mt-0.5">
                        {format(day, "d")}
                      </span>
                      <span
                        className={[
                          "text-[10px] mt-1 leading-none",
                          isSelected ? "text-primary-foreground/80" : count === 0 ? "text-muted-foreground/50" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {count === 0 ? "—" : `${count} ${count === 1 ? "class" : "classes"}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {visibleWeekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const daySessions = sessionsByDate[dateStr] || [];

                return (
                  <div key={dateStr} ref={isToday(day) ? todayRef : undefined}>
                    <div className="flex items-baseline justify-between gap-3 mb-4 pb-2 border-b border-border">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
                        <h2 className="font-serif text-xl sm:text-2xl">
                          {format(day, "EEEE")}
                          <span className="text-muted-foreground font-sans text-base font-normal ml-2">
                            {format(day, "MMMM d")}
                          </span>
                        </h2>
                        {isToday(day) && (
                          <Badge variant="outline" className="text-xs border-accent text-accent">
                            Today
                          </Badge>
                        )}
                      </div>
                      {daySessions.length > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {daySessions.length} {daySessions.length === 1 ? "class" : "classes"}
                        </span>
                      )}
                    </div>


                    {daySessions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 px-4 text-center text-sm text-muted-foreground">
                        No classes scheduled
                      </div>
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
                              className="card-luxury p-4 flex gap-3 cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() =>
                                openDetailsFor(session, {
                                  isBooked: bookedSessionIds.has(session.id),
                                  isOnWaitlist: !!waitlistStatus?.[session.id],
                                  waitlistCount: waitlistCounts?.[session.id],
                                })
                              }
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openDetailsFor(session, {
                                    isBooked: bookedSessionIds.has(session.id),
                                    isOnWaitlist: !!waitlistStatus?.[session.id],
                                    waitlistCount: waitlistCounts?.[session.id],
                                  });
                                }
                              }}
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.color.split(" ")[0]}`}>
                                <Icon className={`w-5 h-5 ${config.color.split(" ")[1]}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-serif text-base font-medium truncate">{ct.name}</h3>
                                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                    {(ct.is_signature || session.instructors?.is_master) && (
                                      <Badge className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-700 text-white border-0">
                                        <Crown className="w-2.5 h-2.5 mr-0.5" /> Signature
                                      </Badge>
                                    )}
                                    {session.is_invite_only && (
                                      <Badge className="text-[10px] bg-purple-600 hover:bg-purple-600 text-white">
                                        Invite Only
                                      </Badge>
                                    )}
                                    {session.is_fundraiser && (
                                      <Badge className="text-[10px] bg-rose-600 hover:bg-rose-600 text-white">
                                        <Heart className="w-2.5 h-2.5 mr-0.5" /> Fundraiser
                                      </Badge>
                                    )}
                                    {session.room && (
                                      <Badge variant="outline" className="text-[10px]">
                                        <MapPin className="w-2.5 h-2.5 mr-0.5" /> {session.room}
                                      </Badge>
                                    )}
                                    {ct.category !== "cycling" && (
                                      ct.is_heated ? (
                                        <Badge variant="outline" className="text-[10px] border-accent/50 text-accent bg-accent/10">
                                          <Flame className="w-2.5 h-2.5 mr-0.5" /> Hot
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px]">
                                          <Snowflake className="w-2.5 h-2.5 mr-0.5" /> Cool
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>

                                {session.is_fundraiser && (
                                  <div className="mt-1 rounded-md border border-rose-300/60 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 text-[11px] text-rose-900 dark:text-rose-100">
                                    <span className="font-semibold">
                                      {session.override_price_cents != null
                                        ? `$${(session.override_price_cents / 100).toFixed(0)} · `
                                        : ""}
                                      {session.fundraiser_beneficiary || "Fundraiser"}
                                    </span>
                                    <span className="block leading-snug">
                                      {session.session_notes || "100% of proceeds will be donated."}
                                    </span>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(session.start_time)} – {formatTime(session.end_time)}
                                  </span>
                                  {(() => {
                                    const wlc = waitlistCounts?.[session.id] ?? 0;
                                    if (isFull) {
                                      return (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium">
                                          <Users className="w-3 h-3" />
                                          Full{wlc > 0 ? ` · +${wlc} waitlisted` : ""}
                                        </span>
                                      );
                                    }
                                    const almostFull = spotsLeft <= 3;
                                    return (
                                      <span
                                        className={[
                                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                          almostFull
                                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                                        ].join(" ")}
                                      >
                                        <Users className="w-3 h-3" />
                                        {almostFull ? `Only ${spotsLeft} left` : `${spotsLeft} spots open`}
                                      </span>
                                    );
                                  })()}
                                </div>


                                {instructor && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {instructor.first_name} {instructor.last_name}
                                  </p>
                                )}


                                <Link
                                  to={`/classes/${ct.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-block mt-1 text-[11px] text-primary hover:underline"
                                >
                                  View class & reviews
                                </Link>

                                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                  {bookedSessionIds.has(session.id) ? (
                                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                      Booked
                                    </Badge>
                                  ) : session.is_invite_only ? (
                                    <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-700 dark:text-purple-300">
                                      Invite only — see front desk
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
                                          navigate(`/auth?redirect=${encodeURIComponent(authRedirect)}`);
                                          return;
                                        }
                                        setSelectedSession(buildBookable(session));
                                        setBookingOpen(true);
                                      }}
                                    >
                                      {isFull ? "Join Waitlist" : session.is_fundraiser ? "Donate & Reserve" : "Book"}
                                    </Button>
                                  )}
                                </div>
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

      <ClassDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        details={detailsData}
        onBook={handleBookFromDetails}
      />
    </>
  );
}
