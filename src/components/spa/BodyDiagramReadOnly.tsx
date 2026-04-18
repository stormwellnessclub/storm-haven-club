import { cn } from "@/lib/utils";
import { getFocusAreaLabel } from "@/hooks/useSpaIntake";

interface Props {
  selected: string[];
  className?: string;
}

/**
 * Compact non-interactive front+back body view used in the
 * therapist intake summary. Highlights only the selected zones.
 */
export function BodyDiagramReadOnly({ selected, className }: Props) {
  const isSel = (v: string) => selected.includes(v);

  return (
    <div className={cn("grid grid-cols-2 gap-2 max-w-[200px]", className)}>
      <MiniBody side="front" isSel={isSel} />
      <MiniBody side="back" isSel={isSel} />
    </div>
  );
}

function MiniBody({
  side,
  isSel,
}: {
  side: "front" | "back";
  isSel: (v: string) => boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 280" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <BodyOutline />
        {side === "front" ? <FrontHighlights isSel={isSel} /> : <BackHighlights isSel={isSel} />}
      </svg>
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
        {side}
      </span>
    </div>
  );
}

function BodyOutline() {
  return (
    <g className="fill-muted/40 stroke-border" strokeWidth={1}>
      <ellipse cx="60" cy="20" rx="13" ry="15" />
      <rect x="55" y="33" width="10" height="8" />
      <path d="M 38 42 Q 36 50 38 60 L 35 110 Q 35 130 40 145 L 80 145 Q 85 130 85 110 L 82 60 Q 84 50 82 42 Q 70 38 60 38 Q 50 38 38 42 Z" />
      <path d="M 38 45 Q 28 55 25 80 L 23 130 Q 22 140 25 145 L 32 145 Q 33 138 33 130 L 36 90 Q 38 70 42 55 Z" />
      <path d="M 82 45 Q 92 55 95 80 L 97 130 Q 98 140 95 145 L 88 145 Q 87 138 87 130 L 84 90 Q 82 70 78 55 Z" />
      <path d="M 40 145 Q 38 155 40 165 L 80 165 Q 82 155 80 145 Z" />
      <path d="M 40 165 L 38 220 Q 38 250 42 270 L 56 270 Q 58 250 58 220 L 58 165 Z" />
      <path d="M 80 165 L 82 220 Q 82 250 78 270 L 64 270 Q 62 250 62 220 L 62 165 Z" />
      <ellipse cx="49" cy="274" rx="8" ry="4" />
      <ellipse cx="71" cy="274" rx="8" ry="4" />
    </g>
  );
}

function H({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return null;
  return (
    <g className="fill-accent opacity-80 stroke-accent" strokeWidth={1}>
      {children}
    </g>
  );
}

function FrontHighlights({ isSel }: { isSel: (v: string) => boolean }) {
  return (
    <>
      <H on={isSel("head_scalp")}><ellipse cx="60" cy="18" rx="11" ry="11" /></H>
      <H on={isSel("neck")}><rect x="54" y="33" width="12" height="9" rx="2" /></H>
      <H on={isSel("shoulders")}><path d="M 38 42 Q 50 38 60 38 Q 70 38 82 42 L 80 52 Q 70 48 60 48 Q 50 48 40 52 Z" /></H>
      <H on={isSel("chest")}><rect x="40" y="55" width="40" height="28" rx="4" /></H>
      <H on={isSel("abdomen")}><rect x="40" y="86" width="40" height="28" rx="4" /></H>
      <H on={isSel("arms")}>
        <path d="M 25 60 Q 22 90 25 130 L 33 130 Q 33 100 36 75 L 36 60 Z" />
        <path d="M 95 60 Q 98 90 95 130 L 87 130 Q 87 100 84 75 L 84 60 Z" />
      </H>
      <H on={isSel("hands")}>
        <ellipse cx="27" cy="143" rx="7" ry="6" />
        <ellipse cx="93" cy="143" rx="7" ry="6" />
      </H>
      <H on={isSel("hips")}><path d="M 40 145 Q 38 158 40 168 L 80 168 Q 82 158 80 145 Z" /></H>
      <H on={isSel("quads")}>
        <rect x="40" y="170" width="18" height="50" rx="4" />
        <rect x="62" y="170" width="18" height="50" rx="4" />
      </H>
      <H on={isSel("calves")}>
        <rect x="40" y="223" width="18" height="45" rx="4" />
        <rect x="62" y="223" width="18" height="45" rx="4" />
      </H>
      <H on={isSel("feet")}>
        <ellipse cx="49" cy="274" rx="9" ry="5" />
        <ellipse cx="71" cy="274" rx="9" ry="5" />
      </H>
    </>
  );
}

function BackHighlights({ isSel }: { isSel: (v: string) => boolean }) {
  return (
    <>
      <H on={isSel("head_scalp")}><ellipse cx="60" cy="18" rx="11" ry="11" /></H>
      <H on={isSel("neck")}><rect x="54" y="33" width="12" height="9" rx="2" /></H>
      <H on={isSel("shoulders")}><path d="M 38 42 Q 50 38 60 38 Q 70 38 82 42 L 80 52 Q 70 48 60 48 Q 50 48 40 52 Z" /></H>
      <H on={isSel("upper_back")}><rect x="40" y="55" width="40" height="22" rx="4" /></H>
      <H on={isSel("mid_back")}><rect x="40" y="80" width="40" height="22" rx="4" /></H>
      <H on={isSel("lower_back")}><rect x="40" y="105" width="40" height="22" rx="4" /></H>
      <H on={isSel("arms")}>
        <path d="M 25 60 Q 22 90 25 130 L 33 130 Q 33 100 36 75 L 36 60 Z" />
        <path d="M 95 60 Q 98 90 95 130 L 87 130 Q 87 100 84 75 L 84 60 Z" />
      </H>
      <H on={isSel("hands")}>
        <ellipse cx="27" cy="143" rx="7" ry="6" />
        <ellipse cx="93" cy="143" rx="7" ry="6" />
      </H>
      <H on={isSel("glutes")}><path d="M 40 145 Q 38 162 42 172 L 78 172 Q 82 162 80 145 Z" /></H>
      <H on={isSel("hamstrings")}>
        <rect x="40" y="174" width="18" height="46" rx="4" />
        <rect x="62" y="174" width="18" height="46" rx="4" />
      </H>
      <H on={isSel("calves")}>
        <rect x="40" y="223" width="18" height="45" rx="4" />
        <rect x="62" y="223" width="18" height="45" rx="4" />
      </H>
      <H on={isSel("feet")}>
        <ellipse cx="49" cy="274" rx="9" ry="5" />
        <ellipse cx="71" cy="274" rx="9" ry="5" />
      </H>
    </>
  );
}
