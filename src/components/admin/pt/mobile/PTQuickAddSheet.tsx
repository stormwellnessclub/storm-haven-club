import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CalendarPlus, NotebookPen, LineChart, ListChecks, MessageSquare, Package, ChevronRight } from "lucide-react";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";
import { PTMLabel } from "./PTMobileUI";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Bottom-sheet quick actions, gated by the trainer's role. */
export function PTQuickAddSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const access = usePTMobileAccess();

  const actions = [
    { key: "book", label: "Book Session", icon: CalendarPlus, to: "/admin/pt/m/quick/book", allowed: access.canBookSessions },
    { key: "note", label: "Add Session Note", icon: NotebookPen, to: "/admin/pt/m/quick/note", allowed: access.canWriteNotes },
    { key: "progress", label: "Record Progress", icon: LineChart, to: "/admin/pt/m/quick/progress", allowed: access.canRecordProgress },
    { key: "task", label: "Create Task", icon: ListChecks, to: "/admin/pt/m/quick/task", allowed: access.canCreateTasks },
    { key: "message", label: "Message Client", icon: MessageSquare, to: "/admin/pt/m/quick/message", allowed: access.canMessageClients },
    { key: "package", label: "Assign Package", icon: Package, to: "/admin/pt/m/quick/package", allowed: access.canAssignPackages },
  ].filter((a) => a.allowed);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-pt-line bg-pt-cream px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-pt-line" />
        <SheetHeader className="text-left">
          <SheetTitle className="sr-only">Quick add</SheetTitle>
          <PTMLabel>Quick Actions</PTMLabel>
        </SheetHeader>
        <div className="mt-2 divide-y divide-pt-line overflow-hidden rounded-2xl border border-pt-line bg-pt-cream">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={() => {
                  onOpenChange(false);
                  navigate(a.to);
                }}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:bg-pt-beige/60"
              >
                <Icon className="h-5 w-5 text-pt-ink" strokeWidth={1.7} />
                <span className="flex-1 text-[15px] font-medium text-pt-ink">{a.label}</span>
                <ChevronRight className="h-4 w-4 text-pt-muted" />
              </button>
            );
          })}
          {actions.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-pt-muted">
              No quick actions available for your role.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
