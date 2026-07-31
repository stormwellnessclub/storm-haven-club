import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMLabel, PTMRow, PTMCard } from "@/components/admin/pt/mobile/PTMobileUI";
import { PTMConfirm } from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarPlus, NotebookPen, LineChart, Package, ListChecks, MessageSquare,
  Dumbbell, ClipboardList, FileText, FolderOpen, Monitor, ChevronRight, BarChart3,
  Bell, UserCircle, LifeBuoy, LogOut, SlidersHorizontal,
} from "lucide-react";

interface MenuRow {
  label: string;
  hint?: string;
  icon: any;
  to?: string;
  onClick?: () => void;
  allowed: boolean;
  danger?: boolean;
}

export default function PTMMore() {
  const navigate = useNavigate();
  const access = usePTMobileAccess();
  const { user, signOut } = useAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const group = (label: string, rows: MenuRow[]) => {
    const visible = rows.filter((r) => r.allowed);
    if (!visible.length) return null;
    return (
      <section className="mb-6">
        <PTMLabel className="px-1 pb-2">{label}</PTMLabel>
        <div className="divide-y divide-pt-line overflow-hidden rounded-2xl border border-pt-line bg-pt-cream">
          {visible.map((r) => (
            <PTMRow
              key={label + r.label}
              icon={<r.icon className={`h-5 w-5 ${r.danger ? "text-pt-red" : ""}`} strokeWidth={1.7} />}
              title={<span className={r.danger ? "text-pt-red" : undefined}>{r.label}</span>}
              subtitle={r.hint}
              right={!r.danger ? <ChevronRight className="h-4 w-4 text-pt-muted" /> : undefined}
              onClick={() => (r.onClick ? r.onClick() : r.to && navigate(r.to))}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <PTMobileShell title="More">
      <PTMCard className="mb-5 p-4">
        <p className="text-[15px] font-semibold text-pt-ink">{user?.email ?? "Signed in"}</p>
        <p className="mt-0.5 text-[12px] capitalize text-pt-muted">
          {access.roles.length ? access.roles.join(" · ").replace(/_/g, " ") : "No roles assigned"}
        </p>
      </PTMCard>

      {group("Quick Actions", [
        { label: "Book Session", icon: CalendarPlus, to: "/admin/pt/schedule", allowed: access.canBookSessions },
        { label: "Add Session Note", icon: NotebookPen, to: "/admin/pt/session-notes", allowed: access.canWriteNotes },
        { label: "Record Progress", icon: LineChart, to: "/admin/pt/m/progress", allowed: access.canRecordProgress },
        { label: "Assign Package", icon: Package, to: "/admin/pt/packages", allowed: access.canAssignPackages },
        { label: "Create Task", icon: ListChecks, to: "/admin/pt/tasks", allowed: access.canCreateTasks },
        { label: "Message Client", icon: MessageSquare, to: "/admin/pt/messages", allowed: access.canMessageClients },
      ])}

      {group("Tools", [
        { label: "Exercise Library", icon: Dumbbell, to: "/admin/pt/library", allowed: access.canManageSessions },
        { label: "Program Templates", icon: ClipboardList, to: "/admin/pt/programs", allowed: access.canManageSessions },
        { label: "Client Forms", hint: "Intake, PAR-Q and reassessments", icon: FileText, to: "/admin/pt/reassessments", allowed: access.canManageSessions },
        { label: "Documents", hint: "Waivers and uploads by client", icon: FolderOpen, to: "/admin/pt/m/clients", allowed: access.canManageSessions },
        { label: "Tasks", icon: ListChecks, to: "/admin/pt/tasks", allowed: access.canCreateTasks },
        { label: "Messages", icon: MessageSquare, to: "/admin/pt/messages", allowed: access.canMessageClients },
        { label: "Reports", icon: BarChart3, to: "/admin/pt/reports", allowed: access.canViewReports },
      ])}

      {group("Settings", [
        { label: "Preferences", icon: SlidersHorizontal, to: "/admin/pt/settings", allowed: true },
        { label: "Notifications", icon: Bell, to: "/admin/pt/settings?tab=notifications", allowed: true },
        { label: "Account", icon: UserCircle, to: "/admin/settings", allowed: access.isAdmin },
        { label: "Help and Support", hint: "Email the Storm operations team", icon: LifeBuoy, allowed: true, onClick: () => { window.location.href = "mailto:info@stormwellnessclub.com?subject=PT%20Portal%20Support"; } },
        { label: "Open desktop portal", icon: Monitor, to: "/admin/pt", allowed: true },
        { label: "Sign Out", icon: LogOut, allowed: true, danger: true, onClick: () => setSignOutOpen(true) },
      ])}

      <PTMConfirm
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out?"
        description="You'll need to sign in again to access the trainer app."
        confirmLabel="Sign out"
        destructive
        onConfirm={async () => {
          setSignOutOpen(false);
          await signOut();
          navigate("/auth");
        }}
      />
    </PTMobileShell>
  );
}
