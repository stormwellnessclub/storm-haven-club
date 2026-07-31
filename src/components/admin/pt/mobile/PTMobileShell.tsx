import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PTMobileNav } from "./PTMobileNav";

interface Props {
  title: string;
  children: ReactNode;
  /** Show a back chevron in the header */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  /** Hide the bottom tab bar (used by immersive session modes) */
  hideNav?: boolean;
  /** Extra content rendered inside the dark header (progress steppers, timers…) */
  headerAccessory?: ReactNode;
  className?: string;
}

/**
 * Mobile app shell for the PT trainer app.
 * Dark noir header + cream content + persistent bottom navigation, with safe-area support.
 */
export function PTMobileShell({
  title,
  children,
  back,
  onBack,
  right,
  hideNav,
  headerAccessory,
  className,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="pt-portal min-h-[100dvh] overflow-x-hidden bg-pt-cream">
      <header className="sticky top-0 z-30 bg-pt-noir pt-[env(safe-area-inset-top)] text-pt-cream">
        <div className="relative flex h-14 items-center justify-center px-2">
          {back && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => (onBack ? onBack() : navigate(-1))}
              className="absolute left-1 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="truncate px-12 text-[15px] font-semibold uppercase tracking-[0.16em]">{title}</h1>
          {right && <div className="absolute right-1 flex items-center">{right}</div>}
        </div>
        {headerAccessory}
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-md px-4 pt-4",
          hideNav ? "pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" : "pb-[calc(env(safe-area-inset-bottom)+6.5rem)]",
          className
        )}
      >
        {children}
      </main>

      {!hideNav && <PTMobileNav />}
    </div>
  );
}
