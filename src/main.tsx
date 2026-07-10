import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./index.css";

const AUTH_SW_CLEANUP_FLAG = "auth-sw-cleanup-v1";

// Unregister stale service workers in preview/iframe contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

const isAuthRoute = ["/auth", "/reset-password", "/update-password"].includes(
  window.location.pathname,
);

function isAppServiceWorker(registration: ServiceWorkerRegistration) {
  const scriptUrl =
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    "";

  return scriptUrl.endsWith("/sw.js");
}

async function cleanupStaleServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();

  const registrationsToRemove = registrations.filter((registration) => {
    if (isPreviewHost || isInIframe) return true;
    if (isAuthRoute) return isAppServiceWorker(registration);
    return false;
  });

  if (registrationsToRemove.length === 0) return;

  await Promise.all(
    registrationsToRemove.map((registration) => registration.unregister().catch(() => false)),
  );

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
  }

  if (isAuthRoute && !sessionStorage.getItem(AUTH_SW_CLEANUP_FLAG)) {
    sessionStorage.setItem(AUTH_SW_CLEANUP_FLAG, "1");
    window.location.reload();
    return;
  }

  if (!isAuthRoute) {
    sessionStorage.removeItem(AUTH_SW_CLEANUP_FLAG);
  }
}

void cleanupStaleServiceWorkers();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
