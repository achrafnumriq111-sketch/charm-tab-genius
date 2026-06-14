/**
 * Guarded service-worker registration.
 * Refuses to register in Lovable preview, iframes, dev, or with ?sw=off.
 */

const SW_PATH = "/sw.js";

function isPreviewHost(host: string): boolean {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function purgeAll(): Promise<boolean> {
  let hadSomething = false;
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length) hadSomething = true;
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
  }
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      if (keys.length) hadSomething = true;
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* ignore */
    }
  }
  return hadSomething;
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    url.searchParams.get("sw") === "off";

  if (refused) {
    const hadSomething = await purgeAll();
    // If a stale SW was controlling this page, reload once so the fresh
    // (network-served) HTML + chunks take over instead of cached broken ones.
    if (hadSomething && navigator.serviceWorker.controller) {
      const KEY = "__sw_purge_reloaded";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
      }
    }
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    // Non-fatal: app still works online without SW
    console.warn("[pwa] SW registration failed", err);
  }
}
