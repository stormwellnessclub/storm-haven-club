import { useState } from "react";
import { KioskShell } from "@/components/kiosk/KioskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import { Button } from "@/components/ui/button";
import AdminClasses from "@/pages/admin/Classes";
import ClassSchedules from "@/pages/admin/ClassSchedules";
import ClassTypes from "@/pages/admin/ClassTypes";
import Instructors from "@/pages/admin/Instructors";

type Tab = "today" | "schedules" | "types" | "instructors";

const TABS: { key: Tab; label: string }[] = [
  { key: "today",       label: "Today's Sessions" },
  { key: "schedules",   label: "Recurring Schedules" },
  { key: "types",       label: "Class Types" },
  { key: "instructors", label: "Instructors" },
];

export default function KioskClasses() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <KioskShell label="Classes • Sessions & Rosters" mode="classes">
      <div className="border-b bg-card overflow-x-auto">
        <div className="px-4 py-2 flex items-center gap-2 min-w-max">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <BareAdminLayoutProvider>
        {tab === "today" && <AdminClasses />}
        {tab === "schedules" && <ClassSchedules />}
        {tab === "types" && <ClassTypes />}
        {tab === "instructors" && <Instructors />}
      </BareAdminLayoutProvider>
    </KioskShell>
  );
}
