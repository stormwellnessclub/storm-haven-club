import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Measurement } from "@/lib/aellaSculptProgress";

// Keep `from` bound to the client; an unbound `supabase.from` throws before any request is sent.
const db = (table: string) => (supabase as any).from(table);
const BUCKET = "spa-progress-photos";

export interface SculptProgressPhoto { id: string; progress_id: string; storage_path: string; view_label: string; created_at: string; url?: string | null }
export interface SculptProgress {
  id: string; appointment_id: string; user_id: string | null; zone_name: string | null; recorded_on: string; treatment_number: number | null;
  measurements: Measurement[]; modalities: string[]; client_response: string | null; provider_notes: string | null;
  recorded_by_name: string | null; updated_at: string; photos: SculptProgressPhoto[];
}
export interface SculptVisit {
  id: string; appointment_date: string; appointment_time: string | null; status: string; treatment_zone_name: string | null;
  duration_minutes: number | null; client_package_id: string | null; therapist: string | null; room: string | null;
}

/** All of a client's Aella Sculpt appointments (any status), oldest first. Staff only by RLS. */
export function useSculptVisits(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["sculpt-visits", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SculptVisit[]> => {
      const { data: svc, error: e1 } = await db("spa_services").select("id").eq("service_key", "aella-sculpt");
      if (e1) throw e1;
      const ids = (svc ?? []).map((s: any) => s.id);
      if (!ids.length) return [];
      const { data, error } = await db("spa_appointments")
        .select("id, appointment_date, appointment_time, status, treatment_zone_name, duration_minutes, client_package_id, spa_therapists(full_name), spa_rooms(name)")
        .eq("user_id", userId).in("service_id", ids)
        .order("appointment_date").order("appointment_time");
      if (error) throw error;
      return (data ?? []).map((a: any) => ({ ...a, therapist: a.spa_therapists?.full_name ?? null, room: a.spa_rooms?.name ?? null }));
    },
  });
}

/** Every progress record for the client with signed photo links (photos are private; links last an hour). */
export function useSculptProgressHistory(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["sculpt-progress", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SculptProgress[]> => {
      const { data, error } = await db("spa_sculpt_progress").select("*, photos:spa_sculpt_progress_photos(*)").eq("user_id", userId).order("recorded_on");
      if (error) throw error;
      const rows = (data ?? []) as SculptProgress[];
      const paths = rows.flatMap((r) => r.photos.map((p) => p.storage_path));
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
        rows.forEach((r) => r.photos.forEach((p) => { p.url = byPath.get(p.storage_path) ?? null; }));
      }
      rows.forEach((r) => r.photos.sort((a, b) => a.created_at.localeCompare(b.created_at)));
      return rows;
    },
  });
}

const refresh = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ["sculpt-progress"] });

export function useSaveSculptProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      appointmentId: string; recordedOn: string; treatmentNumber: number | null; measurements: Measurement[];
      modalities: string[]; clientResponse: string; providerNotes: string;
    }) => {
      const { data, error } = await db("spa_sculpt_progress").upsert({
        appointment_id: v.appointmentId, recorded_on: v.recordedOn, treatment_number: v.treatmentNumber,
        measurements: v.measurements, modalities: v.modalities,
        client_response: v.clientResponse.trim() || null, provider_notes: v.providerNotes.trim() || null,
      }, { onConflict: "appointment_id" }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => { refresh(qc); toast.success("Progress saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save progress"),
  });
}

export function useUploadProgressPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { progressId: string; userId: string; file: File; viewLabel: string }) => {
      if (!v.file.type.startsWith("image/")) throw new Error("Choose a photo file.");
      if (v.file.size > 10 * 1024 * 1024) throw new Error("Photos must be under 10 MB.");
      const ext = (v.file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${v.userId}/${v.progressId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, v.file, { contentType: v.file.type, upsert: false });
      if (up.error) throw new Error(/row-level|policy/i.test(up.error.message) ? "This client hasn't agreed to progress photography." : up.error.message);
      const { error } = await db("spa_sculpt_progress_photos").insert({ progress_id: v.progressId, user_id: v.userId, storage_path: path, view_label: v.viewLabel });
      if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
    },
    onSuccess: () => { refresh(qc); toast.success("Photo added"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not add the photo"),
  });
}

export function useDeleteProgressPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: SculptProgressPhoto) => {
      const { error } = await db("spa_sculpt_progress_photos").delete().eq("id", p.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([p.storage_path]);
    },
    onSuccess: () => { refresh(qc); toast.success("Photo removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove the photo"),
  });
}
