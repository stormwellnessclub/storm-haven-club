import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { FOCUS_AREAS, getFocusAreaLabel } from "@/hooks/useSpaIntake";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * Front + back gender-neutral body diagram.
 * Each <ellipse>/<rect>/<path> represents one zone matching FOCUS_AREAS values.
 */
export function BodyDiagram({ selected, onChange }: Props) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const isSel = (v: string) => selected.includes(v);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 bg-muted/30 rounded-lg p-3 border">
        <BodyView side="front" isSel={isSel} toggle={toggle} />
        <BodyView side="back" isSel={isSel} toggle={toggle} />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="cursor-pointer pl-2 pr-1 py-1 gap-1"
              onClick={() => toggle(v)}
            >
              {getFocusAreaLabel(v)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Tap any area on the body to focus on it
      </p>
    </div>
  );
}

function BodyView({
  side,
  isSel,
  toggle,
}: {
  side: "front" | "back";
  isSel: (v: string) => boolean;
  toggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 120 280"
        className="w-full h-auto max-h-[340px]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body silhouette outline */}
        <BodyOutline />

        {side === "front" ? (
          <FrontZones isSel={isSel} toggle={toggle} />
        ) : (
          <BackZones isSel={isSel} toggle={toggle} />
        )}
      </svg>
      <span className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wide">
        {side}
      </span>
    </div>
  );
}

/* ─── Body silhouette (shared between front/back) ─── */
function BodyOutline() {
  return (
    <g
      className="fill-muted/40 stroke-border"
      strokeWidth={1}
    >
      {/* Head */}
      <ellipse cx="60" cy="20" rx="13" ry="15" />
      {/* Neck */}
      <rect x="55" y="33" width="10" height="8" />
      {/* Torso */}
      <path d="M 38 42 Q 36 50 38 60 L 35 110 Q 35 130 40 145 L 80 145 Q 85 130 85 110 L 82 60 Q 84 50 82 42 Q 70 38 60 38 Q 50 38 38 42 Z" />
      {/* Arms */}
      <path d="M 38 45 Q 28 55 25 80 L 23 130 Q 22 140 25 145 L 32 145 Q 33 138 33 130 L 36 90 Q 38 70 42 55 Z" />
      <path d="M 82 45 Q 92 55 95 80 L 97 130 Q 98 140 95 145 L 88 145 Q 87 138 87 130 L 84 90 Q 82 70 78 55 Z" />
      {/* Hips */}
      <path d="M 40 145 Q 38 155 40 165 L 80 165 Q 82 155 80 145 Z" />
      {/* Legs */}
      <path d="M 40 165 L 38 220 Q 38 250 42 270 L 56 270 Q 58 250 58 220 L 58 165 Z" />
      <path d="M 80 165 L 82 220 Q 82 250 78 270 L 64 270 Q 62 250 62 220 L 62 165 Z" />
      {/* Feet */}
      <ellipse cx="49" cy="274" rx="8" ry="4" />
      <ellipse cx="71" cy="274" rx="8" ry="4" />
    </g>
  );
}

/* ─── Front-side selectable zones ─── */
function FrontZones({
  isSel,
  toggle,
}: {
  isSel: (v: string) => boolean;
  toggle: (v: string) => void;
}) {
  return (
    <g>
      <Zone value="head_scalp" isSel={isSel} toggle={toggle}>
        <ellipse cx="60" cy="18" rx="11" ry="11" />
      </Zone>
      <Zone value="neck" isSel={isSel} toggle={toggle}>
        <rect x="54" y="33" width="12" height="9" rx="2" />
      </Zone>
      <Zone value="shoulders" isSel={isSel} toggle={toggle}>
        <path d="M 38 42 Q 50 38 60 38 Q 70 38 82 42 L 80 52 Q 70 48 60 48 Q 50 48 40 52 Z" />
      </Zone>
      <Zone value="chest" isSel={isSel} toggle={toggle}>
        <rect x="40" y="55" width="40" height="28" rx="4" />
      </Zone>
      <Zone value="abdomen" isSel={isSel} toggle={toggle}>
        <rect x="40" y="86" width="40" height="28" rx="4" />
      </Zone>
      <Zone value="arms" isSel={isSel} toggle={toggle}>
        <path d="M 25 60 Q 22 90 25 130 L 33 130 Q 33 100 36 75 L 36 60 Z" />
        <path d="M 95 60 Q 98 90 95 130 L 87 130 Q 87 100 84 75 L 84 60 Z" />
      </Zone>
      <Zone value="hands" isSel={isSel} toggle={toggle}>
        <ellipse cx="27" cy="143" rx="7" ry="6" />
        <ellipse cx="93" cy="143" rx="7" ry="6" />
      </Zone>
      <Zone value="hips" isSel={isSel} toggle={toggle}>
        <path d="M 40 145 Q 38 158 40 168 L 80 168 Q 82 158 80 145 Z" />
      </Zone>
      <Zone value="quads" isSel={isSel} toggle={toggle}>
        <rect x="40" y="170" width="18" height="50" rx="4" />
        <rect x="62" y="170" width="18" height="50" rx="4" />
      </Zone>
      <Zone value="calves" isSel={isSel} toggle={toggle}>
        <rect x="40" y="223" width="18" height="45" rx="4" />
        <rect x="62" y="223" width="18" height="45" rx="4" />
      </Zone>
      <Zone value="feet" isSel={isSel} toggle={toggle}>
        <ellipse cx="49" cy="274" rx="9" ry="5" />
        <ellipse cx="71" cy="274" rx="9" ry="5" />
      </Zone>
    </g>
  );
}

