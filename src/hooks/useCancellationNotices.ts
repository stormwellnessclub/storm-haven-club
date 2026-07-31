import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CancellationVariant =
  | "membership_cancelled"
  | "incomplete_membership_cancelled"
  | "application_cancelled";

export interface CancellationTemplate {
  id: string;
  template_key: CancellationVariant;
  display_name: string;
  subject: string;
  body_html: string;
  updated_at: string;
}

export const CANCELLATION_VARIANT_LABELS: Record<CancellationVariant, string> = {
  membership_cancelled: "Full membership cancellation",
  incomplete_membership_cancelled: "Incomplete membership (paid initiation, no dues)",
  application_cancelled: "Application cancellation (never paid)",
};

export function useCancellationTemplates() {
  return useQuery<CancellationTemplate[]>({
    queryKey: ["cancellation-notice-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_notice_templates" as any)
        .select("*")
        .order("display_name");
      if (error) throw error;
      return (data || []) as unknown as CancellationTemplate[];
    },
    staleTime: 60_000,
  });
}

export function useSaveCancellationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { template_key: CancellationVariant; subject: string; body_html: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cancellation_notice_templates" as any)
        .update({
          subject: input.subject,
          body_html: input.body_html,
          updated_by_email: userRes?.user?.email ?? null,
        })
        .eq("template_key", input.template_key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cancellation-notice-templates"] });
      toast.success("Cancellation notice template saved as default");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save template"),
  });
}

/** Decide which notice fits a member's payment history. */
export function resolveCancellationVariant(member: {
  annual_fee_paid_at?: string | null;
  annual_fee_subscription_id?: string | null;
  stripe_subscription_id?: string | null;
}): CancellationVariant {
  const paidInitiation = !!(member.annual_fee_paid_at || member.annual_fee_subscription_id);
  const hadDues = !!member.stripe_subscription_id;
  if (!paidInitiation && !hadDues) return "application_cancelled";
  if (paidInitiation && !hadDues) return "incomplete_membership_cancelled";
  return "membership_cancelled";
}

export interface NoticeVars {
  name: string;
  membershipTier?: string;
  cancellationDate?: string;
  reason?: string;
  amountOwed?: number;
  extraMessage?: string;
}

/** Client-side merge-field rendering so the preview matches what gets sent. */
export function renderNoticeBody(bodyHtml: string, vars: NoticeVars): string {
  const amount = Number(vars.amountOwed ?? 0);
  const map: Record<string, string> = {
    name: vars.name ?? "",
    membershipTier: vars.membershipTier ?? "",
    cancellationDate: vars.cancellationDate ?? "",
    reason: vars.reason ?? "",
    amountOwed: amount > 0 ? `$${amount.toFixed(2)}` : "",
    amountOwedBlock:
      amount > 0
        ? `Our records show an outstanding balance of <strong>$${amount.toFixed(2)}</strong> on your account. Please contact us to settle this balance.`
        : "",
    extraMessage: vars.extraMessage ?? "",
  };
  return bodyHtml
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => map[key] ?? "")
    .replace(/<p[^>]*>\s*<\/p>/g, "");
}

export function renderNoticeSubject(subject: string, vars: NoticeVars): string {
  return renderNoticeBody(subject, vars);
}
