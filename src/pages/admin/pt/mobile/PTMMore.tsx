import { useNavigate } from "react-router-dom";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMLabel, PTMRow } from "@/components/admin/pt/mobile/PTMobileUI";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";
import {
  CalendarPlus, NotebookPen, LineChart, Package, ListChecks, MessageSquare,
  Dumbbell, ClipboardList, FileText, Monitor, ChevronRight, BarChart3,
} from "lucide-react";

export default function PTMMore() {
  const navigate = useNavigate();
  const access = usePTMobileAccess();

  const group = (label: string, rows: { label: string; icon: any; to: string; allowed: boolean }[]) => {
    const visible = rows.filter((r) => r.allowed);
    if (!visible.length) return null;
    return (
      <section className="mb-6">
        <PTMLabel className="px-1 pb-2">{label}</PTMLabel>
        <div className="divide-y divide-pt-line overflow-hidden rounded-2xl border border-pt-line bg-pt-cream">
          {visible.map((r) => (
            <PTMRow
              key={r.to + r.label}
              icon={<r.icon className="h-5 w-5" strokeWidth={1.7} />}
              title={r.label}
              right={<ChevronRight className="h-4 w-4 text-pt-muted" />}
              onClick={() => navigate(r.to)}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <PTMobileShell title="More">
      {group("Quick Actions", [
        { label: "Book Session", icon: CalendarPlus, to: "/admin/pt/schedule", allowed: access.canBookSessions },
        { label: "Add Session Note", icon: NotebookPen, to: "/admin/pt/session-notes", allowed: access.canWriteNotes },
        { label: "Record Progress", icon: LineChart, to: "/admin/pt/progress", allowed: access.canRecordProgress },
        { label: "Assign Package", icon: Package, to: "/admin/pt/packages", allowed: access.canAssignPackages },
        { label: "Create Task", icon: ListChecks, to: "/admin/pt/tasks", allowed: access.canCreateTasks },
        { label: "Message Client", icon: MessageSquare, to: "/admin/pt/messages", allowed: access.canMessageClients },
      ])}

      {group("Tools", [
        { label: "Exercise Library", icon: Dumbbell, to: "/admin/pt/library", allowed: access.canManageSessions },
        { label: "Program Templates", icon: ClipboardList, to: "/admin/pt/programs", allowed: access.canManageSessions },
        { label: "Reassessments", icon: FileText, to: "/admin/pt/reassessments", allowed: access.canManageSessions },
        { label: "Reports", icon: BarChart3, to: "/admin/pt/reports", allowed: access.canViewReports },
      ])}

      {group("Settings", [
        { label: "Preferences", icon: Monitor, to: "/admin/pt/settings", allowed: true },
        { label: "Open desktop portal", icon: Monitor, to: "/admin/pt", allowed: true },
      ])}
    </PTMobileShell>
  );
}
