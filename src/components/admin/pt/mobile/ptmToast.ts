import { toast } from "sonner";

/** Mobile toast helpers — consistent copy + placement for the PT mobile app. */
export const ptmToast = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  error: (message: string, description?: string) => toast.error(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
  saved: () => toast.success("Saved"),
  offline: () => toast.error("You're offline", { description: "Changes will not save until you reconnect." }),
};
