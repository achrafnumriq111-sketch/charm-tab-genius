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

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) =>
          (r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "")
            .endsWith(SW_PATH),
        )
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
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
    await unregisterMatching();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    // Non-fatal: app still works online without SW
    console.warn("[pwa] SW registration failed", err);
  }
}
