import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { isFeatureEnabled } from "./featureFlags";
import { initPerformanceMetrics } from "./utils/performanceMetrics";
import * as Sentry from "@sentry/react";
import { loadSonner } from "./utils/loadSonner";

const pwaEnabled = isFeatureEnabled("pwa");

if (isFeatureEnabled("performanceMetrics")) {
  void initPerformanceMetrics();
}

if (isFeatureEnabled("analytics")) {
  import("@vercel/analytics").then(({ inject }) => {
    try {
      inject();
    } catch (error) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("Analytics injection failed", error);
      }
    }
  });
}

if (isFeatureEnabled("monitoring") && import.meta.env.PROD) {
  try {
    const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || "";
    if (dsn) {
      Sentry.init({
        dsn,
        integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.0,
        replaysOnErrorSampleRate: 0.1,
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("Sentry init failed", err);
    }
  }
}

const showUpdateToast = (waiting?: ServiceWorker) => {
  if (!pwaEnabled) return;
  void loadSonner()
    .then(({ toast }) => {
      const action = waiting
        ? {
            label: "Refresh",
            onClick: () => {
              try {
                waiting.postMessage("SKIP_WAITING");
              } catch {}
              if (navigator.serviceWorker) {
                navigator.serviceWorker.addEventListener(
                  "controllerchange",
                  () => window.location.reload(),
                  { once: true },
                );
              } else {
                window.location.reload();
              }
            },
          }
        : undefined;
      toast("New content available", {
        description: "Refresh to update to the latest version.",
        action,
        duration: 10000,
      });
    })
    .catch(() => {});
};

// Register service worker when PWA flag enabled and in production
if (pwaEnabled && import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        // If there's an update already waiting
        if (registration.waiting) {
          showUpdateToast(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New update available
              showUpdateToast(installing);
            }
          });
        });

        // Optional: periodic check when tab gains focus
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });

        // Try to register Periodic Background Sync for update checks (best effort)
        if ("periodicSync" in (registration as any)) {
          const r = registration as ServiceWorkerRegistration & { periodicSync?: any };
          (async () => {
            try {
              const status = await navigator.permissions.query({ name: "periodic-background-sync" as PermissionName });
              if (status.state === "granted" || status.state === "prompt") {
                await r.periodicSync.register("check-updates", { minInterval: 24 * 60 * 60 * 1000 });
              }
            } catch {}
          })();
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("SW registration failed", err);
        }
      });
  });
}

if (pwaEnabled && typeof window !== "undefined" && import.meta.env.MODE !== "production") {
  (window as typeof window & { __PWA_DEBUG_TOAST?: () => void }).__PWA_DEBUG_TOAST = () => {
    showUpdateToast();
  };
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<div>Something went wrong.</div>}>
    <App />
  </Sentry.ErrorBoundary>
);
