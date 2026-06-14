/**
 * Trusted device token storage.
 * The token is bound to the physical iPad/browser via paired flow.
 * It is sent to `pos-login` so the edge function can server-side
 * resolve tenant_id without trusting the URL.
 */
const KEY = "saakouk_device_token";
const META_KEY = "saakouk_device_meta";

export interface DeviceMeta {
  device_id: string;
  device_name: string;
  tenant_slug?: string;
  tenant_name?: string;
  location_id?: string;
}

export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getDeviceMeta(): DeviceMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as DeviceMeta) : null;
  } catch {
    return null;
  }
}

export function setDevice(token: string, meta: DeviceMeta) {
  try {
    localStorage.setItem(KEY, token);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

export function clearDevice() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META_KEY);
  } catch { /* ignore */ }
}

export function isTrustedDevice(): boolean {
  return !!getDeviceToken();
}
