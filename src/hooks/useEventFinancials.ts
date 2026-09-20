import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FinancialItem } from "@/lib/eventFinancials";

export type FinancialRow = any;

/** Every invoice across the club, joined to its event workspace. */
export function useAllEventInvoices() {
  return useQuery({
    queryKey: ["event-invoices-all"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_invoices")
        .select(
          "*, financial:event_financials(id, title, client_name, client_email, event_kind, assigned_staff_id, private_event_id, event_id)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFinancialRollups() {
  return useQuery({
    queryKey: ["event-financial-rollups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_financial_rollup")
        .select("*")
        .order("event_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFinancialWorkspace(financialId?: string) {
  return useQuery({
    queryKey: ["event-financial", financialId],
    enabled: !!financialId,
    queryFn: async () => {
      const [fin, items, invoices, payments, budget, docs, comms, activity] = await Promise.all([
        supabase.from("event_financials").select("*").eq("id", financialId!).maybeSingle(),
        supabase.from("event_financial_items").select("*").eq("financial_id", financialId!).order("sort_order"),
        supabase.from("event_invoices").select("*").eq("financial_id", financialId!).order("sort_order").order("created_at"),
        supabase.from("event_payments").select("*").eq("financial_id", financialId!).order("occurred_at", { ascending: false }),
        supabase.from("event_budget_items").select("*").eq("financial_id", financialId!).order("sort_order"),
        supabase.from("event_documents").select("*").eq("financial_id", financialId!).order("created_at"),
        supabase
          .from("event_financial_communications")
          .select("*")
          .eq("financial_id", financialId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("event_financial_activity")
          .select("*")
          .eq("financial_id", financialId!)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (fin.error) throw fin.error;
      let privateEvent: any = null;
      let publicEvent: any = null;
      if (fin.data?.private_event_id) {
        const { data } = await supabase.from("private_events").select("*").eq("id", fin.data.private_event_id).maybeSingle();
        privateEvent = data;
      }
      if (fin.data?.event_id) {
        const { data } = await supabase.from("events").select("*").eq("id", fin.data.event_id).maybeSingle();
        publicEvent = data;
      }
      return {
        financial: fin.data,
        items: items.data ?? [],
        invoices: invoices.data ?? [],
        payments: payments.data ?? [],
        budget: budget.data ?? [],
        documents: docs.data ?? [],
        communications: comms.data ?? [],
        activity: activity.data ?? [],
        privateEvent,
        publicEvent,
      };
    },
  });
}

export function useFinancialTemplates() {
  return useQuery({
    queryKey: ["event-financial-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_financial_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFinancialMutations(financialId?: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["event-financial", financialId] });
    qc.invalidateQueries({ queryKey: ["event-invoices-all"] });
    qc.invalidateQueries({ queryKey: ["event-financial-rollups"] });
  };

  const log = async (kind: string, message: string, meta?: any) => {
    if (!financialId) return;
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("event_financial_activity").insert({
      financial_id: financialId,
      kind,
      message,
      meta: meta ?? null,
      actor_id: auth.user?.id ?? null,
    });
  };

  const updateFinancial = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase.from("event_financials").update(patch).eq("id", financialId!);
      if (error) throw error;
      await log("update", "Financial settings updated.");
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const saveItems = useMutation({
    mutationFn: async (items: FinancialItem[]) => {
      const { error: delErr } = await supabase.from("event_financial_items").delete().eq("financial_id", financialId!);
      if (delErr) throw delErr;
      if (items.length) {
        const { error } = await supabase.from("event_financial_items").insert(
          items.map((i, idx) => ({
            financial_id: financialId!,
            classification: i.classification,
            section: i.section ?? null,
            label: i.label,
            client_description: i.client_description ?? null,
            internal_note: i.internal_note ?? null,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
            taxable: i.taxable,
            show_quantity: i.show_quantity,
            show_price: i.show_price,
            selected: i.selected,
            client_selectable: i.client_selectable,
            sort_order: idx,
          })),
        );
        if (error) throw error;
      }
      await log("update", "Line items saved.");
    },
    onSuccess: () => {
      refresh();
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveInvoice = useMutation({
    mutationFn: async (invoice: Record<string, any>) => {
      if (invoice.id) {
        const { id, ...patch } = invoice;
        const { error } = await supabase.from("event_invoices").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_invoices").insert({ ...invoice, financial_id: financialId! });
        if (error) throw error;
      }
      await log("invoice", invoice.id ? "Invoice updated." : "Invoice created.");
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_invoices").delete().eq("id", id);
      if (error) throw error;
      await log("invoice", "Invoice removed.");
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: async (p: {
      invoice_id: string;
      amount_cents: number;
      direction: "payment" | "refund";
      method: string;
      reference?: string;
      occurred_at?: string;
      notes?: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("event_payments").insert({
        financial_id: financialId!,
        invoice_id: p.invoice_id,
        direction: p.direction,
        amount_cents: p.amount_cents,
        method: p.method,
        reference: p.reference ?? null,
        occurred_at: p.occurred_at ?? new Date().toISOString(),
        notes: p.notes ?? null,
        recorded_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      await log("payment", `${p.direction === "refund" ? "Refund" : "Payment"} recorded.`);
    },
    onSuccess: () => {
      refresh();
      toast.success("Recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveBudget = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error: delErr } = await supabase.from("event_budget_items").delete().eq("financial_id", financialId!);
      if (delErr) throw delErr;
      if (rows.length) {
        const { error } = await supabase
          .from("event_budget_items")
          .insert(rows.map((r, idx) => ({ ...r, id: undefined, financial_id: financialId!, sort_order: idx })));
        if (error) throw error;
      }
      await log("budget", "Internal budget updated.");
    },
    onSuccess: () => {
      refresh();
      toast.success("Budget saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDocument = useMutation({
    mutationFn: async (doc: Record<string, any>) => {
      if (doc.id) {
        const { id, ...patch } = doc;
        const { error } = await supabase.from("event_documents").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_documents").insert({ ...doc, financial_id: financialId! });
        if (error) throw error;
      }
      await log("document", doc.id ? "Document updated." : "Document created.");
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  return { updateFinancial, saveItems, saveInvoice, deleteInvoice, recordPayment, saveBudget, saveDocument, log, refresh };
}

/** Create (or fetch) the financial workspace for a private event. */
export function useEnsurePrivateEventFinancials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (privateEventId: string) => {
      const { data, error } = await supabase.rpc("ensure_private_event_financials", {
        p_private_event_id: privateEventId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-financial-rollups"] });
      qc.invalidateQueries({ queryKey: ["event-invoices-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
