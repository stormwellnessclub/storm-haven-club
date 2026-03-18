import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BBqucZos_RlLkyhZaaY-fRVeSE4AY9Os9ogBBokBMTgC5F-Q_EywPL2FlPkXnQSTfAtmttc8vzqyCRgA4EqiCtA";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notification permission denied. Please enable notifications in your browser settings.");
        return;
      }

      // Register push service worker
      await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = subscription.toJSON();

      // Save subscription to database
      const { error } = await (supabase.from("push_subscriptions" as any) as any)
        .upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || "",
          auth_key: subJson.keys?.auth || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,endpoint" });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Push notifications enabled! You'll receive alerts for urgent Kids Care messages.");
    } catch (err: any) {
      console.error("Push subscription error:", err);
      toast.error("Failed to enable notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        // Remove from database
        await (supabase.from("push_subscriptions" as any) as any)
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.success("Push notifications disabled.");
    } catch (err: any) {
      console.error("Unsubscribe error:", err);
      toast.error("Failed to disable notifications.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
