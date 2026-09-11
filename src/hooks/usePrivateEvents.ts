import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export interface PrivateEventRequest {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  event_type: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  guest_count: number | null;
  spaces: string[];
  budget_range: string | null;
  notes: string | null;
  status: string;
  converted_event_id: string | null;
}

export interface PrivateEvent {
  id: string;
  created_at: string;
  updated_at: string;
  request_id: string | null;
  member_id: string | null;
  title: string;
  event_type: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number | null;
  spaces: string[];
  stage: string;
  internal_notes: string | null;
  flat_total_cents: number | null;
  tax_enabled: boolean;
  pass_processing_fee: boolean;
  deposit_type: string;
  deposit_value: number;
  balance_due_date: string | null;
}

export interface PrivateEventLineItem {
  id: string;
  event_id: string;
  label: string;
  quantity: number;
  unit_price_cents: number;
  taxable: boolean;
  sort_order: number;
}

export interface PrivateEventInvoice {
  id: string;
  event_id: string;
  kind: string;
  label: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
  pay_token: string;
  payment_method: string | null;
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PrivateEventTask {
  id: string;
  event_id: string;
  title: string;
  assignee: string | null;
  due_date: string | null;
  is_done: boolean;
  sort_order: number;
}

export interface PrivateEventActivity {
  id: string;
  event_id: string;
  kind: string;
  message: string;
  created_at: string;
}

export function usePrivateEventRequests() {
  return useQuery({
    queryKey: ["private-event-requests"],
    queryFn: async (): Promise<PrivateEventRequest[]> => {
      const { data, error } = await db
        .from("private_event_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePrivateEvents() {
  return useQuery({
    queryKey: ["private-events"],
    queryFn: async (): Promise<PrivateEvent[]> => {
      const { data, error } = await db
        .from("private_events")
        .select("*")
        .order("event_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePrivateEventDetail(eventId: string | null) {
  return useQuery({
    queryKey: ["private-event-detail", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [items, invoices, tasks, activity, blocks] = await Promise.all([
        db.from("private_event_line_items").select("*").eq("event_id", eventId).order("sort_order"),
        db.from("private_event_invoices").select("*").eq("event_id", eventId).order("created_at"),
        db.from("private_event_tasks").select("*").eq("event_id", eventId).order("sort_order"),
        db
          .from("private_event_activity")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),
        db.from("private_event_blocks").select("*").eq("event_id", eventId),
      ]);
      return {
        lineItems: (items.data ?? []) as PrivateEventLineItem[],
        invoices: (invoices.data ?? []) as PrivateEventInvoice[],
        tasks: (tasks.data ?? []) as PrivateEventTask[],
        activity: (activity.data ?? []) as PrivateEventActivity[],
        blocks: blocks.data ?? [],
      };
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (eventId?: string | null) => {
    qc.invalidateQueries({ queryKey: ["private-events"] });
    qc.invalidateQueries({ queryKey: ["private-event-requests"] });
    qc.invalidateQueries({ queryKey: ["private-event-detail", eventId ?? undefined] });
    qc.invalidateQueries({ queryKey: ["private-event-detail"] });
  };
}

export function usePrivateEventMutations() {
  const invalidate = useInvalidate();

  const createEvent = useMutation({
    mutationFn: async (payload: Partial<PrivateEvent>) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("private_events")
        .insert({ ...payload, created_by: userRes?.user?.id ?? null })
        .select("*")
        .single();
      if (error) throw error;
      await db.from("private_event_activity").insert({
        event_id: data.id,
        kind: "created",
        message: "Event created.",
      });
      return data as PrivateEvent;
    },
    onSuccess: (d) => {
      invalidate(d.id);
      toast.success("Event created");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create event"),
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PrivateEvent> & { id: string }) => {
      const { error } = await db.from("private_events").update(patch).eq("id", id);
      if (error) throw error;
      if (patch.stage) {
        await db.from("private_event_activity").insert({
          event_id: id,
          kind: "stage",
          message: `Stage changed to ${patch.stage.replace("_", " ")}.`,
        });
      }
      return id;
    },
    onSuccess: (id) => invalidate(id),
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("private_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Event deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not delete"),
  });

  const saveLineItems = useMutation({
    mutationFn: async ({
      eventId,
      items,
    }: {
      eventId: string;
      items: { id?: string; label: string; quantity: number; unit_price_cents: number; taxable: boolean }[];
    }) => {
      const { error: delErr } = await db.from("private_event_line_items").delete().eq("event_id", eventId);
      if (delErr) throw delErr;
      if (items.length > 0) {
        const { error } = await db.from("private_event_line_items").insert(
          items.map((i, idx) => ({
            event_id: eventId,
            label: i.label,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
            taxable: i.taxable,
            sort_order: idx,
          })),
        );
        if (error) throw error;
      }
      return eventId;
    },
    onSuccess: (id) => {
      invalidate(id);
      toast.success("Quote saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save quote"),
  });

  const createInvoice = useMutation({
    mutationFn: async (payload: {
      event_id: string;
      kind: string;
      label?: string | null;
      amount_cents: number;
      due_date?: string | null;
    }) => {
      const { data, error } = await db.from("private_event_invoices").insert(payload).select("*").single();
      if (error) throw error;
      return data as PrivateEventInvoice;
    },
    onSuccess: (d) => {
      invalidate(d.event_id);
      toast.success("Invoice created");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create invoice"),
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, event_id, ...patch }: Partial<PrivateEventInvoice> & { id: string; event_id: string }) => {
      const { error } = await db.from("private_event_invoices").update(patch).eq("id", id);
      if (error) throw error;
      return event_id;
    },
    onSuccess: (id) => invalidate(id),
    onError: (e: any) => toast.error(e.message ?? "Could not update invoice"),
  });

  const markInvoicePaidManually = useMutation({
    mutationFn: async ({
      id,
      event_id,
      method,
      amount_cents,
    }: {
      id: string;
      event_id: string;
      method: string;
      amount_cents: number;
    }) => {
      const { error } = await db
        .from("private_event_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString(), payment_method: method })
        .eq("id", id);
      if (error) throw error;
      await db.from("private_event_activity").insert({
        event_id,
        kind: "payment",
        message: `Payment of $${(amount_cents / 100).toFixed(2)} recorded (${method}).`,
      });
      return event_id;
    },
    onSuccess: (id) => {
      invalidate(id);
      toast.success("Payment recorded");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not record payment"),
  });

  const sendInvoice = useMutation({
    mutationFn: async ({ invoiceId, email }: { invoiceId: string; email?: string; eventId: string }) => {
      const { data, error } = await supabase.functions.invoke("private-event-invoice", {
        body: { action: "send_link", invoice_id: invoiceId, email },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, v) => {
      invalidate(v.eventId);
      toast.success("Invoice emailed");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not send invoice"),
  });

  const chargeSavedCard = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string; eventId: string }) => {
      const { data, error } = await supabase.functions.invoke("private-event-invoice", {
        body: { action: "charge_saved_card", invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, v) => {
      invalidate(v.eventId);
      toast.success("Card charged");
    },
    onError: (e: any) => toast.error(e.message ?? "Charge failed"),
  });

  const sendQuote = useMutation({
    mutationFn: async (payload: {
      eventId: string;
      email?: string;
      totalCents: number;
      depositCents: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("private-event-invoice", {
        body: {
          action: "send_quote",
          event_id: payload.eventId,
          email: payload.email,
          total_cents: payload.totalCents,
          deposit_cents: payload.depositCents,
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, v) => {
      invalidate(v.eventId);
      toast.success("Proposal emailed");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not send proposal"),
  });

  const upsertTask = useMutation({
    mutationFn: async (task: Partial<PrivateEventTask> & { event_id: string }) => {
      if (task.id) {
        const { id, ...patch } = task;
        const { error } = await db.from("private_event_tasks").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("private_event_tasks").insert(task);
        if (error) throw error;
      }
      return task.event_id;
    },
    onSuccess: (id) => invalidate(id),
    onError: (e: any) => toast.error(e.message ?? "Could not save task"),
  });

  const deleteTask = useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await db.from("private_event_tasks").delete().eq("id", id);
      if (error) throw error;
      return eventId;
    },
    onSuccess: (id) => invalidate(id),
  });

  const updateRequest = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; status?: string; converted_event_id?: string }) => {
      const { error } = await db.from("private_event_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    saveLineItems,
    createInvoice,
    updateInvoice,
    markInvoicePaidManually,
    sendInvoice,
    chargeSavedCard,
    sendQuote,
    upsertTask,
    deleteTask,
    updateRequest,
  };
}

export function usePrivateEventConflicts(date?: string | null, start?: string | null, end?: string | null, excludeId?: string | null) {
  return useQuery({
    queryKey: ["private-event-conflicts", date, start, end, excludeId],
    enabled: !!date && !!start && !!end,
    queryFn: async () => {
      const { data, error } = await db.rpc("private_event_conflicts", {
        p_date: date,
        p_start: start,
        p_end: end,
        p_exclude_event: excludeId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as { source: string; label: string; start_time: string; end_time: string }[];
    },
  });
}

export function useNewPrivateEventRequestCount() {
  const { data } = usePrivateEventRequests();
  return (data ?? []).filter((r) => r.status === "new").length;
}
