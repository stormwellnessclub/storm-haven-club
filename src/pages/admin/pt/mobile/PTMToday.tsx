import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMEmpty } from "@/components/admin/pt/mobile/PTMobileUI";
import { Bell } from "lucide-react";

/** 8B will build the full Today overview. */
export default function PTMToday() {
  return (
    <PTMobileShell
      title="Today"
      right={
        <button aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <Bell className="h-5 w-5" />
        </button>
      }
    >
      <PTMEmpty
        title="Today overview"
        description="Your sessions, up-next card and action items appear here."
      />
    </PTMobileShell>
  );
}
