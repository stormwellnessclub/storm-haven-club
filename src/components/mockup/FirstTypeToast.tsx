import { useEffect } from "react";

interface Props {
  className: string | null;
  onClose: () => void;
}

export function FirstTypeToast({ className, onClose }: Props) {
  useEffect(() => {
    if (!className) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [className, onClose]);

  if (!className) return null;

  return (
    <div
      className="fixed top-6 right-6 z-[90] max-w-sm"
      style={{ animation: "mockup-slide-in 500ms cubic-bezier(0.22,1,0.36,1)" }}
    >
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-lg border border-[#c9a84c]/40"
        style={{
          background: "linear-gradient(135deg, #1a1a1a, #0d0d0d)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(201,168,76,0.2)",
        }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 48,
            height: 48,
            background: "radial-gradient(circle at 30% 30%, #f5e3a8, #c9a84c)",
            boxShadow: "0 0 16px rgba(201,168,76,0.5)",
          }}
        >
          <span className="text-[#1a1a1a] text-xl">★</span>
        </div>
        <div className="flex-1">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#c9a84c]">
            New Badge
          </div>
          <div className="font-serif text-lg text-[#f5f0e0] mt-0.5">
            First {className}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes mockup-slide-in {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
