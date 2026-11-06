import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Public-site editorial building blocks. Square edges, no shadows, no cards. */

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("transition-[opacity,transform] duration-[1400ms] ease-out motion-reduce:transition-none", shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4", className)}
    >
      {children}
    </div>
  );
}

/** Slow image reveal: a gentle settle from slight scale. */
export function EdImage({ src, alt, className, imgClassName, eager }: { src: string; alt: string; className?: string; imgClassName?: string; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!!eager);
  useEffect(() => {
    if (eager) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -5% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);
  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-secondary", className)}>
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1800ms] ease-out motion-reduce:transition-none",
          shown ? "opacity-100 scale-100" : "opacity-0 scale-[1.04]",
          imgClassName,
        )}
      />
    </div>
  );
}

export function Chapter({ n, label, className, light }: { n: string; label: string; className?: string; light?: boolean }) {
  return (
    <p className={cn("ed-caption flex items-center gap-4", light ? "text-primary-foreground/70" : "text-muted-foreground", className)}>
      <span>{n}</span>
      <span className={cn("h-px w-10", light ? "bg-primary-foreground/40" : "bg-foreground/30")} />
      <span>{label}</span>
    </p>
  );
}

export function Caption({ children, className, light }: { children: ReactNode; className?: string; light?: boolean }) {
  return <p className={cn("ed-caption mt-3", light ? "text-primary-foreground/60" : "text-muted-foreground", className)}>{children}</p>;
}

export function QuietLink({ to, children, light, className }: { to: string; children: ReactNode; light?: boolean; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-3 ed-caption pb-1 border-b transition-colors",
        light ? "text-primary-foreground border-primary-foreground/40 hover:border-primary-foreground" : "text-foreground border-foreground/30 hover:border-foreground",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
    </Link>
  );
}
