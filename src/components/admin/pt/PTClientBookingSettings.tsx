import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PTCard, PTSectionTitle, PTBadge, PTAlert } from "@/components/admin/pt/PTUI";
import {
  CLUB_MODE_OPTIONS, TRAINER_MODE_OPTIONS, INSTANT_NOT_READY_MESSAGE, CLIENT_MODE_LABEL,
  type ClubBookingMode, type TrainerBookingMode,
} from "@/lib/ptClientBooking";

interface AdminState {
  global_mode: ClubBookingMode;
  instant_ready: boolean;
  trainers: { id: string; name: string; is_pt_trainer: boolean; override: TrainerBookingMode; effective: ClubBookingMode }[];
}

const KEY = ["pt-client-booking-admin"];

/** CLIENT PT BOOKING — club-wide mode plus optional per-trainer overrides. Never touches appointments or requests. */
export function PTClientBookingSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_client_booking_admin_state");
      if (error) throw error;
      return data as AdminState;
    },
  });

  const setGlobal = useMutation({
    mutationFn: async (mode: ClubBookingMode) => {
      const { error } = await (supabase as any).rpc("pt_set_client_booking_mode", { p_mode: mode });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Client booking updated"); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setTrainer = useMutation({
    mutationFn: async (args: { id: string; mode: TrainerBookingMode }) => {
      const { error } = await (supabase as any).rpc("pt_set_trainer_client_booking_mode", { p_instructor_id: args.id, p_mode: args.mode });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trainer booking updated"); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: any) => toast.error(e.message),
  });

  const instantSelected = data?.global_mode === "instant" || data?.trainers.some((t) => t.override === "instant");

  return (
    <>
      <PTSectionTitle>Client PT Booking</PTSectionTitle>
      <PTCard className="mb-8 space-y-5">
        <p className="text-[13px] text-pt-muted">
          Controls what current personal training clients — members and non-members — can do from their portal.
          Changing it never moves, cancels or edits existing appointments or requests. The public training inquiry form is not affected.
        </p>

        {error && <PTAlert tone="danger" title="Could not load client booking settings">{String((error as any).message)}</PTAlert>}

        <div>
          <div className="text-[13px] font-medium text-pt-ink mb-2">Client Booking</div>
          <div className="grid gap-3 md:grid-cols-3">
            {CLUB_MODE_OPTIONS.map((o) => {
              const active = data?.global_mode === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={isLoading || setGlobal.isPending}
                  onClick={() => !active && setGlobal.mutate(o.value)}
                  aria-pressed={active}
                  className={cn(
                    "text-left rounded-xl border p-4 transition-colors disabled:opacity-60",
                    active ? "border-pt-gold bg-pt-beige/60" : "border-pt-line bg-white hover:border-pt-gold",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-pt-ink">{o.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-pt-gold" />}
                  </div>
                  <p className="text-xs text-pt-muted mt-1">{o.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {data && instantSelected && !data.instant_ready && (
          <PTAlert tone="warning" title={INSTANT_NOT_READY_MESSAGE}>
            Direct booking stays turned off. Clients set to instant booking see no booking option until setup is finished.
          </PTAlert>
        )}

        <div>
          <div className="text-[13px] font-medium text-pt-ink mb-1">Per-trainer setting</div>
          <p className="text-xs text-pt-muted mb-3">
            Lets one trainer open up before another. When Client Booking is Off, no trainer is bookable.
          </p>
          <div className="divide-y divide-pt-line rounded-xl border border-pt-line">
            {(data?.trainers ?? []).map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] text-pt-ink">{t.name}</div>
                  {!t.is_pt_trainer && (
                    <div className="text-[11px] text-pt-muted">Not set up as a PT trainer — only bookable if set directly</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <PTBadge tone={t.effective === "off" ? "neutral" : "green"}>{CLIENT_MODE_LABEL[t.effective]}</PTBadge>
                  <select
                    aria-label={`Client booking for ${t.name}`}
                    value={t.override}
                    disabled={setTrainer.isPending}
                    onChange={(e) => setTrainer.mutate({ id: t.id, mode: e.target.value as TrainerBookingMode })}
                    className="rounded-lg border border-pt-line bg-white px-2.5 py-1.5 text-[13px] text-pt-ink"
                  >
                    {TRAINER_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {!isLoading && (data?.trainers ?? []).length === 0 && (
              <div className="px-4 py-3 text-[13px] text-pt-muted">No active trainers.</div>
            )}
          </div>
        </div>
      </PTCard>
    </>
  );
}
