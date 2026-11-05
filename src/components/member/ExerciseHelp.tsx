import { lazy, Suspense, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { exerciseKey, getExerciseMotion } from "@/lib/exerciseMotions";

const ExerciseDemo3D = lazy(() => import("./ExerciseDemo3D"));

interface Guide { setup: string; steps: string[]; breathing: string; mistakes: string[]; easier: string; harder: string }

export function ExerciseHelp({ name, equipment, open, onOpenChange }: {
  name: string; equipment?: string | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const motion = getExerciseMotion(name);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || guide) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      const db = supabase as any;
      const { data } = await db.from("exercise_form_guides").select("guide, media_url").eq("name_key", exerciseKey(name)).maybeSingle();
      if (data) { if (!cancelled) { setGuide(data.guide); setMediaUrl(data.media_url); setLoading(false); } return; }
      const { data: res, error } = await supabase.functions.invoke("exercise-form-guide", { body: { name, equipment } });
      if (cancelled) return;
      if (error || !res?.guide) setErr("The written guide isn't available right now.");
      else setGuide(res.guide.guide);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl leading-tight pr-6">{name}</DialogTitle>
          <DialogDescription>{equipment || "How to do it"}</DialogDescription>
        </DialogHeader>

        {mediaUrl ? (
          <video src={mediaUrl} className="w-full rounded-lg" controls playsInline muted loop autoPlay />
        ) : motion ? (
          <div className="space-y-2">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <ExerciseDemo3D motion={motion} />
            </Suspense>
            <p className="text-sm text-muted-foreground">{motion.cue}</p>
          </div>
        ) : null}

        {loading && <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>}
        {err && <p className="text-sm text-muted-foreground">{err}</p>}
        {guide && (
          <div className="space-y-4 text-sm">
            <section><h3 className="font-medium mb-1">Set up</h3><p className="text-muted-foreground">{guide.setup}</p></section>
            <section>
              <h3 className="font-medium mb-1">The movement</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">{guide.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
            <section><h3 className="font-medium mb-1">Breathing</h3><p className="text-muted-foreground">{guide.breathing}</p></section>
            {guide.mistakes?.length > 0 && (
              <section>
                <h3 className="font-medium mb-1">Common mistakes</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">{guide.mistakes.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </section>
            )}
            <section className="grid grid-cols-2 gap-3">
              <div><h3 className="font-medium mb-1">Easier</h3><p className="text-muted-foreground">{guide.easier}</p></div>
              <div><h3 className="font-medium mb-1">Harder</h3><p className="text-muted-foreground">{guide.harder}</p></div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
