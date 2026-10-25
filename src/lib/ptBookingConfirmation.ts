type Invoke = (name: string, options: { body: { appointment_id: string; type: string } }) => Promise<{ data: any; error: any }>;

/** Notification failure never undoes or retries an already successful booking. */
export async function notifyPTBooking(appointmentId: string, invoke: Invoke): Promise<string | null> {
  try {
    const { data, error } = await invoke("send-pt-booking-email", { body: { appointment_id: appointmentId, type: "confirmation" } });
    if (error || !data?.success) return "Confirmation could not be sent. Use Send confirmation to retry.";
    if (data.sms_warning) return "Confirmation email sent, but the text failed. Use Send confirmation to retry.";
    return null;
  } catch {
    return "Confirmation could not be sent. Use Send confirmation to retry.";
  }
}