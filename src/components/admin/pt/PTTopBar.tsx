import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, Search, Bell, MessageSquare, Plus, CalendarPlus, UserPlus, ListChecks,
  NotebookPen, TrendingUp, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PTDropdown, ptButtonClass } from "@/components/admin/pt/PTPrimitives";
import { PTGlobalSearchDialog } from "@/components/admin/pt/PTGlobalSearch";
import { usePTShellCounts } from "@/hooks/pt/usePTShell";
import { usePTStaffIdentity } from "@/components/admin/pt/PTSidebar";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";

function CountDot({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pt-gold text-pt-noir text-[10px] font-semibold grid place-items-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function PTTopBar({
  onToggleSidebar, onOpenMobileNav,
}: { onToggleSidebar: () => void; onOpenMobileNav: () => void }) {
  const navigate = useNavigate();
  const { data: counts } = usePTShellCounts();
  const { initials, name, roleLabel } = usePTStaffIdentity();
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const iconBtn = "relative grid place-items-center h-9 w-9 rounded-lg text-pt-muted hover:text-pt-ink hover:bg-pt-beige/60 transition-colors";

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-pt-line bg-pt-cream/85 backdrop-blur">
        <div className="h-full flex items-center gap-2 px-3 sm:px-5">
          <button type="button" onClick={onOpenMobileNav} className={cn(iconBtn, "lg:hidden")} aria-label="Open navigation">
            <Menu className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleSidebar} className={cn(iconBtn, "hidden lg:grid")} aria-label="Toggle sidebar">
            <Menu className="h-4 w-4" />
          </button>

          {/* Global search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex-1 max-w-xl flex items-center gap-2 h-9 rounded-lg border border-pt-line bg-white px-3 text-left text-[13px] text-pt-muted hover:border-pt-gold/60 transition-colors"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search clients, trainers, appointments, programs, packages</span>
            <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border border-pt-line bg-pt-beige/60 px-1.5 py-0.5 text-[10px] font-medium text-pt-muted">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className={iconBtn}
              aria-label="Notifications"
              onClick={() => navigate("/admin/pt/tasks")}
            >
              <Bell className="h-4 w-4" />
              <CountDot count={(counts?.unresolvedAlerts ?? 0) + (counts?.overdueTasks ?? 0)} />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label="Messages"
              onClick={() => navigate("/admin/pt/messages")}
            >
              <MessageSquare className="h-4 w-4" />
              <CountDot count={counts?.openMessages ?? 0} />
            </button>

            <PTDropdown
              label="Quick add"
              trigger={
                <button type="button" className={cn(ptButtonClass("primary"), "h-9")}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Quick Add</span>
                </button>
              }
              items={[
                { label: "Book Session", icon: CalendarPlus, onSelect: () => setBookOpen(true) },
                { label: "Add Client", icon: UserPlus, onSelect: () => navigate("/admin/pt/clients?new=1") },
                { label: "Create Task", icon: ListChecks, onSelect: () => navigate("/admin/pt/tasks?new=1") },
                { label: "Add Session Note", icon: NotebookPen, onSelect: () => navigate("/admin/pt/session-notes?new=1") },
                { label: "Record Progress", icon: TrendingUp, onSelect: () => navigate("/admin/pt/progress?new=1") },
                { label: "Sell or Assign Package", icon: Package, onSelect: () => setSellOpen(true), separatorBefore: true },
              ]}
            />

            <div className="ml-1 flex items-center gap-2 pl-2 border-l border-pt-line">
              <div className="hidden md:block text-right leading-tight">
                <div className="text-[12px] text-pt-ink truncate max-w-[140px]">{name}</div>
                <div className="text-[11px] text-pt-muted">{roleLabel}</div>
              </div>
              <span className="h-8 w-8 rounded-full bg-pt-noir text-pt-cream grid place-items-center text-[11px] font-semibold">
                {initials}
              </span>
            </div>
          </div>
        </div>
      </header>

      <PTGlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <BookPTSessionDialog open={bookOpen} onOpenChange={setBookOpen} />
      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
    </>
  );
}

export function usePTSearchHotkey(onOpen: () => void) {
  return onOpen;
}
