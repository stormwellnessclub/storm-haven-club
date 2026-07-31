import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Dumbbell, Library, NotebookPen, TrendingUp, ClipboardCheck } from "lucide-react";

const SECTIONS = [
  { label: "Program Builder", to: "/admin/pt/programs", icon: Dumbbell, end: true },
  { label: "Workout Library", to: "/admin/pt/library", icon: Library },
  { label: "Session Notes", to: "/admin/pt/session-notes", icon: NotebookPen },
  { label: "Progress Tracking", to: "/admin/pt/progress", icon: TrendingUp },
  { label: "Reassessments", to: "/admin/pt/reassessments", icon: ClipboardCheck },
];

/** Shared section switcher for the Programs & Progress workspace. */
export function PTWorkspaceNav() {
  return (
    <nav className="flex items-center gap-1 border-b border-pt-line mb-5 overflow-x-auto pt-scroll">
      {SECTIONS.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.end}
          className={({ isActive }) => cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] border-b-2 -mb-px transition-colors",
            isActive
              ? "border-pt-gold text-pt-ink font-medium"
              : "border-transparent text-pt-muted hover:text-pt-ink",
          )}
        >
          <s.icon className="h-3.5 w-3.5" />
          {s.label}
        </NavLink>
      ))}
    </nav>
  );
}
