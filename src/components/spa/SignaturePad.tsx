import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
}

/** Finger / mouse signature box. Emits a PNG data URL. */
export function SignaturePad({ value, onChange, label = "Sign here" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    c.width = w * ratio;
    c.height = h * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).color;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <canvas
        ref={ref}
        className="w-full h-32 rounded-md border bg-background text-foreground touch-none cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (dirty.current) onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          const c = ref.current;
          if (!c) return;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          dirty.current = false;
          onChange(null);
        }}
      >
        Clear signature
      </Button>
    </div>
  );
}