/* ─── Back-side selectable zones ─── */
function BackZones({
  isSel,
  toggle,
}: {
  isSel: (v: string) => boolean;
  toggle: (v: string) => void;
}) {
  return (
    <g>
      <Zone value="head_scalp" isSel={isSel} toggle={toggle}>
        <ellipse cx="60" cy="18" rx="11" ry="11" />
      </Zone>
      <Zone value="neck" isSel={isSel} toggle={toggle}>
        <rect x="54" y="33" width="12" height="9" rx="2" />
      </Zone>
      <Zone value="shoulders" isSel={isSel} toggle={toggle}>
        <path d="M 38 42 Q 50 38 60 38 Q 70 38 82 42 L 80 52 Q 70 48 60 48 Q 50 48 40 52 Z" />
      </Zone>
      <Zone value="upper_back" isSel={isSel} toggle={toggle}>
        <rect x="40" y="55" width="40" height="22" rx="4" />
      </Zone>
      <Zone value="mid_back" isSel={isSel} toggle={toggle}>
        <rect x="40" y="80" width="40" height="22" rx="4" />
      </Zone>
      <Zone value="lower_back" isSel={isSel} toggle={toggle}>
        <rect x="40" y="105" width="40" height="22" rx="4" />
      </Zone>
      <Zone value="arms" isSel={isSel} toggle={toggle}>
        <path d="M 25 60 Q 22 90 25 130 L 33 130 Q 33 100 36 75 L 36 60 Z" />
        <path d="M 95 60 Q 98 90 95 130 L 87 130 Q 87 100 84 75 L 84 60 Z" />
      </Zone>
      <Zone value="hands" isSel={isSel} toggle={toggle}>
        <ellipse cx="27" cy="143" rx="7" ry="6" />
        <ellipse cx="93" cy="143" rx="7" ry="6" />
      </Zone>
      <Zone value="glutes" isSel={isSel} toggle={toggle}>
        <path d="M 40 145 Q 38 162 42 172 L 78 172 Q 82 162 80 145 Z" />
      </Zone>
      <Zone value="hamstrings" isSel={isSel} toggle={toggle}>
        <rect x="40" y="174" width="18" height="46" rx="4" />
        <rect x="62" y="174" width="18" height="46" rx="4" />
      </Zone>
      <Zone value="calves" isSel={isSel} toggle={toggle}>
        <rect x="40" y="223" width="18" height="45" rx="4" />
        <rect x="62" y="223" width="18" height="45" rx="4" />
      </Zone>
      <Zone value="feet" isSel={isSel} toggle={toggle}>
        <ellipse cx="49" cy="274" rx="9" ry="5" />
        <ellipse cx="71" cy="274" rx="9" ry="5" />
      </Zone>
    </g>
  );
}

/* ─── Selectable zone wrapper ─── */
function Zone({
  value,
  isSel,
  toggle,
  children,
}: {
  value: string;
  isSel: (v: string) => boolean;
  toggle: (v: string) => void;
  children: React.ReactNode;
}) {
  const selected = isSel(value);
  const label = getFocusAreaLabel(value);
  return (
    <g
      onClick={() => toggle(value)}
      className={cn(
        "cursor-pointer transition-opacity",
        selected
          ? "fill-accent stroke-accent opacity-80"
          : "fill-transparent stroke-transparent hover:fill-accent/30 hover:stroke-accent/60",
      )}
      strokeWidth={1.5}
    >
      <title>{label}</title>
      {children}
    </g>
  );
}
