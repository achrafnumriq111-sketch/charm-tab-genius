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

  // TEMPORARY: SW registration is disabled on every host (preview AND production)
  // because earlier builds installed a SW that now serves stale chunks
  // (causing "cannot reach /login" / blank screens). We aggressively purge any
  // existing SW + cache on every visit so users self-heal on next load.
  const hadSomething = await purgeAll();
  if (hadSomething && navigator.serviceWorker.controller) {
    const KEY = "__sw_purge_reloaded";
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      window.location.reload();
    }
  }
}

// Kept for future re-enable. Currently unused.
void SW_PATH;
void isPreviewHost;
