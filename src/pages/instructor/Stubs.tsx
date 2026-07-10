import { InstructorShell } from "@/components/instructor/InstructorShell";

interface StubProps {
  title: string;
  description: string;
}

export function InstructorStub({ title, description }: StubProps) {
  return (
    <InstructorShell>
      <div className="p-6 md:p-12 max-w-3xl">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-[#C5A059]">Coming next</p>
        <h2
          style={{ fontFamily: "'Instrument Serif', serif" }}
          className="text-4xl md:text-5xl font-light text-[#1A1A1A] mb-4"
        >
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">{description}</p>
      </div>
    </InstructorShell>
  );
}

export const InstructorSchedule = () => (
  <InstructorStub
    title="My Schedule"
    description="Month and week views of every class you're teaching. Ships in Phase 2 alongside the roster drawer and per-class notes."
  />
);
export const InstructorRosters = () => (
  <InstructorStub
    title="Rosters"
    description="Roster view with member / non-member / guest identity badges, mark no-shows, and per-attendee notes. Ships in Phase 2."
  />
);
export const InstructorAvailability = () => (
  <InstructorStub
    title="Availability"
    description="Set the weekly hours you're available to teach. Admin will see conflicts before scheduling. Ships in Phase 2."
  />
);
export const InstructorTimeOff = () => (
  <InstructorStub
    title="Time Off"
    description="Request time off, track approval, see history. Ships in Phase 2."
  />
);
export const InstructorSubs = () => (
  <InstructorStub
    title="Subs & Swaps"
    description="Request a sub, offer to cover, and track admin approval. Ships in Phase 2."
  />
);
export const InstructorNotes = () => (
  <InstructorStub
    title="Class Notes"
    description="Post-class notes on form cues, injuries, and attendance trends. Ships in Phase 2."
  />
);
export const InstructorPay = () => (
  <InstructorStub
    title="Hours & Pay"
    description="Current pay period, hours worked, estimated pay, and downloadable statements. Ships in Phase 3."
  />
);
export const InstructorMessages = () => (
  <InstructorStub
    title="Messages"
    description="Direct messaging with admin and the studio team. Ships in Phase 3."
  />
);
export const InstructorDocuments = () => (
  <InstructorStub
    title="Documents & Certifications"
    description="Upload CPR / cert / W-9 documents and get reminders before they expire. Ships in Phase 3."
  />
);
