const labels: Record<string, string> = {
  one_on_one: "1:1 Personal Training",
  reformer_one_on_one: "Reformer Pilates 1:1",
  semi_private: "Semi-Private (max 4)",
};

export function isSmsDeliveryFailure(data: { success?: boolean; error?: string } | null, error: unknown) {
  const expectedSkip = data?.error === "no_consent" || data?.error === "blocked" || data?.error === "No phone for recipient";
  return !expectedSkip && (Boolean(error) || data?.success === false);
}

export function confirmationSms(appt: { id: string; user_id: string; format: string; starts_at: string; duration_minutes: number }, trainerName: string) {
  const when = new Date(appt.starts_at);
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", ...options }).format(when);
  return {
    to: { userId: appt.user_id },
    templateKey: "appointment-confirmation",
    variables: {
      service: `${labels[appt.format] ?? appt.format} (${appt.duration_minutes} min)`,
      date: fmt({ weekday: "short", month: "short", day: "numeric" }),
      time: fmt({ hour: "numeric", minute: "2-digit" }),
      provider: trainerName,
    },
    idempotencyKey: `pt-confirmation-${appt.id}`,
    metadata: { source: "send-pt-booking-email", appointment_id: appt.id },
  };
}