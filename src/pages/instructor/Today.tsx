import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstructorContext } from "@/hooks/useInstructorContext";
import { InstructorShell } from "@/components/instructor/InstructorShell";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfDay, isAfter, parseISO } from "date-fns";
import { Link } from "react-router-dom";


interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  pay_type: "per_class" | "hourly" | "mixed";
  default_per_class_rate: number;
  hourly_rate: number;
}

interface Session {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  current_enrollment: number;
  max_capacity: number;
  class_type: { name: string } | null;
}

const CLUB_TZ = "America/Chicago";

function fmtTime(t: string) {
  // 09:00:00 → 9:00 AM
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, "h:mm a");
}

export default function InstructorToday() {
  const { instructor, isAdmin, loading: ctxLoading } = useInstructorContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading) return;
    if (!instructor) {
      setSessions([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const { data: sess } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, room, current_enrollment, max_capacity, class_type:class_types(name)")
        .eq("instructor_id", instructor.id)
        .gte("session_date", today)
        .lte("session_date", in7)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      setSessions((sess as unknown as Session[]) ?? []);
      setLoading(false);
    })();
  }, [instructor, ctxLoading]);


  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const todaySessions = sessions.filter((s) => s.session_date === todayStr);
  const upcomingToday = todaySessions.filter((s) => {
    const dt = parseISO(`${s.session_date}T${s.start_time}`);
    return isAfter(dt, now);
  });
  const nextClass = upcomingToday[0] ?? todaySessions[0] ?? sessions[0];
  const remainingToday = upcomingToday.slice(nextClass && upcomingToday[0]?.id === nextClass.id ? 1 : 0);

  // Weekly hours + pay estimate (rough — session duration × pay_type)
  const weekly = useMemo(() => {
    let hours = 0;
    let pay = 0;
    for (const s of sessions) {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      const dur = (eh + em / 60) - (sh + sm / 60);
      hours += dur;
      if (instructor) {
        if (instructor.pay_type === "hourly") pay += dur * (instructor.hourly_rate || 0);
        else pay += (instructor.default_per_class_rate || 0);
      }
    }
    return { hours: Math.round(hours * 10) / 10, pay: Math.round(pay * 100) / 100 };
  }, [sessions, instructor]);

  // Week strip — next 7 days
  const weekStrip = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(startOfDay(now), i);
      const dstr = format(d, "yyyy-MM-dd");
      const hasClass = sessions.some((s) => s.session_date === dstr);
      return { date: d, hasClass };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  if (loading) {
    return (
      <InstructorShell>
        <div className="p-12 text-sm text-gray-500">Loading your day…</div>
      </InstructorShell>
    );
  }

  if (!instructor) {
    return (
      <InstructorShell>
        <div className="p-12 max-w-lg">
          <h2 style={{ fontFamily: "'Instrument Serif', serif" }} className="text-3xl mb-3">
            Almost there
          </h2>
          <p className="text-sm text-gray-600">
            Your instructor profile hasn't been linked to this account yet. Ask the studio admin to invite you from the Instructors backend.
          </p>
        </div>
      </InstructorShell>
    );
  }

  return (
    <InstructorShell>
      <div className="p-6 md:p-12 max-w-6xl mx-auto">
        <header className="mb-12 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-[#C5A059]">
              {format(now, "EEEE, MMM d")}
            </p>
            <h2
              style={{ fontFamily: "'Instrument Serif', serif" }}
              className="text-4xl md:text-5xl font-light text-[#1A1A1A]"
            >
              Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {instructor.first_name}
            </h2>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="border-[#E5E2DD] rounded-none px-5 py-2 text-xs font-medium uppercase tracking-widest hover:bg-[#F5F2ED]"
              asChild
            >
              <Link to="/instructor/subs">Request Sub</Link>
            </Button>
            <Button
              className="bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 rounded-none px-5 py-2 text-xs font-medium uppercase tracking-widest text-white"
              disabled
              title="Available in Phase 3"
            >
              Clock In
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-10">
            {/* Up Next */}
            <section>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {upcomingToday.length ? "Up Next" : todaySessions.length ? "Today" : "Coming Up"}
              </h3>
              {nextClass ? (
                <div className="relative overflow-hidden bg-[#1A1A1A] p-6 md:p-8 text-white shadow-xl">
                  <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-sm font-light text-white/60">
                        {nextClass.session_date === todayStr ? "Today" : format(parseISO(nextClass.session_date), "EEE, MMM d")}
                        {" • "}
                        {fmtTime(nextClass.start_time)} — {fmtTime(nextClass.end_time)}
                      </p>
                      <h4
                        style={{ fontFamily: "'Instrument Serif', serif" }}
                        className="mt-1 text-3xl md:text-4xl"
                      >
                        {nextClass.class_type?.name ?? "Class"}
                      </h4>
                      <p className="mt-2 text-sm font-light text-white/60">
                        {nextClass.room ?? "Studio"} • {nextClass.current_enrollment}/{nextClass.max_capacity} booked
                      </p>
                    </div>
                    <Button
                      asChild
                      className="border border-[#C5A059] bg-transparent hover:bg-[#C5A059] hover:text-[#1A1A1A] rounded-none px-6 py-3 text-xs font-medium uppercase tracking-widest text-[#C5A059]"
                    >
                      <Link to={`/admin/class-roster/${nextClass.id}`}>View Roster</Link>
                    </Button>
                  </div>
                  <div className="absolute right-[-20px] top-[-20px] h-40 w-40 rounded-full border border-white/5" />
                </div>
              ) : (
                <div className="bg-[#F5F2ED] p-6 border border-[#E5E2DD] text-sm text-gray-600">
                  No classes scheduled in the next 7 days.
                </div>
              )}
            </section>

            {/* Today's remaining */}
            {remainingToday.length > 0 && (
              <section>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Your Teaching Today
                </h3>
                <div className="divide-y divide-[#E5E2DD] border-t border-[#E5E2DD]">
                  {remainingToday.map((s) => (
                    <Link
                      key={s.id}
                      to={`/admin/class-roster/${s.id}`}
                      className="flex items-center justify-between py-5 group"
                    >
                      <div className="flex items-baseline gap-6">
                        <span className="w-20 text-xs text-gray-500">{fmtTime(s.start_time)}</span>
                        <span className="text-lg font-medium group-hover:text-[#C5A059] transition-colors">
                          {s.class_type?.name ?? "Class"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {s.room ?? "—"} • {s.current_enrollment}/{s.max_capacity}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Announcements placeholder */}
            <section>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Club Announcements
              </h3>
              <div className="bg-[#F5F2ED] p-6 border border-[#E5E2DD]">
                <p className="text-xs font-medium text-[#C5A059] mb-1">Welcome</p>
                <p className="text-sm leading-relaxed text-[#1A1A1A]">
                  Welcome to your instructor portal. Your schedule, rosters, and pay will live here. More features roll out over the next two phases.
                </p>
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-10">
            {/* Weekly summary */}
            <div className="border border-[#E5E2DD] p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Next 7 Days
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500">Scheduled hours</p>
                  <p className="text-2xl">
                    {weekly.hours} <span className="text-sm text-gray-400">hrs</span>
                  </p>
                </div>
                <div className="pt-4 border-t border-[#E5E2DD]">
                  <p className="text-xs text-gray-500">
                    Estimated pay
                    <span className="ml-1 text-[10px] uppercase tracking-widest text-gray-400">
                      ({instructor.pay_type.replace("_", "-")})
                    </span>
                  </p>
                  <p
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                    className="text-3xl text-[#C5A059]"
                  >
                    ${weekly.pay.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Needs Attention (placeholder) */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Needs Attention
              </h3>
              <div className="bg-white border border-[#E5E2DD] p-4 text-xs text-gray-500">
                Nothing pending. Sub requests, expiring certs, and unsigned documents will appear here.
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/instructor/notes"
                className="flex flex-col items-center justify-center bg-[#F5F2ED] py-6 transition-colors hover:bg-[#E5E2DD]"
              >
                <span className="text-[10px] font-medium uppercase tracking-widest">Add Note</span>
              </Link>
              <Link
                to="/instructor/documents"
                className="flex flex-col items-center justify-center bg-[#F5F2ED] py-6 transition-colors hover:bg-[#E5E2DD]"
              >
                <span className="text-[10px] font-medium uppercase tracking-widest">My Docs</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Week strip */}
        <section className="mt-16 pt-8 border-t border-[#E5E2DD]">
          <h3 className="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-400 text-center">
            Week at a Glance
          </h3>
          <div className="flex justify-between">
            {weekStrip.map((d, i) => (
              <div key={i} className={`flex flex-col items-center space-y-2 ${d.hasClass ? "" : "opacity-30"}`}>
                <span className="text-[10px] text-gray-400 uppercase">{format(d.date, "EEE d")}</span>
                <div className={`h-1.5 w-1.5 rounded-full ${d.hasClass ? "bg-[#C5A059]" : "bg-transparent"}`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </InstructorShell>
  );
}
