import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { isFeatureEnabled } from "./featureFlags";
import { initPerformanceMetrics } from "./utils/performanceMetrics";

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

createRoot(document.getElementById("root")!).render(<App />);
