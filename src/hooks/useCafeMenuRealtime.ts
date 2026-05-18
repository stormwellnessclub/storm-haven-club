import { useQueryClient } from "@tanstack/react-query";
import { useReliableRealtime } from "@/hooks/useReliableRealtime";

/**
 * Subscribes to changes on cafe menu tables and invalidates all related
 * React Query caches so the admin manager, customer /cafe page, and POS
 * stay in sync across tabs/devices in real time.
 */
export function useCafeMenuRealtime(channelName: string = "cafe-menu-sync") {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cafe_menu_categories"] });
    queryClient.invalidateQueries({ queryKey: ["cafe_menu_items"] });
    queryClient.invalidateQueries({ queryKey: ["cafe_menu_addons"] });
  };

  useReliableRealtime({
    channelName,
    listeners: [
      { event: "*", table: "cafe_menu_categories", callback: invalidateAll },
      { event: "*", table: "cafe_menu_items", callback: invalidateAll },
      { event: "*", table: "cafe_menu_addons", callback: invalidateAll },
    ],
  });
}
