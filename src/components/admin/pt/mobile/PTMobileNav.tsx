import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Users, LineChart, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PTQuickAddSheet } from "./PTQuickAddSheet";

const ITEMS = [
  { to: "/admin/pt/m", label: "Today", icon: Home, end: true },
  { to: "/admin/pt/m/clients", label: "Clients", icon: Users, end: false },
  { to: "/admin/pt/m/progress", label: "Progress", icon: LineChart, end: false },
  { to: "/admin/pt/m/more", label: "More", icon: Menu, end: false },
];

/** Persistent five-item bottom navigation with a centre Quick Add action. */
export function PTMobileNav() {
  const [quickAdd, setQuickAdd] = useState(false);
  const location = useLocation();

  const item = (i: (typeof ITEMS)[number]) => {
    const active = i.end
      ? location.pathname === i.to || location.pathname === `${i.to}/`
      : location.pathname.startsWith(i.to);
    const Icon = i.icon;
    return (
      <NavLink
        key={i.to}
        to={i.to}
        className={cn(
          "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
          active ? "text-pt-gold" : "text-pt-cream/60"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
        {i.label}
      </NavLink>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pt-noir pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md items-center px-2">
          {item(ITEMS[0])}
          {item(ITEMS[1])}
          <div className="flex w-16 justify-center">
            <button
              type="button"
              aria-label="Quick add"
              onClick={() => setQuickAdd(true)}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-pt-gold text-pt-noir shadow-lg active:scale-95 transition-transform"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
          {item(ITEMS[2])}
          {item(ITEMS[3])}
        </div>
      </nav>
      <PTQuickAddSheet open={quickAdd} onOpenChange={setQuickAdd} />
    </>
  );
}
