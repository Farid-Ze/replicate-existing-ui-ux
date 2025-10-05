import { expect, test } from "@playwright/test";

const shouldRunPwaE2E = process.env.E2E_PWA === "true";

test.describe("pwa offline resilience", () => {
  test.skip(!shouldRunPwaE2E, "PWA e2e suite runs only when E2E_PWA=true");

  test("serves offline fallback and surfaces update toast", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers unavailable");
      }
      await navigator.serviceWorker.register("/sw.js");
    });
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForLoadState("load");

    await page.waitForFunction(
      () => typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller,
      undefined,
      { timeout: 30_000 },
    );

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    await context.setOffline(false);

    await page.goto("/");
    await page.waitForLoadState("load");

    await page.evaluate(() => {
      (window as typeof window & { __PWA_DEBUG_TOAST?: () => void }).__PWA_DEBUG_TOAST?.();
    });

    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('[data-sonner-toaster]')).length > 0,
    );

    const toast = page.getByRole("status", { name: /new content available/i });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: /refresh/i })).toBeVisible();
  });
});
