import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────
export interface SpaService {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  cleanup_minutes: number;
  price: number;
  member_price: number | null;
  is_active: boolean;
  display_order: number;
  popular: boolean;
  requires_intake_form: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpaTherapist {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  specialties: string[];
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpaRoom {
  id: string;
  name: string;
  description: string | null;
  room_type: string;
  is_active: boolean;
  created_at: string;
}

export interface SpaTherapistService {
  id: string;
  therapist_id: string;
  service_id: string;
}

export interface SpaServiceAvailability {
  id: string;
  service_id: string;
  therapist_id: string | null;
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_bookings: number;
  is_active: boolean;
}

export interface SpaServiceAddon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  applicable_categories: string[];
  created_at: string;
}

// ─── Services ────────────────────────────────────────────────────────
export function useSpaServices() {
  return useQuery({
    queryKey: ["spa-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_services")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as SpaService[];
    },
  });
}

export function useUpdateSpaService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SpaService> & { id: string }) => {
      const { error } = await supabase
        .from("spa_services")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-services"] });
      toast.success("Service updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Therapists ──────────────────────────────────────────────────────
export function useSpaTherapists() {
  return useQuery({
    queryKey: ["spa-therapists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_therapists")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as SpaTherapist[];
    },
  });
}

export function useCreateSpaTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (therapist: Omit<SpaTherapist, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("spa_therapists").insert(therapist);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-therapists"] });
      toast.success("Therapist added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSpaTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SpaTherapist> & { id: string }) => {
      const { error } = await supabase
        .from("spa_therapists")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-therapists"] });
      toast.success("Therapist updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSpaTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spa_therapists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-therapists"] });
      toast.success("Therapist removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Rooms ───────────────────────────────────────────────────────────
export function useSpaRooms() {
  return useQuery({
    queryKey: ["spa-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_rooms")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SpaRoom[];
    },
  });
}

export function useCreateSpaRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (room: Omit<SpaRoom, "id" | "created_at">) => {
      const { error } = await supabase.from("spa_rooms").insert(room);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-rooms"] });
      toast.success("Room added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSpaRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SpaRoom> & { id: string }) => {
      const { error } = await supabase.from("spa_rooms").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-rooms"] });
      toast.success("Room updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSpaRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spa_rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-rooms"] });
      toast.success("Room removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Therapist–Service Assignments ───────────────────────────────────
export function useSpaTherapistServices() {
  return useQuery({
    queryKey: ["spa-therapist-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_therapist_services")
        .select("*");
      if (error) throw error;
      return data as SpaTherapistService[];
    },
  });
}

export function useAssignTherapistService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: { therapist_id: string; service_id: string }) => {
      const { error } = await supabase.from("spa_therapist_services").insert(assignment);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-therapist-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnassignTherapistService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ therapist_id, service_id }: { therapist_id: string; service_id: string }) => {
      const { error } = await supabase
        .from("spa_therapist_services")
        .delete()
        .eq("therapist_id", therapist_id)
        .eq("service_id", service_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-therapist-services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Availability ────────────────────────────────────────────────────
export function useSpaServiceAvailability() {
  return useQuery({
    queryKey: ["spa-service-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_service_availability")
        .select("*")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data as SpaServiceAvailability[];
    },
  });
}

export function useCreateSpaAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slot: Omit<SpaServiceAvailability, "id">) => {
      const { error } = await supabase.from("spa_service_availability").insert(slot);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-service-availability"] });
      toast.success("Availability slot added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSpaAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SpaServiceAvailability> & { id: string }) => {
      const { error } = await supabase.from("spa_service_availability").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-service-availability"] });
      toast.success("Availability updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSpaAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spa_service_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-service-availability"] });
      toast.success("Availability slot removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Add-ons ─────────────────────────────────────────────────────────
export function useSpaAddons() {
  return useQuery({
    queryKey: ["spa-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_service_addons")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SpaServiceAddon[];
    },
  });
}

export function useCreateSpaAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (addon: Omit<SpaServiceAddon, "id" | "created_at">) => {
      const { error } = await supabase.from("spa_service_addons").insert(addon);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-addons"] });
      toast.success("Add-on created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSpaAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SpaServiceAddon> & { id: string }) => {
      const { error } = await supabase.from("spa_service_addons").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-addons"] });
      toast.success("Add-on updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSpaAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spa_service_addons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-addons"] });
      toast.success("Add-on removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
